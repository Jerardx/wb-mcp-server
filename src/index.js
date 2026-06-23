#!/usr/bin/env node
// Wildberries MCP server (stdio). Three tools: wb_search, wb_product_details, wb_product_reviews.
// Plain HTTP to Wildberries' public JSON API — no browser.
// CRITICAL: stdout is the JSON-RPC wire — never write to it. All logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchSearch, fetchDetail, fetchCardJson, fetchFeedbacks } from "./wb.js";
import { parseSearch, parseDetail, parseCardJson, parseFeedbacks } from "./parse.js";

const log = (...a) => console.error("[wb-mcp]", ...a);
const TOOL_TIMEOUT_MS = 45000;
const MAX_TEXT = 250000; // room for large paginated result sets (e.g. 300 search items)

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

function tool(label, fn) {
  return async (args) => {
    try {
      const result = await withTimeout(fn(args), TOOL_TIMEOUT_MS, label);
      let text = JSON.stringify(result, null, 2);
      if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + "\n…(truncated)";
      return { content: [{ type: "text", text }] };
    } catch (err) {
      log(`${label} error:`, err?.message);
      return { content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }], isError: true };
    }
  };
}

/** Accept nm as a number, a wildberries URL (/catalog/{nm}/...), or a bare numeric string. */
function toNm(product) {
  const p = String(product || "").trim();
  if (/^\d+$/.test(p)) return p;
  const m = p.match(/catalog\/(\d+)/) || p.match(/(\d{5,})/);
  if (!m) throw new Error("product must be a Wildberries article (nm) or product URL");
  return m[1];
}

// ── operations ───────────────────────────────────────────────────────────────────
async function search({ query, limit = 12 }) {
  if (!query || !String(query).trim()) throw new Error("query is required");
  const json = await fetchSearch(query, limit);
  if (!json) throw new Error("Wildberries search returned no data");
  const { items } = parseSearch(json, limit);
  return { query, count: items.length, items };
}

async function details({ product }) {
  const nm = toNm(product);
  const detailJson = await fetchDetail(nm);
  const base = parseDetail(detailJson);
  if (!base) throw new Error(`product ${nm} not found`);
  const card = parseCardJson(await fetchCardJson(Number(nm)));
  base.description = card.description;
  base.characteristics = card.characteristics;
  return base;
}

async function reviews({ product, limit = 10 }) {
  const nm = toNm(product);
  // reviews are keyed by root (imtId), which comes from the detail response
  const base = parseDetail(await fetchDetail(nm));
  if (!base?.root) throw new Error(`cannot resolve review id (root) for product ${nm}`);
  const json = await fetchFeedbacks(base.root);
  const parsed = parseFeedbacks(json, limit);
  return { nm, name: base.name, ...parsed };
}

// ── server ───────────────────────────────────────────────────────────────────────
const server = new McpServer({ name: "wb-mcp-server", version: "0.0.1" });

server.registerTool(
  "wb_search",
  {
    title: "Search Wildberries products",
    description:
      "Search products on Wildberries (wildberries.ru). Returns name, price (RUB, numeric), old price, " +
      "rating, review count, brand, seller, image and a product URL. Use it to find products and compare prices.",
    inputSchema: {
      query: z.string().min(1).describe('Search query, e.g. "macbook pro", "iphone 17 pro max", "носки мужские"'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(300)
        .default(12)
        .describe("Max number of results (1–300, default 12). Above 100 the server pages WB search (slower; WB may rate-limit)."),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("wb_search", search)
);

server.registerTool(
  "wb_product_details",
  {
    title: "Get Wildberries product details",
    description:
      "Get full details for one Wildberries product: name, price, old price, availability, rating, review " +
      "count, brand, seller (name + rating), colors, image, full description and characteristics. " +
      "Accepts a Wildberries article number (nm) or a product URL.",
    inputSchema: {
      product: z.string().min(1).describe('Wildberries article (nm, e.g. "719482347") or product URL'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("wb_product_details", details)
);

server.registerTool(
  "wb_product_reviews",
  {
    title: "Get Wildberries product reviews",
    description:
      "Read real customer reviews for a Wildberries product: author, score (1–5), text, pros, cons, date, " +
      "color/size, whether photos are attached. Accepts a Wildberries article number (nm) or a product URL.",
    inputSchema: {
      product: z.string().min(1).describe('Wildberries article (nm) or product URL'),
      limit: z.number().int().min(1).max(30).default(10).describe("Max number of reviews (1–30, default 10)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("wb_product_reviews", reviews)
);

// ── lifecycle ───────────────────────────────────────────────────────────────────
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (e) => { log("uncaughtException:", e); cleanup(); });
process.on("unhandledRejection", (r) => log("unhandledRejection:", r));

const transport = new StdioServerTransport();
transport.onclose = cleanup;
await server.connect(transport);
log("ready on stdio");
