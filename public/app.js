const CATS = ["all", "政治", "经济", "科技", "军事", "能源气候", "卫生", "社会", "文体", "综合"];
let state = { day: null, cat: "all", country: "all", topic: "all", stats: null, items: [], canTranslate: false, current: null };

// 两种运行方式：
// 本机 node server.js  → 走 /api 接口，能实时抓取、在线翻译
// GitHub Pages 静态托管 → 读同目录 data/*.json，没有后端
let STATIC = false;
const dayCache = new Map();

const $ = (id) => document.getElementById(id);

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderTabs() {
  const t = $("tabs");
  t.innerHTML = "";
  for (const c of CATS) {
    const b = document.createElement("button");
    b.className = "tab" + (state.cat === c ? " on" : "");
    b.textContent = c === "all" ? "全部" : c;
    b.onclick = () => { state.cat = c; renderTabs(); load(); };
    t.appendChild(b);
  }
}

function renderCountries(countries) {
  const box = $("countries");
  box.innerHTML = "";
  const all = document.createElement("button");
  all.className = "chip" + (state.country === "all" ? " on" : "");
  all.textContent = "全部地区";
  all.onclick = () => { state.country = "all"; load(); };
  box.appendChild(all);

  for (const c of countries.slice(0, 12)) {
    const b = document.createElement("button");
    b.className = "chip" + (state.country === c.k ? " on" : "");
    b.textContent = `${c.k} ${c.c}`;
    b.onclick = () => { state.country = c.k; load(); };
    box.appendChild(b);
  }
}

function renderTopics(topics) {
  const box = $("topics");
  box.innerHTML = "";
  const all = document.createElement("button");
  all.className = "chip interest" + (state.topic === "all" ? " on" : "");
  all.textContent = "全部话题";
  all.onclick = () => { state.topic = "all"; load(); };
  box.appendChild(all);

  for (const t of topics.slice(0, 12)) {
    const b = document.createElement("button");
    b.className = "chip interest" + (state.topic === t.k ? " on" : "");
    b.textContent = `${t.k} ${t.c}`;
    b.onclick = () => { state.topic = t.k; load(); };
    box.appendChild(b);
  }
}

function renderDays() {
  const sel = $("day");
  const list = state.stats?.days || [];
  const days = list.map(d => d.day);
  if (!days.length) days.push(new Date().toISOString().slice(0, 10));

  // 刚过零点时"今天"只有几条，默认退到上一天，避免打开就是空列表
  if (!state.day) {
    const newest = list[0];
    state.day = (newest && newest.c < 20 && list[1]) ? list[1].day : days[0];
  }

  sel.innerHTML = days.map(d => `<option value="${d}">${d}</option>`).join("");
  sel.value = state.day;
  sel.onchange = () => { state.day = sel.value; load(); };
}

function renderList(items) {
  $("list").innerHTML = items.map((it, i) => {
    const hot = it.cluster_size > 1 ? `<span class="hot">${it.cluster_size} 家媒体报道</span>` : "";
    return `
      <li class="item">
        <div class="rank">${String(i + 1).padStart(2, "0")}</div>
        <div class="body">
          <h2><a href="#" data-id="${it.id}">${esc(it.title)}</a></h2>
          <div class="meta">
            <span class="tag">${esc(it.category || "未分类")}</span>
            <span class="country">${esc(it.country || "")}</span>
            <span>${esc(it.source_name || "")}</span>
            <span>${fmtTime(it.published_at)}</span>
            ${hot}
          </div>
          ${it.summary ? `<p class="desc">${esc(it.summary).slice(0, 180)}</p>` : ""}
          <div class="score">
            <div class="track"><div class="fill" style="width:${Math.min(100, it.score)}%"></div></div>
            <span class="num">重要度 ${it.score}</span>
          </div>
        </div>
      </li>`;
  }).join("");

  $("list").querySelectorAll("a[data-id]").forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const it = state.items.find(x => String(x.id) === a.dataset.id);
      if (it) openReader(it);
    };
  });
}

function applyFacets(facets) {
  renderCountries((facets && facets.countries) || []);
  renderTopics((facets && facets.topics) || []);
}

// 静态模式：每次只加载一天的全量数据，筛选在浏览器里做
async function loadStatic() {
  const day = state.day || (state.stats.days[0] && state.stats.days[0].day);
  let d = dayCache.get(day);
  if (!d) {
    d = await fetch(`data/${day}.json`).then(r => r.json());
    dayCache.set(day, d);
  }
  state.day = day;

  let items = d.items || [];
  if (state.cat !== "all") items = items.filter(x => x.category === state.cat);
  if (state.country !== "all") items = items.filter(x => x.country === state.country);
  if (state.topic !== "all") items = items.filter(x => (x.topics || []).includes(state.topic));
  state.items = items.slice(0, 80);

  $("count").textContent = `${day}　共 ${state.items.length} 条`;
  $("empty").hidden = state.items.length > 0;
  applyFacets(d.facets);
  renderList(state.items);
}

async function load() {
  if (STATIC) return loadStatic();

  const q = new URLSearchParams({ category: state.cat, country: state.country, topic: state.topic, limit: "80" });
  if (state.day) q.set("day", state.day);
  const data = await fetch("/api/news?" + q).then(r => r.json());
  state.day = data.day;
  state.items = data.items;
  state.canTranslate = data.canTranslate;
  state.autoTranslate = Boolean(data.autoTranslate);

  $("count").textContent = `${data.day}　共 ${data.count} 条`;
  $("empty").hidden = data.items.length > 0;
  applyFacets(data.facets);
  renderList(data.items);
}

