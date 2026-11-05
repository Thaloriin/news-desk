// 清理已入库译文里的重复虚词（"未解决的的"）
const { db } = require("../src/db");

const tidy = (v) => String(v || "")
  .replace(/的(?=的)/g, "")
  .replace(/了(?=了)/g, "")
  .replace(/([，、])\1+/g, "$1")
  .replace(/\s{2,}/g, " ");

const rows = db.prepare("SELECT id,title_zh,summary_zh,blocks_json FROM items WHERE title_zh IS NOT NULL").all();
const up = db.prepare("UPDATE items SET title_zh=?, summary_zh=?, blocks_json=? WHERE id=?");

let changed = 0;
for (const r of rows) {
  const titleZh = tidy(r.title_zh);
  const summaryZh = tidy(r.summary_zh);
  let blocks = null;
  if (r.blocks_json) {
    try {
      const arr = JSON.parse(r.blocks_json);
      blocks = JSON.stringify(arr.map(b => ({ ...b, zh: tidy(b.zh) })));
    } catch { blocks = r.blocks_json; }
  }
  if (titleZh !== r.title_zh || summaryZh !== r.summary_zh) {
    up.run(titleZh, summaryZh, blocks, r.id);
    changed++;
  }
}

console.log(`已翻译 ${rows.length} 条，修正 ${changed} 条`);
for (const r of rows.slice(0, 3)) console.log("  ·", tidy(r.title_zh).slice(0, 50));
