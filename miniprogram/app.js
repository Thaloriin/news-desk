App({
  globalData: {
    // 开发阶段用局域网地址，并勾选「不校验合法域名」
    // 上线必须换成已备案的 https 域名，并在微信后台配置 request 合法域名
    baseUrl: "http://localhost:8787",
    current: null
  },
  onLaunch() {
    const saved = wx.getStorageSync("baseUrl");
    if (saved) this.globalData.baseUrl = saved;
  }
});
