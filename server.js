const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const proxy = require("./src/proxy");
proxy.setup();

const db = require("./src/db");
const cfg = require("./src/config");
const collect = require("./src/collect");
const llm = require("./src/llm");
const FEEDS = require("./feeds");

const PORT = process.env.PORT || 8787;
const PUB = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8"
};

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function isLocal(req) {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// 管理接口：本机放开；远程必须带 token
function canAdmin(req) {
  if (isLocal(req)) return true;
  const token = req.headers["x-admin-token"];
  return Boolean(token) && token === cfg.load().adminToken;
}

function body(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", c => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname;

  try {
    // ---------- 公开接口 ----------
    if (p === "/api/news") {
      const stats = db.stats();
      const day = u.query.day || (stats.days[0] && stats.days[0].day) || new Date().toISOString().slice(0, 10);
      const rows = db.query({
        day, category: u.query.category || "all", country: u.query.country || "all",
        topic: u.query.topic || "all",
        limit: Math.min(Number(u.query.limit) || 80, 300)
      });
      return json(res, 200, {
        day, count: rows.length, items: rows,
        facets: db.facets(day),
        canTranslate: llm.enabled(),
        autoTranslate: Boolean(cfg.load().autoTranslate)
      });
    }

    if (p === "/api/translate" && req.method === "POST") {
      const { id } = await body(req);
      const row = db.getById(Number(id));
      if (!row) return json(res, 404, { error: "条目不存在" });

      if (row.blocks_json) {
        let blocks = [];
        try { blocks = JSON.parse(row.blocks_json); } catch { blocks = []; }
        return json(res, 200, {
          cached: true,
          title: { en: row.title, zh: row.title_zh || "" },
          blocks
        });
      }

      try {
        const tr = await llm.translate(row.title, row.summary || "");
        const summaryZh = tr.blocks.map(b => b.zh).filter(Boolean).join(" ");
        db.setTranslation(row.id, tr.title.zh, summaryZh, tr.blocks);
        return json(res, 200, { cached: false, ...tr });
      } catch (e) {
        return json(res, 400, { error: String(e.message).slice(0, 200) });
      }
    }

    // 本机模式：按当前筛选条件现场生成总结
    if (p === "/api/digest" && req.method === "POST") {
      const b = await body(req);
      const stats = db.stats();
      const day = b.day || (stats.days[0] && stats.days[0].day) || new Date().toISOString().slice(0, 10);
      const rows = db.query({
        day,
        category: b.category || "all",
        country: b.country || "all",
        topic: b.topic || "all",
        limit: 60
      });

      if (!rows.length) {
        return json(res, 200, { summary: "这个条件下没有新闻可总结。", points: [], picks: [] });
      }

      try {
        const d = await llm.digest(rows.slice(0, 25));
        return json(res, 200, d || { summary: "没有生成总结", points: [], picks: [] });
      } catch (e) {
        return json(res, 400, { error: String(e.message).slice(0, 200) });
      }
    }

    if (p === "/api/stats") {
      return json(res, 200, {
        ...db.stats(),
        llm: llm.enabled(),
        model: llm.enabled() ? llm.modelName() : null,
        feeds: FEEDS.length,
        feedsDisabled: cfg.load().feedsDisabled.length,
        autoTranslate: Boolean(cfg.load().autoTranslate),
        proxy: proxy.status()
      });
    }

    // ---------- 管理接口 ----------
    if (p.startsWith("/api/admin/")) {
      if (!canAdmin(req)) return json(res, 401, { error: "需要管理令牌" });

      if (p === "/api/admin/config" && req.method === "GET") {
        return json(res, 200, {
          ...cfg.publicView(),
          adminToken: isLocal(req) ? cfg.load().adminToken : undefined,
          feeds: FEEDS.map(f => ({
            id: f.id, name: f.name, weight: f.weight, region: f.region,
            enabled: !cfg.load().feedsDisabled.includes(f.id)
          }))
        });
      }

      if (p === "/api/admin/config" && req.method === "POST") {
        const patch = await body(req);
        cfg.update(patch);
        return json(res, 200, { ok: true, config: cfg.publicView() });
      }

      if (p === "/api/admin/llm-test" && req.method === "POST") {
        if (!llm.enabled()) return json(res, 400, { ok: false, error: "尚未填写 API Key" });
        try {
          return json(res, 200, await llm.ping());
        } catch (e) {
          return json(res, 200, { ok: false, error: String(e.message).slice(0, 200) });
        }
      }

      if (p === "/api/admin/collect" && req.method === "POST") {
        return json(res, 200, await collect.run());
      }

      return json(res, 404, { error: "not found" });
    }

    // ---------- 静态文件 ----------
    let file = p === "/" ? "/index.html" : p;
    const full = path.join(PUB, file);
    if (full.startsWith(PUB) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
      return res.end(fs.readFileSync(full));
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: String(e.message) });
  }
});

server.listen(PORT, () => {
  const c = cfg.load();
  console.log(`新闻台已启动: http://localhost:${PORT}`);
  console.log(`工作台:     http://localhost:${PORT}/admin.html`);
  console.log(`AI 打分:    ${c.api.key ? "已配置 " + c.api.model : "未配置（启发式评分）"}`);
  console.log(`管理令牌:   ${c.adminToken}　（远程访问时使用，本机免填）`);
});
