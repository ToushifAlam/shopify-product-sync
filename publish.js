require("dotenv").config();
const axios = require("axios");

const SHOP = process.env.SHOP;
const TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "2024-10";

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

// 👉 Your verified Online Store publication ID
const PUBLICATION_ID = "gid://shopify/Publication/172037013742";

// ------------------------------------------------------
// GRAPHQL Helper
// ------------------------------------------------------
async function graphQL(query, variables = {}) {
  const res = await axios.post(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json"
      }
    }
  );
  return res.data;
}

// ------------------------------------------------------
// PUBLISH PRODUCT
// ------------------------------------------------------
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

  const result = await graphQL(mutation, variables);

  console.log("\n🟢 Publish Response:");
  console.log(JSON.stringify(result, null, 2));
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------
async function run() {
  console.log("\n🚀 Publishing Products...\n");

  // 👉 Your real synced product IDs
  const products = [
    "gid://shopify/Product/9041531207918",  // Blue T-Shirt
    "gid://shopify/Product/9041531273454",  // Red Hoodie
    "gid://shopify/Product/9041531306222"   // Black Cap
  ];

  for (const gid of products) {
    console.log(`Publishing → ${gid}`);
    await publishProduct(gid);
  }

  console.log("\n✅ DONE — All Products Published to Online Store!\n");
}

run();