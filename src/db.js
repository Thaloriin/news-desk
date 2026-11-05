const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "news.db"));

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash     TEXT UNIQUE,
  title_hash   TEXT,
  title        TEXT NOT NULL,
  summary      TEXT,
  url          TEXT NOT NULL,
  source_id    TEXT,
  source_name  TEXT,
  lang         TEXT,
  published_at TEXT,
  fetched_at   TEXT,
  category     TEXT,
  cluster_id   INTEGER,
  cluster_size INTEGER DEFAULT 1,
  score        REAL DEFAULT 0,
  score_parts  TEXT,
  llm_score    REAL,
  llm_reason   TEXT,
  day          TEXT
);
CREATE INDEX IF NOT EXISTS idx_day   ON items(day);
CREATE INDEX IF NOT EXISTS idx_cat   ON items(category);
CREATE INDEX IF NOT EXISTS idx_score ON items(score DESC);
CREATE INDEX IF NOT EXISTS idx_thash ON items(title_hash);
`);

// 增量迁移：老库补列
for (const col of ["country TEXT", "title_zh TEXT", "summary_zh TEXT", "blocks_json TEXT", "topics TEXT"]) {
  try { db.exec(`ALTER TABLE items ADD COLUMN ${col}`); } catch { /* 已存在 */ }
}
db.exec("CREATE INDEX IF NOT EXISTS idx_country ON items(country)");

function upsert(item) {
  const stmt = db.prepare(`
    INSERT INTO items
      (url_hash,title_hash,title,summary,url,source_id,source_name,lang,
       published_at,fetched_at,category,score,score_parts,day,country,topics)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(url_hash) DO UPDATE SET
      title=excluded.title, summary=excluded.summary, category=excluded.category,
      score=excluded.score, score_parts=excluded.score_parts, day=excluded.day,
      country=COALESCE(items.country, excluded.country), topics=excluded.topics
  `);
  stmt.run(item.urlHash, item.titleHash, item.title, item.summary || "", item.url,
    item.sourceId, item.sourceName, item.lang, item.publishedAt, item.fetchedAt,
    item.category, item.score || 0, JSON.stringify(item.scoreParts || {}), item.day,
    item.country || null, JSON.stringify(item.topics || []));
}

function all() {
  return db.prepare("SELECT * FROM items").all();
}

function byDay(day) {
  return db.prepare("SELECT * FROM items WHERE day = ? ORDER BY score DESC").all(day);
}

function query({ day, category, country, topic, limit = 100, minScore = 0 }) {
  let sql = "SELECT * FROM items WHERE day = ? AND score >= ?";
  const args = [day, minScore];
  if (category && category !== "all") { sql += " AND category = ?"; args.push(category); }
  if (country && country !== "all") { sql += " AND country = ?"; args.push(country); }
  if (topic && topic !== "all") { sql += " AND topics LIKE ?"; args.push(`%"${topic}"%`); }
  sql += " ORDER BY score DESC LIMIT ?";
  args.push(limit);
  return db.prepare(sql).all(...args);
}

function facets(day) {
  const cats = db.prepare("SELECT category k, COUNT(*) c FROM items WHERE day=? GROUP BY category ORDER BY c DESC").all(day);
  const countries = db.prepare("SELECT COALESCE(country,'全球') k, COUNT(*) c FROM items WHERE day=? GROUP BY k ORDER BY c DESC").all(day);

  // 话题存在 JSON 数组里，一条可以命中多个，逐行统计
  const rows = db.prepare("SELECT topics FROM items WHERE day=? AND topics IS NOT NULL").all(day);
  const count = new Map();
  for (const r of rows) {
    let list = [];
    try { list = JSON.parse(r.topics); } catch { list = []; }
    for (const t of list) count.set(t, (count.get(t) || 0) + 1);
  }
  const topics = [...count.entries()]
    .map(([k, c]) => ({ k, c }))
    .sort((a, b) => b.c - a.c);

  return { categories: cats, countries, topics };
}

function getById(id) {
  return db.prepare("SELECT * FROM items WHERE id=?").get(id);
}

function setTranslation(id, titleZh, summaryZh, blocks) {
  db.prepare("UPDATE items SET title_zh=?, summary_zh=?, blocks_json=? WHERE id=?")
    .run(titleZh, summaryZh, JSON.stringify(blocks || []), id);
}

function stats() {
  const total = db.prepare("SELECT COUNT(*) c FROM items").get().c;
  const days = db.prepare("SELECT day, COUNT(*) c FROM items GROUP BY day ORDER BY day DESC LIMIT 14").all();
  const cats = db.prepare("SELECT category, COUNT(*) c FROM items GROUP BY category ORDER BY c DESC").all();
  const srcs = db.prepare("SELECT source_name, COUNT(*) c FROM items GROUP BY source_name ORDER BY c DESC").all();
  return { total, days, cats, srcs };
}

function setCluster(id, clusterId, size) {
  db.prepare("UPDATE items SET cluster_id=?, cluster_size=? WHERE id=?").run(clusterId, size, id);
}

function setScore(id, score, parts) {
  db.prepare("UPDATE items SET score=?, score_parts=? WHERE id=?").run(score, JSON.stringify(parts), id);
}

function setLLM(id, s, reason) {
  db.prepare("UPDATE items SET llm_score=?, llm_reason=? WHERE id=?").run(s, reason, id);
}

module.exports = { db, upsert, all, byDay, query, stats, setCluster, setScore, setLLM, facets, getById, setTranslation };
