// Pure parsers over Wildberries JSON responses. No network here.
import { imageUrl } from "./wb.js";

/** kopecks -> rubles (integer); null/0 -> null */
function rub(kopecks) {
  if (!kopecks || typeof kopecks !== "number") return null;
  return Math.round(kopecks / 100);
}

function productUrl(nm) {
  return `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;
}

/** Price lives in sizes[].price.{basic,product}; product = after discount, basic = before. */
function priceFromSizes(p) {
  const sizes = Array.isArray(p?.sizes) ? p.sizes : [];
  for (const s of sizes) {
    const pr = s?.price;
    if (pr && (pr.product || pr.total || pr.basic)) {
      return {
        price: rub(pr.product ?? pr.total ?? pr.basic),
        oldPrice: rub(pr.basic),
      };
    }
  }
  // fallback to legacy flat fields if present
  return { price: rub(p?.salePriceU), oldPrice: rub(p?.priceU) };
}

function baseProduct(p) {
  const nm = p.id;
  const { price, oldPrice } = priceFromSizes(p);
  const rating = p.reviewRating ?? p.nmReviewRating ?? p.rating ?? null;
  return {
    nm: String(nm),
    name: p.name || null,
    brand: p.brand || null,
    price,
    oldPrice: oldPrice && price && oldPrice > price ? oldPrice : null,
    rating,
    reviews: p.feedbacks ?? p.nmFeedbacks ?? null,
    supplier: p.supplier || null,
    supplierRating: p.supplierRating ?? null,
    url: productUrl(nm),
    image: imageUrl(nm),
  };
}

// ── search ───────────────────────────────────────────────────────────────────────
export function parseSearch(json, limit = 12) {
  const products = json?.products || json?.data?.products || [];
  const items = products.slice(0, limit).map(baseProduct);
  return { count: items.length, items };
}

// ── details ──────────────────────────────────────────────────────────────────────
// `detail` gives price/seller/rating + root (imtId). `cardJson` gives description + characteristics.
export function parseDetail(detailJson) {
  const products = detailJson?.products || detailJson?.data?.products || [];
  const p = products[0];
  if (!p) return null;
  const out = baseProduct(p);
  out.root = p.root != null ? String(p.root) : null; // needed for reviews
  out.pics = p.pics ?? null;
  out.inStock = (p.totalQuantity ?? 0) > 0;
  out.colors = (p.colors || []).map((c) => c.name).filter(Boolean);
  return out;
}

/** card.json: description text + characteristics (flat list of {name,value}). */
export function parseCardJson(cardJson) {
  if (!cardJson) return { description: "", characteristics: {} };
  const description = (cardJson.description || "").replace(/\s+/g, " ").trim();

  // characteristics live in `options` (flat) or `grouped_options[].options`
  let opts = Array.isArray(cardJson.options) ? cardJson.options : [];
  if (!opts.length && Array.isArray(cardJson.grouped_options)) {
    opts = cardJson.grouped_options.flatMap((g) => g.options || []);
  }
  const characteristics = {};
  for (const o of opts) {
    const name = o?.name;
    const value = Array.isArray(o?.value) ? o.value.join(", ") : o?.value;
    if (name && value) characteristics[name] = String(value).trim();
  }
  return { description, characteristics };
}

// ── reviews ──────────────────────────────────────────────────────────────────────
export function parseFeedbacks(json, limit = 10) {
  const all = Array.isArray(json?.feedbacks) ? json.feedbacks : [];
  // text-bearing reviews first, then by date desc
  const sorted = [...all].sort((a, b) => {
    const at = (a.text || a.pros || a.cons) ? 1 : 0;
    const bt = (b.text || b.pros || b.cons) ? 1 : 0;
    if (at !== bt) return bt - at;
    return String(b.createdDate || "").localeCompare(String(a.createdDate || ""));
  });
  const reviews = sorted.slice(0, limit).map((f) => ({
    author: f.wbUserDetails?.name || f.userName || "Аноним",
    score: typeof f.productValuation === "number" ? f.productValuation : null,
    text: f.text || "",
    pros: f.pros || "",
    cons: f.cons || "",
    date: (f.createdDate || "").slice(0, 10) || null,
    color: f.color || null,
    size: f.size || null,
    hasPhotos: (Array.isArray(f.photos) && f.photos.length > 0) || (Array.isArray(f.photo) && f.photo.length > 0),
  }));
  return {
    rating: json?.valuation ?? null,
    totalReviews: json?.feedbackCount ?? null,
    count: reviews.length,
    reviews,
  };
}
