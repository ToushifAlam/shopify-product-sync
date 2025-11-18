require("dotenv").config();
const axios = require("axios");

const SHOP = process.env.SHOP;
const TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "2024-10";

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
const PUBLICATION_ID = "gid://shopify/Publication/172037013742";

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

  console.log("\nPublish Response:");
  console.log(JSON.stringify(result, null, 2));
}

async function run() {
  console.log("\nPublishing Products...\n");

  // 👉 Your real synced product IDs
  const products = [
    "gid://shopify/Product/9041531207918",
    "gid://shopify/Product/9041531273454",
    "gid://shopify/Product/9041531306222"
  ];

  for (const gid of products) {
    console.log(`Publishing → ${gid}`);
    await publishProduct(gid);
  }

  console.log("\nDONE — All Products Published to Online Store!\n");
}


run();
