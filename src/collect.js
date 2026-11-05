const proxy = require("./proxy");
proxy.setup();

const FEEDS = require("../feeds");
const db = require("./db");
const { parseFeed } = require("./parse");
const { classify } = require("./classify");
const { clusterItems, importance } = require("./score");
const { detect } = require("./geo");
const topics = require("./topics");
const llm = require("./llm");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NewsDesk/0.1";

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      redirect: "follow"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return { feed, items: parseFeed(xml, feed) };
  } finally {
    clearTimeout(timer);
  }
}

async function run({ useLLM = true } = {}) {
  const started = Date.now();
  await proxy.detect();   // 抓取前确认一遍代理
  const disabled = require("./config").load().feedsDisabled || [];
  const active = FEEDS.filter(f => !disabled.includes(f.id));
  const report = { feeds: active.length, ok: 0, failed: [], fetched: 0, inserted: 0, llm: false };

  // 1. 限并发抓取：14 个源同时挤代理会被限流，改成 4 个一批，失败重试一次
  async function pool(list, limit, fn) {
    const out = [];
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        try {
          out[idx] = { status: "fulfilled", value: await fn(list[idx]) };
        } catch (e1) {
          await new Promise(r => setTimeout(r, 600));
          try {
            out[idx] = { status: "fulfilled", value: await fn(list[idx]) };
          } catch (e2) {
            out[idx] = { status: "rejected", reason: e2 };
          }
        }
      }
    });
    await Promise.all(workers);
    return out;
  }

  const results = await pool(active, 4, fetchFeed);
  const allItems = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      report.ok++;
      allItems.push(...r.value.items);
    } else {
      report.failed.push(String(r.reason?.message || r.reason).slice(0, 60));
    }
  }
  report.fetched = allItems.length;

  // 2. 入库（url 去重）
  const weightMap = Object.fromEntries(FEEDS.map(f => [f.id, f.weight]));
  const feedMap = Object.fromEntries(FEEDS.map(f => [f.id, f]));
  for (const it of allItems) {
    const { category } = classify(it.title, it.summary);
    it.category = category;
    it.country = detect(it.title, it.summary, feedMap[it.sourceId]?.region);
    it.topics = topics.detect(it.title, it.summary);
    const { score, parts } = importance(it, 1, weightMap[it.sourceId] || 0.6, null);
    it.score = score;
    it.scoreParts = parts;
    try {
      db.upsert(it);
      report.inserted++;
    } catch (e) { /* 唯一键冲突时忽略 */ }
  }

  // 3. 取最近两天数据做聚类（跨源热度需要同一天的全量）
  const days = new Set(allItems.map(i => i.day));
  days.add(new Date().toISOString().slice(0, 10));
  const recent = db.all().filter(x => days.has(x.day));

  const groups = clusterItems(recent, 0.2, 2);
  const sizeOf = new Map();
  for (const [root, idxs] of groups) {
    for (const i of idxs) sizeOf.set(recent[i].url_hash, idxs.length);
  }
  for (const it of recent) {
    const size = sizeOf.get(it.url_hash) || 1;
    db.setCluster(it.id, it.id, size);
    it.cluster_size = size;
  }

  // 4. 先算启发式分，挑前 N 条交给 LLM
  const rescored = recent.map(it => {
    const { score, parts } = importance(
      { title: it.title, summary: it.summary, publishedAt: it.published_at },
      it.cluster_size || 1,
      weightMap[it.source_id] || 0.6,
      null
    );
    return { ...it, score, parts };
  }).sort((a, b) => b.score - a.score);

  if (useLLM && llm.enabled()) {
    const top = rescored.slice(0, 60);
    try {
      const rated = await llm.rate(top);
      if (rated) {
        report.llm = true;
        for (const r of rated) {
          const it = top[r.i];
          if (!it) continue;
          if (r.category) db.db.prepare("UPDATE items SET category=? WHERE id=?").run(r.category, it.id);
          db.setLLM(it.id, r.score, r.reason);
          const { score, parts } = importance(
            { title: it.title, summary: it.summary, publishedAt: it.published_at },
            it.cluster_size || 1, weightMap[it.source_id] || 0.6, r.score
          );
          db.setScore(it.id, score, parts);
        }
      }
    } catch (e) {
      report.failed.push("LLM: " + String(e.message).slice(0, 50));
    }
  }

  // 5. 其余条目落最终分
  const llmIds = new Set(report.llm ? [] : []);
  for (const it of rescored) {
    if (llmIds.has(it.id)) continue;
    db.setScore(it.id, it.score, it.parts);
  }

  report.proxy = proxy.status();
  report.ms = Date.now() - started;
  return report;
}

module.exports = { run };
