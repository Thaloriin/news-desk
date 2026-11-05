const { db } = require("../src/db");

const total = db.prepare("SELECT COUNT(*) c FROM items").get().c;
const days = db.prepare("SELECT day, COUNT(*) c FROM items GROUP BY day ORDER BY day DESC LIMIT 5").all();
const htmlRows = db.prepare(`
  SELECT id, title, summary FROM items
  WHERE summary LIKE '%<%' OR summary LIKE '%&lt;%' OR summary LIKE '%href=%' OR summary LIKE '%&amp;%'
`).all();
const dist = db.prepare("SELECT COALESCE(country,'全球') k, COUNT(*) c FROM items GROUP BY k ORDER BY c DESC LIMIT 12").all();

console.log("总数:", total);
console.log("按天:", days.map(d => `${d.day}=${d.c}`).join("  "));
console.log("地区:", dist.map(d => `${d.k}=${d.c}`).join("  "));
console.log("仍含 HTML 残留:", htmlRows.length);
for (const r of htmlRows.slice(0, 5)) console.log("  ·", (r.summary || "").slice(0, 100));
