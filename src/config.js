// 运行时配置：AI key、数据源开关等，保存在 data/config.json，改完即时生效。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, "config.json");

const DEFAULTS = {
  api: {
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    key: process.env.LLM_API_KEY || ""
  },
  feedsDisabled: [],
  autoTranslate: false,   // 打开阅读页时自动翻译
  adminToken: ""
};

function load() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    cfg = JSON.parse(JSON.stringify(DEFAULTS));
  }
  cfg.api = Object.assign({}, DEFAULTS.api, cfg.api || {});
  cfg.feedsDisabled = Array.isArray(cfg.feedsDisabled) ? cfg.feedsDisabled : [];
  if (!cfg.adminToken) {
    cfg.adminToken = crypto.randomBytes(12).toString("hex");
    save(cfg);
  }
  return cfg;
}

function save(cfg) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), "utf8");
  return cfg;
}

function mask(k) {
  if (!k) return "";
  if (k.length <= 8) return "****";
  return k.slice(0, 4) + "****" + k.slice(-4);
}

// 给前端看的版本：key 打码
function publicView() {
  const c = load();
  return {
    api: { baseUrl: c.api.baseUrl, model: c.api.model, keyMasked: mask(c.api.key), hasKey: Boolean(c.api.key) },
    feedsDisabled: c.feedsDisabled,
    autoTranslate: Boolean(c.autoTranslate)
  };
}

function update(patch) {
  const c = load();
  if (patch.api) {
    if (typeof patch.api.baseUrl === "string") c.api.baseUrl = patch.api.baseUrl.trim();
    if (typeof patch.api.model === "string") c.api.model = patch.api.model.trim();
    // 只有传入非空的 key 才覆盖；传空字符串表示清除
    if (typeof patch.api.key === "string") c.api.key = patch.api.key.trim();
  }
  if (Array.isArray(patch.feedsDisabled)) c.feedsDisabled = patch.feedsDisabled;
  if (typeof patch.autoTranslate === "boolean") c.autoTranslate = patch.autoTranslate;
  return save(c);
}

function llm() {
  const c = load();
  return { enabled: Boolean(c.api.key), baseUrl: c.api.baseUrl, model: c.api.model, key: c.api.key };
}

module.exports = { load, save, update, publicView, mask, llm, FILE };
