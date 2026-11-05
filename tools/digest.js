// 按「日期 + 筛选条件」预生成 AI 总结，带缓存和节流。
// 静态站没有后端，只能构建时算好，点按钮直接读。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const llm = require("../src/llm");

const CACHE_FILE = path.join(__dirname, "..", "data", "digests.json");
const THROTTLE_MS = Number(process.env.DIGEST_THROTTLE_HOURS || 6) * 3600 * 1000;
const MIN_ITEMS = 6;
const MAX_CALLS = Number(process.env.DIGEST_MAX_CALLS || 18);

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf8");
}

function hashIds(ids) {
  return crypto.createHash("sha1").update(ids.join(",")).digest("hex").slice(0, 16);
}

function selectItems(items, key) {
  if (key === "all") return items;
  const conds = key.split("|").map(s => s.split(":"));
  return items.filter(it => conds.every(([type, val]) => {
    if (type === "cat") return it.category === val;
    if (type === "country") return it.country === val;
    if (type === "topic") return (it.topics || []).includes(val);
    return false;
  }));
}

function candidateKeys(items, full) {
  const cats = new Set();
  const countries = new Set();
  const topics = new Set();

  for (const it of items) {
    if (it.category) cats.add(it.category);
    if (it.country) countries.add(it.country);
    for (const t of it.topics || []) topics.add(t);
  }

  const keys = ["all"];
  for (const c of cats) keys.push(`cat:${c}`);
  for (const c of countries) keys.push(`country:${c}`);
  for (const t of topics) keys.push(`topic:${t}`);

  // 老日期只做单维，不做组合，控制成本
  if (!full) return keys;

  for (const c of cats) {
    for (const k of countries) keys.push(`cat:${c}|country:${k}`);
    for (const t of topics) keys.push(`cat:${c}|topic:${t}`);
  }
  for (const k of countries) {
    for (const t of topics) keys.push(`country:${k}|topic:${t}`);
  }
  return keys;
}

function priority(key) {
  if (key === "all") return 0;
  return key.includes("|") ? 2 : 1;
}

function toDigestItem(it) {
  return {
    id: it.id,
    title: it.title,
    summary: it.summary || "",
    source_name: it.source_name || "",
    url: it.url
  };
}

// full=true 时生成所有组合；false 只生成整天的总结（老日期用）
async function build(day, items, { full = true, maxCalls = MAX_CALLS } = {}) {
  const cache = loadCache();
  const keys = candidateKeys(items, full);

  const eligible = [];
  for (const key of keys) {
    const list = selectItems(items, key);
    if (key !== "all" && list.length < MIN_ITEMS) continue;
    if (!list.length) continue;
    eligible.push({ key, list });
  }

  eligible.sort((a, b) => priority(a.key) - priority(b.key) || b.list.length - a.list.length);

  const out = {};
  let calls = 0;

  for (const { key, list } of eligible) {
    const cacheKey = `${day}|${key}`;
    const top = list.slice(0, 25);
    const h = hashIds(top.map(x => x.id));
    const cached = cache[cacheKey];

    // 内容没变，或者还在节流窗口内，直接用旧的
    if (cached && (cached.hash === h || Date.now() - cached.at < THROTTLE_MS)) {
      out[key] = cached.data;
      continue;
    }

    if (calls >= maxCalls) {
      if (cached) out[key] = cached.data;
      continue;
    }

    try {
      const data = await llm.digest(top.map(toDigestItem));
      if (data) {
        cache[cacheKey] = { hash: h, at: Date.now(), data };
        out[key] = data;
        calls++;
      }
    } catch (e) {
      console.log(`总结失败 ${key}: ${e.message}`);
      if (cached) out[key] = cached.data;
    }
  }

  saveCache(cache);

  // 清掉 7 天前的旧缓存，避免文件无限增长
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  for (const k of Object.keys(cache)) {
    if (cache[k].at < cutoff) delete cache[k];
  }
  saveCache(cache);

  return { digests: out, calls };
}

module.exports = { build, selectItems };
