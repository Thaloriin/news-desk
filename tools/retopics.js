// 给已有新闻补打兴趣话题标签
const { db } = require("../src/db");
const topics = require("../src/topics");

const rows = db.prepare("SELECT id,title,summary FROM items").all();
const up = db.prepare("UPDATE items SET topics=? WHERE id=?");
const counts = new Map();
let tagged = 0;

for (const r of rows) {
  const list = topics.detect(r.title, r.summary);
  up.run(JSON.stringify(list), r.id);
  if (list.length) tagged++;
  for (const t of list) counts.set(t, (counts.get(t) || 0) + 1);
}

console.log(`扫描 ${rows.length} 条，命中话题 ${tagged} 条`);
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(sorted.map(([k, c]) => `${k}=${c}`).join("  "));
