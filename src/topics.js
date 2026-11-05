// 兴趣话题标签：从标题和摘要里识别，一条新闻可以命中多个。
// 英文关键词加词边界，避免 art 命中 artificial、ai 命中 said 这类误伤。
const TOPICS = [
  ["人工智能", [
    "artificial intelligence", "machine learning", "deep learning", "large language model",
    "llm", "gpt", "chatgpt", "openai", "deepseek", "anthropic", "claude", "gemini", "copilot",
    "neural network", "generative", "chatbot", "ai", "a.i.",
    "人工智能", "大模型", "机器学习", "深度学习", "智能体", "生成式", "算法", "算力"
  ]],
  ["游戏", [
    "video game", "gaming", "playstation", "xbox", "nintendo", "steam", "esports", "game studio",
    "game", "游戏", "电竞", "主机", "手游", "玩家", "任天堂", "索尼"
  ]],
  ["艺术", [
    "artist", "artwork", "museum", "gallery", "exhibition", "painting", "sculpture", "art",
    "艺术", "艺术家", "展览", "美术馆", "画展", "雕塑", "文物", "拍卖"
  ]],
  ["服装", [
    "fashion", "clothing", "apparel", "runway", "couture", "textile", "garment", "fashion house",
    "服装", "时尚", "时装", "面料", "秀场", "奢侈品牌", "设计师品牌"
  ]],
  ["影视", [
    "film", "movie", "cinema", "hollywood", "netflix", "box office", "tv series", "documentary",
    "影视", "电影", "票房", "剧集", "好莱坞", "电视剧", "纪录片", "院线"
  ]],
  ["音乐", [
    "music", "album", "singer", "concert", "spotify", "band", "songwriter",
    "音乐", "专辑", "演唱会", "歌手", "乐队", "单曲"
  ]],
  ["体育", [
    "sports", "football", "soccer", "basketball", "nba", "nfl", "olympic", "championship", "league",
    "体育", "足球", "篮球", "奥运", "联赛", "世界杯", "赛事"
  ]],
  ["教育", [
    "education", "university", "college", "curriculum", "teachers", "exam", "tuition",
    "教育", "大学", "高考", "学校", "升学", "留学", "教材"
  ]],
  ["医疗健康", [
    "hospital", "disease", "virus", "vaccine", "outbreak", "ebola", "cancer", "medical", "health",
    "医疗", "医院", "疫苗", "病毒", "疫情", "癌症", "疾病", "健康"
  ]],
  ["航天", [
    "nasa", "spacex", "rocket", "satellite", "orbit", "astronaut", "lunar", "mars mission",
    "航天", "火箭", "卫星", "太空", "探月", "火星"
  ]],
  ["汽车", [
    "tesla", "automaker", "electric vehicle", "car maker", "self-driving", "autonomous driving",
    "汽车", "车企", "电动车", "特斯拉", "自动驾驶", "新能源车"
  ]],
  ["芯片半导体", [
    "semiconductor", "nvidia", "tsmc", "intel", "amd", "chipmaker", "chip export", "wafer",
    "芯片", "半导体", "台积电", "英伟达", "光刻机", "晶圆"
  ]]
];

const ASCII = /^[\x20-\x7E]+$/;
const PATTERNS = TOPICS.map(([name, words]) => [
  name,
  words.map(w => {
    if (!ASCII.test(w)) return w;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z])${esc}(?:s|es)?(?![a-z])`, "i");
  })
]);

function detect(title, summary) {
  const text = `${title || ""} ${summary || ""}`;
  const hits = [];
  for (const [name, pats] of PATTERNS) {
    for (const p of pats) {
      if (typeof p === "string" ? text.includes(p) : p.test(text)) { hits.push(name); break; }
    }
  }
  return hits;
}

module.exports = { detect, TOPICS: TOPICS.map(([n]) => n) };
