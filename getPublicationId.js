require("dotenv").config();
const axios = require("axios");

const SHOP = process.env.SHOP;
const TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "2024-10";

const GRAPHQL_URL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function run() {
  const query = `
    {
      publications(first: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const res = await axios.post(
    GRAPHQL_URL,
    { query },
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("\nPublications Found:\n");
  console.log(JSON.stringify(res.data, null, 2));
}


run();
