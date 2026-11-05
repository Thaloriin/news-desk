// 检查线上数据的总结覆盖情况
require("../src/proxy").detect(true).then(async () => {
  const base = "https://thaloriin.github.io/news-desk/data/";

  async function get(path) {
    const res = await fetch(base + path, { headers: { "User-Agent": "Mozilla/5.0" } });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  const idx = await get("index.json");
  console.log("index:", idx.status);
  if (idx.json) {
    console.log("  更新时间:", idx.json.generatedAt);
    console.log("  天数:", idx.json.days.map(d => `${d.day}(${d.c})`).join(" "));
  }

  for (const d of idx.json.days) {
    const day = await get(`${d.day}.json`);
    const keys = day.json && day.json.digests ? Object.keys(day.json.digests) : [];
    console.log(`\n${d.day}: ${day.json ? day.json.items.length : 0} 条，总结 ${keys.length} 组`);
    console.log("  " + (keys.join("  ") || "（无）"));
  }
});
