const api = require("../../utils/api");

Page({
  data: {
    baseUrl: "",
    stats: null,
    msg: ""
  },

  onLoad() {
    this.setData({ baseUrl: getApp().globalData.baseUrl });
    this.loadStats();
  },

  onInput(e) {
    this.setData({ baseUrl: e.detail.value });
  },

  async save() {
    const url = this.data.baseUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\//.test(url)) {
      this.setData({ msg: "地址要以 http:// 或 https:// 开头" });
      return;
    }
    getApp().globalData.baseUrl = url;
    wx.setStorageSync("baseUrl", url);
    this.setData({ msg: "已保存，正在测试连接…" });
    await this.loadStats();
  },

  async loadStats() {
    try {
      const s = await api.stats();
      this.setData({
        stats: s,
        msg: `连接成功：${s.total} 条数据，${s.srcs ? s.srcs.length : 0} 个来源`
      });
    } catch (e) {
      this.setData({ stats: null, msg: "连接失败：" + e.message });
    }
  },

  // 常用地址：本机、局域网提示
  fillLocal() {
    this.setData({ baseUrl: "http://localhost:8787" });
  }
});
