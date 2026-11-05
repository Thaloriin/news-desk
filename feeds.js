// 新闻源清单。weight 是来源权威度，0.5–1.0，参与重要性评分。
// 只放 RSS/Atom，不爬正文，只存标题、摘要、链接。
module.exports = [
  { id: "bbc-world",   name: "BBC World",      url: "http://feeds.bbci.co.uk/news/world/rss.xml",       weight: 0.95, lang: "en", region: "英国" },
  { id: "bbc-biz",     name: "BBC Business",   url: "http://feeds.bbci.co.uk/news/business/rss.xml",    weight: 0.9,  lang: "en", region: "英国" },
  { id: "guardian-w",  name: "The Guardian",   url: "https://www.theguardian.com/world/rss",            weight: 0.9,  lang: "en", region: "英国" },
  { id: "aljazeera",   name: "Al Jazeera",     url: "https://www.aljazeera.com/xml/rss/all.xml",        weight: 0.85, lang: "en", region: "中东" },
  { id: "npr",         name: "NPR",            url: "https://feeds.npr.org/1001/rss.xml",               weight: 0.85, lang: "en", region: "美国" },
  { id: "nyt-world",   name: "NYT World",      url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", weight: 0.95, lang: "en", region: "美国" },
  { id: "techcrunch",  name: "TechCrunch",     url: "https://techcrunch.com/feed/",                     weight: 0.75, lang: "en", region: "美国" },
  { id: "hn",          name: "Hacker News",    url: "https://hnrss.org/frontpage",                      weight: 0.6,  lang: "en", region: "全球" },
  { id: "ifanr",       name: "爱范儿",          url: "https://www.ifanr.com/feed",                        weight: 0.7,  lang: "zh", region: "中国" },
  { id: "sspai",       name: "少数派",          url: "https://sspai.com/feed",                            weight: 0.65, lang: "zh", region: "中国" },
  { id: "cnbeta",      name: "cnBeta",         url: "https://www.cnbeta.com.tw/backend.php",             weight: 0.65, lang: "zh", region: "中国" },
  { id: "dw",          name: "DW",             url: "https://rss.dw.com/rdf/rss-en-world",              weight: 0.85, lang: "en", region: "德国" },
  { id: "france24",    name: "France 24",      url: "https://www.france24.com/en/rss",                  weight: 0.8,  lang: "en", region: "法国" },
  { id: "scmp",        name: "SCMP",           url: "https://www.scmp.com/rss/91/feed",                 weight: 0.8,  lang: "en", region: "中国香港" }
];
