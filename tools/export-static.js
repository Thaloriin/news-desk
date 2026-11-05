// 把数据库导出成静态 JSON，供 GitHub Pages 等静态托管使用
const fs = require("fs");
const path = require("path");
const store = require("../src/db");
const llm = require("../src/llm");
const digest = require("./digest");

const OUT = path.join(__dirname, "..", "public", "data");
const MAX_DAYS = Number(process.env.EXPORT_DAYS || 3);
const MAX_ITEMS = Number(process.env.EXPORT_ITEMS || 300);
const TRANSLATE_LIMIT = Number(process.env.TRANSLATE_LIMIT || 8);   // 每次最多翻几条
const TRANSLATE_TOP = Number(process.env.TRANSLATE_TOP || 80);      // 每天只翻分数最高的前 N 条

function parseTopics(s) {
  try {
    const a = JSON.parse(s || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function parseBlocks(s) {
  if (!s) return null;
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) && a.length ? a : null;
  } catch {
    return null;
  }
}

function facetsOf(rows) {
  const cat = new Map();
  const cty = new Map();
  const top = new Map();

  for (const r of rows) {
    cat.set(r.category, (cat.get(r.category) || 0) + 1);
    const c = r.country || "全球";
    cty.set(c, (cty.get(c) || 0) + 1);
    for (const t of parseTopics(r.topics)) top.set(t, (top.get(t) || 0) + 1);
  }

  const sorted = (m) => [...m.entries()]
    .map(([k, c]) => ({ k, c }))
    .sort((a, b) => b.c - a.c);

  return { categories: sorted(cat), countries: sorted(cty), topics: sorted(top) };
}

// 静态版没有后端，译文必须在构建时生成。
// 只翻重要性最高的一批控制成本，已有译文的直接复用。
async function translateLatest(rows) {
  if (!llm.enabled()) {
    console.log("未配置 AI Key，跳过预翻译");
    return 0;
  }

  // 只翻英文源；中文源不需要翻，白花钱
  // 只翻当天分数最高的前 N 条，控制长期成本
  const todo = rows
    .filter(r => r.lang === "en")
    .slice(0, TRANSLATE_TOP)
    .filter(r => !r.blocks_json)
    .slice(0, TRANSLATE_LIMIT);
  let done = 0;

  for (const r of todo) {
    try {
      const tr = await llm.translate(r.title, r.summary || "");
      const summaryZh = tr.blocks.map(b => b.zh).filter(Boolean).join(" ");
      store.setTranslation(r.id, tr.title.zh, summaryZh, tr.blocks);
      done++;
    } catch (e) {
      console.log(`翻译失败 id=${r.id}: ${e.message}`);
    }
  }
  return done;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const stats = store.stats();
  const days = stats.days.slice(0, MAX_DAYS);

  // 刚过零点时"今天"只有几条，把所有筛选组合的总结放到最近一个数据完整的日子
  const fullDay = (days.find(x => x.c >= 20) || days[0] || {}).day;

  if (days.length) {
    const latest = store.byDay(days[0].day);
    const n = await translateLatest(latest);
    if (n) console.log(`预翻译 ${n} 条`);
  }

  for (const d of days) {
    const all = store.byDay(d.day);
    const items = all.slice(0, MAX_ITEMS).map(r => ({
      id: r.id,
      title: r.title,
      summary: r.summary || "",
      url: r.url,
      source_name: r.source_name,
      category: r.category,
      country: r.country,
      score: Math.round((r.score || 0) * 10) / 10,
      cluster_size: r.cluster_size || 1,
      published_at: r.published_at,
      day: r.day,
      topics: parseTopics(r.topics),
      title_zh: r.title_zh || "",
      summary_zh: r.summary_zh || "",
      blocks: parseBlocks(r.blocks_json)
    }));

    // 只有最新一天生成所有筛选组合的总结，老日期只留整体总结，控制成本
    const isLatest = d.day === fullDay;
    const dg = await digest.build(d.day, items, { full: isLatest });

    fs.writeFileSync(
      path.join(OUT, `${d.day}.json`),
      JSON.stringify({
        day: d.day,
        count: items.length,
        items,
        facets: facetsOf(all),
        digests: dg.digests
      }),
      "utf8"
    );
    console.log(`导出 ${d.day}: ${items.length} 条，总结 ${Object.keys(dg.digests).length} 组（新生成 ${dg.calls}）`);
  }

  fs.writeFileSync(
    path.join(OUT, "index.json"),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      total: stats.total,
      days,
      srcs: stats.srcs.slice(0, 20),
      llm: llm.enabled(),
      model: llm.enabled() ? llm.modelName() : null
    }, null, 2),
    "utf8"
  );

  console.log(`完成，共 ${days.length} 天 → public/data/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
