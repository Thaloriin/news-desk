// 一次性清洗：把库里已入库的标题/摘要重新走一遍 stripHtml
const { db } = require("../src/db");
const { stripHtml } = require("../src/parse");

const clean = (v) => (v == null ? null : stripHtml(v));
const HTML_RE = /<\/?[a-z][^>]*>|&(?:lt|gt|amp|quot|nbsp|#\d+);/i;

const rows = db.prepare("SELECT id,title,summary,title_zh,summary_zh FROM items").all();
const upKeep = db.prepare("UPDATE items SET title=?, summary=?, title_zh=?, summary_zh=? WHERE id=?");
const upDrop = db.prepare("UPDATE items SET title=?, summary=?, title_zh=?, summary_zh=?, blocks_json=NULL WHERE id=?");

let dirty = 0, updated = 0;
const samples = [];

for (const r of rows) {
  const beforeTitle = r.title || "";
  const beforeSummary = r.summary || "";
  const dirtyRow = HTML_RE.test(beforeTitle) || HTML_RE.test(beforeSummary);

  const title = clean(beforeTitle) || "";
  const summary = clean(beforeSummary) || "";
  const summaryChanged = summary !== beforeSummary;

  if (!dirtyRow && title === beforeTitle && summary === beforeSummary) continue;

  const titleZh = clean(r.title_zh);
  // 摘要变了，之前基于脏文本生成的译文就作废，下次打开会重新翻译
  const summaryZh = summaryChanged ? null : clean(r.summary_zh);

  if (summaryChanged) upDrop.run(title, summary, titleZh, summaryZh, r.id);
  else upKeep.run(title, summary, titleZh, summaryZh, r.id);

  updated++;
  if (dirtyRow) {
    dirty++;
    if (samples.length < 3 && beforeSummary !== summary) {
      samples.push({ before: beforeSummary.slice(0, 160), after: summary.slice(0, 160) });
    }
  }
}

console.log(`扫描 ${rows.length} 条，含 HTML 残留 ${dirty} 条，实际更新 ${updated} 条`);
for (const s of samples) {
  console.log("\n--- 清洗前 ---\n" + s.before + "\n--- 清洗后 ---\n" + s.after);
}
