function baseUrl() {
  return getApp().globalData.baseUrl.replace(/\/$/, "");
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl() + path,
      method: options.method || "GET",
      data: options.data,
      header: { "Content-Type": "application/json" },
      timeout: 20000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error((res.data && res.data.error) || ("HTTP " + res.statusCode)));
      },
      fail: (err) => reject(new Error(err.errMsg || "网络请求失败"))
    });
  });
}

module.exports = {
  baseUrl,
  stats: () => request("/api/stats"),
  news: (params) => request("/api/news?" + Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")),
  translate: (id) => request("/api/translate", { method: "POST", data: { id } })
};
