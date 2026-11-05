// 去重聚类 + 重要性评分
// 评分 = 跨源热度 30% + 来源权威 25% + 时效 15% + 实体显著性 15% + AI/启发式 15%

const ENTITIES = [
  "united states","u.s.","washington","china","beijing","russia","moscow","ukraine","european union","eu","nato",
  "japan","india","iran","israel","gaza","taiwan","korea","saudi","opec","federal reserve","fed","ecb",
  "trump","biden","putin","xi jinping","modi","macron","merz","starmer",
  "openai","nvidia","apple","google","microsoft","tesla","meta","amazon","tsmc",
  "nuclear","war","missile","sanctions","tariff","election","ceasefire",
  "中国","美国","俄罗斯","乌克兰","欧盟","北约","日本","印度","伊朗","以色列","台湾","朝鲜",
  "美联储","欧洲央行","特朗普","普京","习近平","英伟达","苹果","谷歌","微软","台积电",
  "战争","导弹","制裁","关税","大选","停火"
];

function tokens(title) {
  const t = String(title || "").toLowerCase();
  const latin = (t.match(/[a-z0-9]+/g) || []);
  const cjk = (t.match(/[一-龥]/g) || []);
  const bigrams = [];
  for (let i = 0; i < cjk.length - 1; i++) bigrams.push(cjk[i] + cjk[i + 1]);
  return new Set([...latin.filter(w => w.length > 2), ...bigrams]);
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// 简易并查集
function clusterItems(items, threshold = 0.2, minShared = 2) {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  const toks = items.map(it => tokens(it.title));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (items[i].day !== items[j].day) continue;
      let shared = 0;
      for (const x of toks[i]) if (toks[j].has(x)) shared++;
      if (shared < minShared) continue;
      if (jaccard(toks[i], toks[j]) >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  return groups;
}

const IS_ASCII = /^[\x20-\x7E]+$/;
const ENTITY_PATTERNS = ENTITIES.map(e => IS_ASCII.test(e)
  ? new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i")
  : e);

function entityScore(text) {
  const t = String(text || "");
  let n = 0;
  for (const p of ENTITY_PATTERNS) {
    if (typeof p === "string") { if (t.includes(p)) n++; }
    else if (p.test(t)) n++;
  }
  return Math.min(1, n / 4);
}

function recencyScore(publishedAt) {
  const ageH = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3600000);
  return Math.exp(-ageH / 36); // 36 小时半衰
}

function importance(item, clusterSize, sourceWeight, llmScore) {
  const c = Math.min(1, Math.log(1 + clusterSize) / Math.log(9));
  const s = sourceWeight;
  const r = recencyScore(item.publishedAt);
  const e = entityScore(item.title + " " + (item.summary || ""));
  const a = typeof llmScore === "number" ? llmScore : 0.5;

  const parts = { cluster: c, source: s, recency: r, entity: e, ai: a };
  const score = 100 * (0.30 * c + 0.25 * s + 0.15 * r + 0.15 * e + 0.15 * a);
  return { score: Math.round(score * 10) / 10, parts };
}

module.exports = { clusterItems, importance, entityScore, tokens, jaccard };
