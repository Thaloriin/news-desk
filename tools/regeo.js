// 用修正后的规则重算全部新闻的国家/地区归属
const { db } = require("../src/db");
const { detect } = require("../src/geo");
const FEEDS = require("../feeds");

const regionById = new Map(FEEDS.map(f => [f.id, f.region]));
const rows = db.prepare("SELECT id,title,summary,source_id,country FROM items").all();
const up = db.prepare("UPDATE items SET country=? WHERE id=?");

let changed = 0;
const samples = [];
for (const r of rows) {
  const c = detect(r.title, r.summary, regionById.get(r.source_id) || "全球");
  if (c !== r.country) {
    up.run(c, r.id);
    changed++;
    if (samples.length < 8) samples.push(`${r.country || "-"} → ${c}   ${r.title.slice(0, 60)}`);
  }
}

console.log(`重算 ${rows.length} 条，变更 ${changed} 条`);
samples.forEach(s => console.log("  " + s));

const dist = db.prepare("SELECT COALESCE(country,'全球') k, COUNT(*) c FROM items GROUP BY k ORDER BY c DESC").all();
console.log("\n新的地区分布：");
console.log(dist.map(x => `${x.k}=${x.c}`).join("  "));
