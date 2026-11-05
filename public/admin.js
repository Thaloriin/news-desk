const $ = (id) => document.getElementById(id);
const TOKEN_KEY = "news_admin_token";

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const t = token();
  if (t) headers["x-admin-token"] = t;
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) {
    const input = prompt("远程访问需要管理令牌（启动服务时控制台会打印）：", token());
    if (input) { localStorage.setItem(TOKEN_KEY, input.trim()); return api(path, opts); }
    throw new Error("未授权");
  }
  return res.json();
}

function msg(el, text, ok = true) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}

let cfgData = null;

async function loadConfig() {
  cfgData = await api("/api/admin/config");
  $("baseUrl").value = cfgData.api.baseUrl || "";
  $("model").value = cfgData.api.model || "";
  $("key").value = "";
  $("autoTranslate").checked = Boolean(cfgData.autoTranslate);
  $("keyNow").textContent = cfgData.api.hasKey
    ? `当前 Key：${cfgData.api.keyMasked}（重新填写会覆盖；留空则保持不变）`
    : "当前未配置 Key，使用启发式评分。";

  const box = $("feeds");
  box.innerHTML = "";
  for (const f of cfgData.feeds) {
    const id = "f_" + f.id;
    const wrap = document.createElement("label");
    wrap.className = "feed";
    wrap.innerHTML = `<input type="checkbox" id="${id}" ${f.enabled ? "checked" : ""}>
      <span>${f.name} <small>${f.region || ""} · 权重 ${f.weight}</small></span>`;
    box.appendChild(wrap);
  }

  if (cfgData.adminToken) {
    $("tokenLine").textContent = `管理令牌：${cfgData.adminToken}（远程访问工作台时填写，本机不需要）`;
  }
}

async function loadStats() {
  const s = await fetch("/api/stats").then(r => r.json());
  $("stats").innerHTML = `
    <div class="stat"><b>${s.total}</b><span>总条数</span></div>
    <div class="stat"><b>${s.days.length}</b><span>有数据的天数</span></div>
    <div class="stat"><b>${s.srcs.length}</b><span>来源数</span></div>
    <div class="stat"><b>${s.llm ? "开" : "关"}</b><span>AI 打分</span></div>`;
  $("catBreak").textContent = "分类分布：" + s.cats.map(c => `${c.category} ${c.c}`).join("　");
}

$("saveApi").onclick = async () => {
  const body = {
    api: {
      baseUrl: $("baseUrl").value.trim(),
      model: $("model").value.trim()
    }
  };
  const k = $("key").value.trim();
  if (k) body.api.key = k;
  try {
    await api("/api/admin/config", { method: "POST", body: JSON.stringify(body) });
    msg($("apiMsg"), "已保存");
    await loadConfig();
    await loadStats();
  } catch (e) { msg($("apiMsg"), "保存失败：" + e.message, false); }
};

$("autoTranslate").onchange = async () => {
  try {
    await api("/api/admin/config", {
      method: "POST",
      body: JSON.stringify({ autoTranslate: $("autoTranslate").checked })
    });
    msg($("apiMsg"), $("autoTranslate").checked ? "自动翻译已开启" : "自动翻译已关闭");
  } catch (e) {
    msg($("apiMsg"), "保存失败：" + e.message, false);
  }
};

$("testApi").onclick = async () => {
  msg($("apiMsg"), "测试中…");
  try {
    const r = await api("/api/admin/llm-test", { method: "POST" });
    if (r.ok) msg($("apiMsg"), `连接正常，${r.ms} ms，模型回复：${r.reply}`);
    else msg($("apiMsg"), "连接失败：" + (r.error || "未知错误"), false);
  } catch (e) { msg($("apiMsg"), "连接失败：" + e.message, false); }
};

$("saveFeeds").onclick = async () => {
  const disabled = cfgData.feeds.filter(f => !$("f_" + f.id).checked).map(f => f.id);
  try {
    await api("/api/admin/config", { method: "POST", body: JSON.stringify({ feedsDisabled: disabled }) });
    msg($("feedMsg"), `已保存，禁用 ${disabled.length} 个源`);
    await loadConfig();
  } catch (e) { msg($("feedMsg"), "保存失败：" + e.message, false); }
};

$("collect").onclick = async () => {
  const b = $("collect");
  b.disabled = true;
  msg($("collectMsg"), "抓取中…");
  try {
    const r = await api("/api/admin/collect", { method: "POST" });
    msg($("collectMsg"), `完成：${r.ok}/${r.feeds} 个源，抓取 ${r.fetched} 条，入库 ${r.inserted} 条，${Math.round(r.ms / 1000)} 秒${r.failed.length ? "；失败 " + r.failed.length : ""}`);
    await loadStats();
  } catch (e) { msg($("collectMsg"), "失败：" + e.message, false); }
  finally { b.disabled = false; }
};

loadConfig().then(loadStats).catch(e => {
  document.body.insertAdjacentHTML("afterbegin", `<p style="padding:16px;color:#a33">${e.message}</p>`);
});
