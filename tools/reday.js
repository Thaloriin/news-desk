// 把已有数据的分组日期从 UTC 改成北京时间
const { db } = require("../src/db");

const TZ_OFFSET_MS = 8 * 3600 * 1000;
const rows = db.prepare("SELECT id, published_at, day FROM items").all();
const up = db.prepare("UPDATE items SET day=? WHERE id=?");

let changed = 0;
for (const r of rows) {
  const dt = new Date(r.published_at);
  if (isNaN(dt.getTime())) continue;
  const day = new Date(dt.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
  if (day !== r.day) { up.run(day, r.id); changed++; }
}

console.log(`重算 ${rows.length} 条，日期变更 ${changed} 条`);
const days = db.prepare("SELECT day, COUNT(*) c FROM items GROUP BY day ORDER BY day DESC LIMIT 6").all();
console.log(days.map(d => `${d.day}=${d.c}`).join("  "));
