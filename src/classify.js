// 分类：关键词词典做粗分类。英文词用词边界匹配，避免 ai 命中 said、war 命中 toward。
const TAXONOMY = {
  "政治": ["election","vote","president","prime minister","parliament","senate","congress","diplomat","sanction","treaty","summit","government","minister","policy",
    "选举","总统","议会","外交","制裁","峰会","政府","政策","首相","人大","政协","国务院","官员","法规","议案","执政","反对党"],
  "经济": ["economy","inflation","gdp","market","stocks","trade","tariff","central bank","interest rate","recession","jobs","unemployment","earnings",
    "经济","通胀","股市","贸易","关税","央行","利率","衰退","就业","营收","上市","财报","融资","投资","消费","价格","涨价","降价","银行","货币","利润","市值","并购"],
  "科技": ["artificial intelligence","chip","semiconductor","software","cyber","robot","technology","startup","ai model","open source","5g",
    "人工智能","芯片","半导体","软件","初创","网络安全","机器人","科技","手机","电脑","互联网","大模型","算法","开源","处理器","显卡","云计算","电商","直播","应用","系统","数码"],
  "军事": ["military","missile","drone","troops","ceasefire","nato","defense","war","attack","strike",
    "军事","导弹","无人机","停火","军队","国防","战争","演习","武器","航母","战机","冲突","空袭","部队","军演"],
  "能源气候": ["oil","opec","energy","climate","carbon","emissions","renewable","solar","nuclear","gas prices",
    "石油","天然气","能源","气候","碳","可再生","太阳能","核","电力","煤炭","新能源","排放","风电","光伏"],
  "卫生": ["health","hospital","virus","disease","vaccine","outbreak","covid","medical",
    "卫生","医院","病毒","疾病","疫苗","疫情","医疗","医保","药物","感染"],
  "社会": ["protest","crime","police","court","education","housing","migration","refugee","accident","flood","fire",
    "抗议","犯罪","警察","法院","教育","住房","移民","难民","事故","案件","警方","学生","校园","居民","火灾","交通","坠机","袭击"],
  "文体": ["film","music","sport","olympiad","football","basketball","festival","award",
    "游戏","主机","电影","音乐","体育","奥运","足球","篮球","艺术","颁奖","票房","演唱会","比赛","球队","综艺","剧集"]
};

const IS_ASCII = /^[\x20-\x7E]+$/;

// 预编译：英文用词边界，中文用 includes
const COMPILED = {};
for (const [cat, words] of Object.entries(TAXONOMY)) {
  COMPILED[cat] = words.map(w => IS_ASCII.test(w)
    // 允许复数：election → elections，sanction → sanctions
    ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i")
    : w);
}

function count(text, patterns) {
  const t = String(text || "");
  let n = 0;
  for (const p of patterns) {
    if (typeof p === "string") { if (t.includes(p)) n++; }
    else if (p.test(t)) n++;
  }
  return n;
}

function classify(title, summary) {
  let best = "综合", bestScore = 0;
  const detail = {};
  for (const [cat, pats] of Object.entries(COMPILED)) {
    const s = count(title, pats) * 2 + count(summary, pats);
    detail[cat] = s;
    if (s > bestScore) { bestScore = s; best = cat; }
  }
  return { category: best, confidence: bestScore, detail };
}

module.exports = { classify, TAXONOMY };
