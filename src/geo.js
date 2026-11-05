// 从标题/摘要里识别涉及国家与地区；识别不到时回落到来源所在地区。
const MAP = [
  // 注意：不要用裸 "us"，它会命中英文代词 us/tell us，把大量无关新闻判成美国
  ["美国", ["united states","u.s.","usa","washington","white house","pentagon","trump","biden","democrats","republicans","congress","senate","federal reserve","american","美国人","美国","美方","华盛顿","白宫"]],
  ["中国", ["china","chinese","beijing","shanghai","xi jinping","中国","中方","北京","上海"]],
  ["俄罗斯", ["russia","russian","moscow","putin","kremlin","俄罗斯","俄方","莫斯科","普京"]],
  ["乌克兰", ["ukraine","ukrainian","kyiv","kiev","zelensky","乌克兰","基辅"]],
  ["英国", ["britain","british","uk ","london","england","starmer","英国","伦敦"]],
  ["法国", ["france","french","paris","macron","法国","巴黎"]],
  ["德国", ["germany","german","berlin","merz","德国","柏林"]],
  ["日本", ["japan","japanese","tokyo","日本","东京"]],
  ["印度", ["india","indian","delhi","modi","印度","新德里"]],
  ["伊朗", ["iran","iranian","tehran","伊朗","德黑兰"]],
  ["以色列", ["israel","israeli","jerusalem","netanyahu","以色列","耶路撒冷"]],
  ["韩国", ["south korea","korean","seoul","韩国","首尔"]],
  ["朝鲜", ["north korea","pyongyang","朝鲜","平壤"]],
  ["中国台湾", ["taiwan","taipei","台湾","台北"]],
  ["中国香港", ["hong kong","香港","港府"]],
  ["沙特", ["saudi","riyadh","沙特","利雅得"]],
  ["欧盟", ["european union","eu ","brussels","欧盟","布鲁塞尔"]],
  ["中东", ["gaza","hamas","hezbollah","lebanon","syria","iraq","加沙","哈马斯","黎巴嫩","叙利亚"]]
];

const IS_ASCII = /^[\x20-\x7E]+$/;
const PATTERNS = MAP.map(([name, words]) => [
  name,
  words.map(w => IS_ASCII.test(w)
    ? new RegExp(`\\b${w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i")
    : w)
]);

function detect(title, summary, sourceRegion) {
  const t = `${title || ""} ${summary || ""}`;
  const hits = [];
  for (const [name, pats] of PATTERNS) {
    for (const p of pats) {
      if (typeof p === "string" ? t.includes(p) : p.test(t)) { hits.push(name); break; }
    }
  }
  if (hits.length) return hits[0];           // 取第一个命中，顺序即优先级
  return sourceRegion || "全球";
}

module.exports = { detect };
