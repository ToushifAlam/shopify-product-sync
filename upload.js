require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const SHOP = process.env.SHOP;
const TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "2024-10";
const INPUT_FILE = process.env.INPUT_FILE || "products.csv";
const PUBLICATION_ID = process.env.PUBLICATION_ID;

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
const REST_URL = `https://${SHOP}/admin/api/${API_VERSION}`;

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function cleanId(gid) {
  return gid.replace("gid://shopify/Product/", "");
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* ---------------------------------------------------------
   GRAPHQL
--------------------------------------------------------- */
async function graphQL(query, variables = {}) {
  const res = await axios.post(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data;
}

/* ---------------------------------------------------------
   SEARCH PRODUCT
--------------------------------------------------------- */
async function findProduct(title) {
  const query = `
    query($query: String!) {
      products(first: 1, query: $query) {
        edges { node { id title } }
      }
    }
  `;

  const result = await graphQL(query, { query: `title:${title}` });
  return result?.data?.products?.edges?.[0]?.node || null;
}

/* ---------------------------------------------------------
   GRAPHQL PUBLISH (WORKING)
--------------------------------------------------------- */
async function publishProduct(productGid) {
  const mutation = `
    mutation publishProduct($id: ID!, $pub: ID!) {
      publishablePublish(id: $id, input: { publicationId: $pub }) {
        publishable {
          ... on Product {
            id
            title
            publishedAt
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    id: productGid,
    pub: PUBLICATION_ID
  };

  const res = await graphQL(mutation, variables);

  if (res.data?.publishablePublish?.userErrors?.length) {
    console.log("❌ Publish User Errors:", res.data.publishablePublish.userErrors);
  } else {
    console.log("🌍 Published:", productGid);
  }
}

/* ---------------------------------------------------------
   CREATE PRODUCT (REST)
--------------------------------------------------------- */
async function createProduct(p) {
  const body = {
    product: {
      title: p.title,
      body_html: p.descriptionHtml,
      product_type: p.productType,
      vendor: p.vendor,
      tags: p.tags,
      images: p.image ? [{ src: p.image }] : []
    },
  };

  const res = await axios.post(`${REST_URL}/products.json`, body, {
    headers: { "X-Shopify-Access-Token": TOKEN },
  });

  const productId = res.data.product.id;
  const productGid = res.data.product.admin_graphql_api_id;

  console.log("✅ Created:", p.title);

  // publish using GraphQL
  await publishProduct(productGid);

  return { id: productId, gid: productGid };
}

/* ---------------------------------------------------------
   UPDATE PRODUCT (REST)
--------------------------------------------------------- */
async function updateProduct(p, gid) {
  const id = cleanId(gid);

  const body = {
    product: {
      id,
      title: p.title,
      body_html: p.descriptionHtml,
      product_type: p.productType,
      vendor: p.vendor,
      tags: p.tags,
      images: p.image ? [{ src: p.image }] : []
    },
  };

  await axios.put(`${REST_URL}/products/${id}.json`, body, {
    headers: { "X-Shopify-Access-Token": TOKEN },
  });

  console.log("📝 Updated:", p.title);

  return { id, gid };
}

/* ---------------------------------------------------------
   CREATE / UPDATE VARIANT
--------------------------------------------------------- */
async function syncVariant(productId, p) {
  try {
    // Get all variants of the product
    const res = await axios.get(
      `${REST_URL}/products/${productId}/variants.json`,
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    const variants = res.data.variants;

    // Check if SKU exists
    let existing = variants.find(v => v.sku === p.sku);

    /* ---------------------------------------------------------
       UPDATE VARIANT (correct API endpoint)
    --------------------------------------------------------- */
    if (existing) {
      const body = {
        variant: {
          id: existing.id,
          price: p.variantPrice,
          sku: p.sku,
          inventory_quantity: Number(p.inventoryQuantity || 0)
        }
      };

      // CORRECT ENDPOINT (this is the one that Shopify accepts)
      await axios.put(
        `${REST_URL}/variants/${existing.id}.json`,
        body,
        { headers: { "X-Shopify-Access-Token": TOKEN } }
      );

      console.log("🔄 Updated variant:", p.sku);
      return;
    }

    /* ---------------------------------------------------------
       CREATE NEW VARIANT
    --------------------------------------------------------- */
    const body = {
      variant: {
        product_id: productId,
        price: p.variantPrice,
        sku: p.sku,
        inventory_quantity: Number(p.inventoryQuantity || 0)
      }
    };

    await axios.post(
      `${REST_URL}/variants.json`,
      body,
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    console.log("🟢 Created new variant:", p.sku);

  } catch (err) {
    console.error("❌ Variant ERROR:", err.response?.data || err);
  }
}


/* ---------------------------------------------------------
   READ CSV
--------------------------------------------------------- */
function readCSV() {
  return new Promise((resolve) => {
    const rows = [];
    fs.createReadStream(INPUT_FILE)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows));
  });
}

/* ---------------------------------------------------------
   RUN
--------------------------------------------------------- */
async function run() {
  console.log("\n🚀 Sync Started...\n");

  const rows = await readCSV();

  for (let p of rows) {
    console.log(`🔍 Processing → ${p.title}`);

    const existing = await findProduct(p.title);

    let product = null;

    if (existing) {
      console.log("📦 Found — updating...");
      product = await updateProduct(p, existing.id);
    } else {
      console.log("🆕 Creating new...");
      product = await createProduct(p);
    }

    await syncVariant(product.id, p);
    await delay(300);
  }

  console.log("\n✅ DONE — All Products Synced!\n");
}

run();
