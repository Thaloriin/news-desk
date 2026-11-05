const { XMLParser } = require("fast-xml-parser");
const crypto = require("crypto");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  trimValues: true,
  // Guardian 等源的 XML 实体数量超过默认上限（1000），关掉自动展开，由 stripHtml 自行解码
  processEntities: false
});

function textOf(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return textOf(node[0]);
  if (node.__cdata) return String(node.__cdata);
  if (node["#text"]) return String(node["#text"]);
  return "";
}

const ENTITIES = [
  [/&nbsp;/g, " "],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&apos;/g, "'"],
  [/&rsquo;|&lsquo;|&#8216;|&#8217;/g, "'"],
  [/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"'],
  [/&mdash;|&#8212;/g, "—"],
  [/&ndash;|&#8211;/g, "–"],
  [/&hellip;|&#8230;/g, "…"],
  [/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))],
  [/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))],
  [/&amp;/g, "&"] // 必须最后，避免 &amp;lt; 被二次解码
];

function decodeEntities(s) {
  let t = String(s || "");
  for (const [re, rep] of ENTITIES) t = t.replace(re, rep);
  return t;
}

// 关键：先解码实体再去标签。
// Guardian 等源把整段 HTML 实体化后塞进 description（&lt;p&gt;...），
// 先剔标签再解码会把解码出来的真标签留在正文里。
function stripHtml(s) {
  let t = String(s || "");
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = decodeEntities(t)
      .replace(/<!\[CDATA\[|\]\]>/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ");
    if (t === before) break;
  }
  return t
    // 残缺片段：标签尖括号被吃掉后剩下的 href="..." 之类
    .replace(/\b(?:href|src|alt|title|target|rel|class|style)\s*=\s*"[^"]*"/gi, " ")
    .replace(/\b(?:href|src)\s*=\s*'[^']*'/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>?/g, " ")
    .replace(/&[a-zA-Z#0-9]{2,8};/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 截断摘要时退回到最后一个完整句子，避免译文出现半句
function trimSummary(s, max = 600) {
  const t = String(s || "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const m = cut.match(/[\s\S]*[.!?。！？]/);
  return (m ? m[0] : cut).trim();
}

function hash(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function normTitle(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 120);
}

function toISO(d) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

// 日期分组按北京时间算。直接用 UTC 会把晚上发的新闻算到前一天。
const TZ_OFFSET_MS = 8 * 3600 * 1000;
function dayOf(d) {
  const dt = new Date(d);
  const ts = isNaN(dt.getTime()) ? Date.now() : dt.getTime();
  return new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function linkOf(link) {
  if (!link) return "";
  if (typeof link === "string") return link;
  if (Array.isArray(link)) return linkOf(link[0]);
  if (link["@_href"]) return link["@_href"];
  return textOf(link);
}

function parseFeed(xml, feed) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    return [];
  }

  const now = new Date().toISOString();
  const out = [];

  // RSS 2.0 / RDF
  const channel = doc?.rss?.channel || doc?.["rdf:RDF"]?.channel || doc?.RDF?.channel;
  let entries = [];
  if (channel?.item) entries = Array.isArray(channel.item) ? channel.item : [channel.item];
  else if (doc?.["rdf:RDF"]?.item) entries = Array.isArray(doc["rdf:RDF"].item) ? doc["rdf:RDF"].item : [doc["rdf:RDF"].item];

  // Atom
  if (!entries.length) {
    const feedNode = doc?.feed;
    if (feedNode?.entry) entries = Array.isArray(feedNode.entry) ? feedNode.entry : [feedNode.entry];
  }

  for (const e of entries) {
    const title = stripHtml(textOf(e.title));
    const link = linkOf(e.link) || stripHtml(textOf(e["@_about"]));
    if (!title || !link) continue;

    const desc = stripHtml(textOf(e.description) || textOf(e.summary) || textOf(e.content));
    const pub = e.pubDate || e.published || e.updated || e["dc:date"];

    out.push({
      title,
      summary: trimSummary(desc),
      url: link,
      urlHash: hash(link.split("?")[0]),
      titleHash: hash(normTitle(title)),
      sourceId: feed.id,
      sourceName: feed.name,
      lang: feed.lang,
      publishedAt: toISO(pub),
      fetchedAt: now,
      day: dayOf(pub)
    });
  }
  return out;
}

module.exports = { parseFeed, hash, normTitle, stripHtml };
