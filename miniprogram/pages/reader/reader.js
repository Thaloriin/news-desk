const api = require("../../utils/api");

function splitSentences(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.match(/[^.!?。！？]+[.!?。！？]?/g) || [t];
  return parts.map(s => s.trim()).filter(Boolean).slice(0, 10);
}

Page({
  data: {
    item: null,
    titleZh: "",
    blocks: [],
    hint: "",
    translating: false,
    canTranslate: false
  },

  onLoad() {
    const item = getApp().globalData.current;
    if (!item) {
      wx.navigateBack();
      return;
    }
    const blocks = (item.blocks && item.blocks.length)
      ? item.blocks
      : splitSentences(item.summary).map(en => ({ en, zh: "" }));

    this.setData({
      item,
      titleZh: item.title_zh || "",
      blocks,
      hint: item.title_zh ? "" : "点上方按钮翻译，逐句对照"
    });
    wx.setNavigationBarTitle({ title: item.category || "新闻详情" });

    api.stats().then(s => {
      this.setData({ canTranslate: s.llm });
      // 服务端开了自动翻译，且这条还没译文，就自动翻
      if (s.autoTranslate && s.llm && !item.title_zh) this.translate();
    }).catch(() => {});
  },

  async translate() {
    if (this.data.translating) return;
    this.setData({ translating: true, hint: "翻译中…" });
    try {
      const r = await api.translate(this.data.item.id);
      this.setData({
        titleZh: (r.title && r.title.zh) || "",
        blocks: r.blocks || [],
        hint: "",
        translating: false
      });
      const item = this.data.item;
      item.title_zh = (r.title && r.title.zh) || "";
      item.blocks = r.blocks || [];
      getApp().globalData.current = item;
    } catch (e) {
      this.setData({ translating: false, hint: "翻译失败：" + e.message });
    }
  },

  copyLink() {
    wx.setClipboardData({ data: this.data.item.url });
  }
});
