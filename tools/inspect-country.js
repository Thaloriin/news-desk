const { db } = require("../src/db");

const dist = db.prepare("SELECT COALESCE(country,'全球') k, COUNT(*) c FROM items GROUP BY k ORDER BY c DESC").all();
console.log(dist.map(x => `${x.k}=${x.c}`).join("  "));

const weak = db.prepare(`
  SELECT id, title FROM items
  WHERE country = '美国'
    AND lower(title) NOT LIKE '%united states%'
    AND lower(title) NOT LIKE '%u.s.%'
    AND lower(title) NOT LIKE '%washington%'
    AND lower(title) NOT LIKE '%america%'
    AND lower(title) NOT LIKE '%trump%'
    AND lower(title) NOT LIKE '%congress%'
    AND lower(title) NOT LIKE '%pentagon%'
    AND lower(title) NOT LIKE '%white house%'
    AND lower(title) NOT LIKE '%senate%'
    AND lower(title) NOT LIKE '%federal%'
`).all();

console.log(`\n疑似被 "us" 误判为美国：${weak.length} 条`);
for (const w of weak.slice(0, 10)) console.log("  ·", w.title.slice(0, 90));
