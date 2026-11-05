// AI 打分。配置从 config.json 读取，工作台改完即时生效，无需重启。
const cfg = require("./config");

function settings() {
  return cfg.llm();
}

function enabled() {
  return settings().enabled;
}

function modelName() {
  return settings().model;
}

async function chat(messages, timeoutMs = 25000) {
  const s = settings();
  if (!s.key) throw new Error("未配置 API Key");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${s.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.key}` },
      body: JSON.stringify({ model: s.model, messages, temperature: 0.2 })
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status} ${t.slice(0, 120)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

async function rate(items) {
  if (!enabled() || !items.length) return null;

  const list = items.map((it, i) =>
    `${i}. [${it.source_name}] ${it.title}${it.summary ? " — " + it.summary.slice(0, 80) : ""}`
  ).join("\n");

  const prompt = `你是新闻编辑。下面是一批国际新闻标题。
对每条给出两件事：
1) importance：0 到 1 之间的小数，表示"这条新闻对全球读者的重要程度"。判断依据是影响范围、涉及的国家/机构量级、是否突发、是否有长期后果。日常商业稿、产品发布给低分（0.1–0.3），地区冲突、大国政策、重大事故给高分（0.7–1.0）。
2) category：只能是 政治/经济/科技/军事/能源气候/卫生/社会/文体 之一。

只输出 JSON 数组，不要解释，格式：
[{"i":0,"importance":0.8,"category":"政治"},...]

新闻：
${list}`;

  const raw = await chat([
    { role: "system", content: "你只输出合法 JSON，不输出任何其他文字。" },
    { role: "user", content: prompt }
  ]);

  try {
    const m = raw.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : raw);
    return arr.map(x => ({
      i: Number(x.i),
      score: Math.max(0, Math.min(1, Number(x.importance) || 0)),
      category: x.category,
      reason: x.reason || ""
    }));
  } catch {
    return null;
  }
}

// 模型偶尔重复虚词（"未解决的的"），做一次轻量收敛
function tidyZh(v) {
  return String(v || "")
    .trim()
    .replace(/的(?=的)/g, "")
    .replace(/了(?=了)/g, "")
    .replace(/([，、])\1+/g, "$1")
    .replace(/\s{2,}/g, " ");
}

// 翻译：按句切分，返回一一对应的 {en, zh} 对。
// 返回 { title: {en, zh}, blocks: [{en, zh}, ...] }
async function translate(title, summary) {
  if (!enabled()) throw new Error("未配置 API Key，无法翻译");

  const prompt = `把下面这条英文新闻按句切分，逐句翻译成简体中文，用于中英对照阅读。

要求：
- 按句子切分，英文原句与中文译文必须一一对应，顺序不变
- 人名、机构名用中文通行译名
- 不要合并句子，不要添加原文没有的内容
- 只输出 JSON，格式：
{"title":{"en":"原标题","zh":"中文标题"},"blocks":[{"en":"第一句","zh":"第一句译文"},{"en":"第二句","zh":"第二句译文"}]}
- 正文最多切 10 句，超出的部分跳过

标题：${title}
正文：${summary || "(无)"}`;

  const raw = await chat([
    { role: "system", content: "你只输出合法 JSON，不输出任何其他文字。" },
    { role: "user", content: prompt }
  ], 40000);

  const m = raw.match(/\{[\s\S]*\}/);
  const obj = JSON.parse(m ? m[0] : raw);

  const t = obj.title || {};
  const blocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  return {
    title: { en: String(t.en || title).trim(), zh: tidyZh(t.zh) },
    blocks: blocks
      .filter(b => b && (b.en || b.zh))
      .map(b => ({ en: String(b.en || "").trim(), zh: tidyZh(b.zh) }))
  };
}

// 测试连通性：发一句最短请求
async function ping() {
  const t0 = Date.now();
  const out = await chat([{ role: "user", content: "回复两个字：正常" }], 15000);
  return { ok: true, ms: Date.now() - t0, reply: String(out).trim().slice(0, 40) };
}

module.exports = { enabled, rate, ping, translate, modelName };
