// HTTP client for Wildberries' public JSON API. No browser.
// NOTE: WB's card.wb.ru filters by TLS/HTTP fingerprint and returns 403 to Node's undici fetch,
// while system curl passes. So requests go through curl (child_process), not fetch.
// Endpoints (verified live, 2026):
//   search   : https://search.wb.ru/exactmatch/ru/common/v5/search
//   detail   : https://card.wb.ru/cards/v4/detail   (v2 is dead → 404; use v4)
//   card.json: https://basket-XX.wbbasket.ru/volV/partP/{nm}/info/ru/card.json  (description + characteristics)
//   reviews  : https://feedbacks1|2.wb.ru/feedbacks/v1/{root}   (root/imtId comes from the detail response)
// WB rate-limits aggressive callers with HTTP 429 → retry with jitter.

import { execFile } from "node:child_process";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEST = "-1257786"; // Moscow region (affects price/availability)

const log = (...a) => console.error("[wb]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WB throttles bursts. Serialize requests with a minimum gap between them so a single
// tool call (which fires search/detail/cardJson/feedbacks) doesn't trip the 403 limiter.
const MIN_GAP_MS = 350;
let gate = Promise.resolve();
function throttle() {
  const next = gate.then(() => sleep(MIN_GAP_MS));
  gate = next;
  return next;
}

/** Run curl, return { status, body }. curl handles gzip (--compressed) and the WB-friendly TLS fingerprint. */
function curlGet(url, timeoutSec) {
  return new Promise((resolve, reject) => {
    const args = [
      "-sS", "--compressed", "-m", String(timeoutSec),
      "-H", `User-Agent: ${UA}`,
      "-H", "Accept: application/json",
      "-w", "\n%{http_code}", // append status as last line
      url,
    ];
    execFile("curl", args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const i = stdout.lastIndexOf("\n");
      const status = parseInt(stdout.slice(i + 1), 10);
      const body = stdout.slice(0, i);
      resolve({ status, body });
    });
  });
}

/** GET JSON via curl with retry + jitter. WB returns 429/403 under load → retry; 404 → null. */
async function getJson(url, { retries = 4, timeout = 15 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(attempt * 900 + Math.floor(Math.random() * 400));
    await throttle(); // min gap between any two WB requests
    try {
      const { status, body } = await curlGet(url, timeout);
      if (status === 429 || status === 403 || status >= 500) {
        lastErr = new Error(`HTTP ${status}`);
        continue;
      }
      if (status === 404) return null;
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
      return JSON.parse(body);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("request failed");
}

// ── basket host sharding (card.json lives on a CDN shard chosen by vol) ────────────
// Live source: https://cdn.wbbasket.ru/api/v3/upstreams . Static table cached here (46 shards, 2026).
const BASKET_RANGES = [
  [143, "01"], [287, "02"], [431, "03"], [719, "04"], [1007, "05"], [1061, "06"],
  [1115, "07"], [1169, "08"], [1313, "09"], [1601, "10"], [1655, "11"], [1919, "12"],
  [2045, "13"], [2189, "14"], [2405, "15"], [2621, "16"], [2837, "17"], [3053, "18"],
  [3269, "19"], [3485, "20"], [3701, "21"], [3917, "22"], [4133, "23"], [4349, "24"],
  [4565, "25"], [4877, "26"], [5189, "27"], [5501, "28"], [5813, "29"], [6125, "30"],
  [6437, "31"], [6749, "32"], [7061, "33"], [7373, "34"], [7685, "35"], [7997, "36"],
  [8309, "37"], [8741, "38"], [9173, "39"], [9605, "40"], [10373, "41"], [11141, "42"],
  [11909, "43"], [12677, "44"], [13445, "45"], [14213, "46"],
];

function basketHost(nm) {
  const vol = Math.floor(nm / 100000);
  for (const [threshold, b] of BASKET_RANGES) if (vol <= threshold) return `basket-${b}.wbbasket.ru`;
  return "basket-46.wbbasket.ru"; // best effort for very high nm beyond the table
}

function cardJsonUrl(nm) {
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  return `https://${basketHost(nm)}/vol${vol}/part${part}/${nm}/info/ru/card.json`;
}

/** First image URL (medium webp) for a product. */
export function imageUrl(nm) {
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  return `https://${basketHost(nm)}/vol${vol}/part${part}/${nm}/images/c516x688/1.webp`;
}

// ── raw fetchers ─────────────────────────────────────────────────────────────────
export async function fetchSearch(query, limit) {
  const u = new URL("https://search.wb.ru/exactmatch/ru/common/v5/search");
  u.searchParams.set("query", query);
  u.searchParams.set("resultset", "catalog");
  u.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
  u.searchParams.set("dest", DEST);
  u.searchParams.set("curr", "rub");
  u.searchParams.set("lang", "ru");
  return getJson(u.toString());
}

export async function fetchDetail(nm) {
  const u = new URL("https://card.wb.ru/cards/v4/detail");
  u.searchParams.set("appType", "1");
  u.searchParams.set("curr", "rub");
  u.searchParams.set("dest", DEST);
  u.searchParams.set("spp", "30");
  u.searchParams.set("nm", String(nm));
  return getJson(u.toString());
}

export async function fetchCardJson(nm) {
  return getJson(cardJsonUrl(nm));
}

/** Reviews are sharded across feedbacks1/feedbacks2; one may return empty — try both. */
export async function fetchFeedbacks(root) {
  for (const host of ["feedbacks1", "feedbacks2"]) {
    const data = await getJson(`https://${host}.wb.ru/feedbacks/v1/${root}`);
    if (data && data.feedbackCount > 0) return data;
  }
  // fall back to whatever feedbacks1 returned (possibly empty), so callers see a consistent shape
  return getJson(`https://feedbacks1.wb.ru/feedbacks/v1/${root}`);
}

export { log };
