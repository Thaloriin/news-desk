const api = require("../../utils/api");

const CATS = ["全部", "政治", "经济", "科技", "军事", "能源气候", "卫生", "社会", "文体", "综合"];

Page({
  data: {
    cats: CATS,
    cat: "全部",
    countries: [],
    country: "全部地区",
    topics: [],
    topic: "全部话题",
    days: [],
    day: "",
    items: [],
    count: 0,
    loading: true,
    error: ""
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    if (this.data.day) this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async loadStats() {
    try {
      const s = await api.stats();
      const list = s.days || [];
      const days = list.map(d => d.day);
      // 刚过零点时"今天"只有几条，自动退到上一天，避免打开就是空列表
      const newest = list[0];
      const pick = newest && newest.c < 20 && list[1] ? list[1].day : (newest ? newest.day : "");
      this.setData({ days, day: pick || new Date().toISOString().slice(0, 10) });
      await this.load();
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const d = await api.news({
        day: this.data.day,
        category: this.data.cat === "全部" ? "all" : this.data.cat,
        country: this.data.country === "全部地区" ? "all" : this.data.country,
        topic: this.data.topic === "全部话题" ? "all" : this.data.topic,
        limit: 60
      });
      const topicList = (d.facets.topics || []).map(t => t.k);
      this.setData({
        items: d.items, count: d.count, loading: false,
        countries: (d.facets.countries || []).slice(0, 12).map(c => c.k),
        topics: topicList,
        // 当前话题当天没有新闻了，退回全部，避免列表空白
        topic: topicList.includes(this.data.topic) ? this.data.topic : "全部话题"
      });
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  pickCat(e) {
    this.setData({ cat: e.currentTarget.dataset.v });
    this.load();
  },

  pickCountry(e) {
    this.setData({ country: e.currentTarget.dataset.v });
    this.load();
  },

  pickTopic(e) {
    this.setData({ topic: e.currentTarget.dataset.v });
    this.load();
  },

  pickDay(e) {
    this.setData({ day: this.data.days[e.detail.value] });
    this.load();
  },

  openItem(e) {
    const item = this.data.items[e.currentTarget.dataset.idx];
    getApp().globalData.current = item;
    wx.navigateTo({ url: "/pages/reader/reader" });
  },

  goSettings() {
    wx.navigateTo({ url: "/pages/settings/settings" });
  }
});