/* ---------- 全屏阅读：字幕式逐句对照 ---------- */
function splitSentences(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.match(/[^.!?。！？]+[.!?。！？]?/g) || [t];
  return parts.map(s => s.trim()).filter(Boolean).slice(0, 10);
}

function renderBlocks(pairs) {
  const box = $("rBlocks");
  box.innerHTML = pairs.map(p => `
    <p class="en">${esc(p.en)}</p>
    ${p.zh ? `<p class="zh">${esc(p.zh)}</p>` : ""}
  `).join("");
}

function openReader(it) {
  state.current = { ...it };
  $("reader").hidden = false;
  document.body.style.overflow = "hidden";

  $("rMeta").textContent = `${it.category} · ${it.country || ""} · ${it.source_name} · ${fmtTime(it.published_at)}`;
  $("rLink").href = it.url;
  $("enTitle").textContent = it.title;
  $("zhTitle").textContent = it.title_zh || "";

  // 有缓存就渲染对照，没有就只显示原文句子
  if (it.blocks) {
    renderBlocks(it.blocks);
  } else if (it.title_zh && it.summary_zh) {
    renderBlocks(splitSentences(it.summary).map((en, i, arr) => ({ en, zh: "" })));
  } else {
    renderBlocks(splitSentences(it.summary).map(en => ({ en, zh: "" })));
  }

  if (STATIC) {
    $("zHint").textContent = it.title_zh
      ? ""
      : "这一条还没有译文。静态版每天只预翻译重要性最高的一部分，点「原文」可读全文。";
    $("btnTranslate").disabled = true;
    $("btnTranslate").textContent = it.title_zh ? "已翻译" : "无译文";
  } else {
    $("zHint").textContent = it.title_zh
      ? ""
      : (state.canTranslate ? "点右上角「翻译成中文」，逐句对照" : "未配置 AI，暂时只能看原文。可到工作台填写 Key。");
    $("btnTranslate").disabled = Boolean(it.title_zh) || !state.canTranslate;
    $("btnTranslate").textContent = it.title_zh ? "已翻译" : "翻译成中文";
  }
  $("autoToggle").checked = Boolean(state.autoTranslate);

  // 自动翻译：打开即翻译，已有缓存则直接显示
  if (state.autoTranslate && state.canTranslate && !it.title_zh) {
    setTimeout(() => doTranslate(), 60);
  }
}

function closeReader() {
  $("reader").hidden = true;
  document.body.style.overflow = "";
  state.current = null;
}

$("rClose").onclick = closeReader;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeReader(); });

async function doTranslate() {
  const it = state.current;
  if (!it || it._translating) return;
  if (STATIC) return;
  it._translating = true;
  const btn = $("btnTranslate");
  btn.disabled = true;
  btn.textContent = "翻译中…";
  try {
    const r = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: it.id })
    }).then(x => x.json());
    if (r.error) throw new Error(r.error);

    $("zhTitle").textContent = r.title?.zh || "";
    renderBlocks(r.blocks || []);
    $("zHint").textContent = r.cached ? "（已缓存的译文）" : "";
    btn.textContent = "已翻译";

    it.title_zh = r.title?.zh || "";
    it.blocks = r.blocks || [];
    const row = state.items.find(x => x.id === it.id);
    if (row) { row.title_zh = it.title_zh; row.blocks = it.blocks; }
  } catch (e) {
    $("zHint").textContent = "翻译失败：" + e.message;
    btn.disabled = false;
    btn.textContent = "重试";
  } finally {
    it._translating = false;
  }
}

$("btnTranslate").onclick = doTranslate;

$("autoToggle").onchange = async (e) => {
  state.autoTranslate = e.target.checked;
  try {
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoTranslate: state.autoTranslate })
    });
  } catch { /* 离线时只影响本次会话 */ }
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function boot() {
  let s = null;

  try {
    const r = await fetch("/api/stats");
    if (!r.ok) throw new Error("no-api");
    s = await r.json();
  } catch {
    // 没有后端 → 静态托管模式
    STATIC = true;
    document.body.classList.add("is-static");
    document.querySelectorAll("[data-live-only]").forEach(el => { el.hidden = true; });
    const idx = await fetch("data/index.json").then(x => x.json());
    s = { days: idx.days || [], total: idx.total || 0, srcs: idx.srcs || [], llm: false, model: null };
    $("sub").textContent = `静态版 · 更新于 ${new Date(idx.generatedAt).toLocaleString("zh-CN")}`;
    $("empty").textContent = "这一天还没有数据。";
  }

  state.stats = s;
  renderTabs();
  renderDays();

  $("engine").textContent = STATIC
    ? "每小时的自动抓取结果，预译文可直接对照"
    : (s.llm ? `AI 打分：${s.model}` : "评分方式：启发式（未配置 AI）");
  $("srcs").textContent = `来源 ${s.srcs.length} 家　累计 ${s.total} 条`;
  await load();
}

$("refresh").onclick = async () => {
  const b = $("refresh");
  b.disabled = true; b.textContent = "抓取中…";
  try {
    const rep = await fetch("/api/admin/collect", { method: "POST" }).then(r => r.json());
    const s = await fetch("/api/stats").then(x => x.json());
    state.stats = s; renderDays(); await load();
    alert(`抓取完成\n成功 ${rep.ok}/${rep.feeds} 个源\n抓取 ${rep.fetched} 条，入库 ${rep.inserted} 条\n耗时 ${Math.round(rep.ms / 1000)} 秒`);
  } catch (e) { alert("抓取失败：" + e.message); }
  finally { b.disabled = false; b.textContent = "抓取"; }
};

boot();
