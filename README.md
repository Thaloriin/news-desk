# 全球新闻台

每日抓取多个国际新闻源，自动分类，并按重要性排序。

## 快速开始

```powershell
cd E:\news-platform
npm install          # 首次
node server.js       # 启动
```

浏览器打开 <http://localhost:8787>

首页右上角「抓取」按钮 = 手动抓一次。

## 抓取逻辑

```
12 个 RSS 源 → 解析 → URL 去重 → 标题聚类 → 分类 → 打分 → SQLite
```

**自动走系统代理**：启动时读取 Windows 的代理设置（当前是 Clash 127.0.0.1:7897），
否则 BBC / NYT / Guardian 这些源直连会超时。

## 重要性怎么算

```
分数 = 100 × (0.30×跨源热度 + 0.25×来源权威 + 0.15×时效 + 0.15×实体显著性 + 0.15×AI)
```

- **跨源热度**：同一天里有多少家媒体在报同一件事（用标题词袋 Jaccard 聚类）
- **来源权威**：在 `feeds.js` 里为每个源配置的 weight
- **时效**：36 小时半衰
- **实体显著性**：是否涉及大国、大机构、大额数字
- **AI**：配置了模型时由模型打分，未配置则用 0.5 的中性值

## 接入 AI 打分（可选）

设置环境变量后重启：

```powershell
$env:LLM_BASE_URL="https://api.deepseek.com/v1"   # 或任何 OpenAI 兼容接口
$env:LLM_API_KEY="sk-..."
$env:LLM_MODEL="deepseek-chat"
node server.js
```

开启后，每天取启发式分数最高的 60 条交给模型复评，其余保持启发式分数。
页头会显示「AI 打分：模型名」。

## 每日自动抓取

方式一：Windows 任务计划程序，每天 08:00 运行 `run-daily.bat`。

方式二：用 Cherry Studio 的定时任务，提示词写：
`执行 E:\news-platform\run-daily.bat 并汇报结果`

## 目录

```
feeds.js            新闻源清单与来源权重
src/proxy.js        系统代理自动探测
src/parse.js        RSS/Atom 解析
src/classify.js     八类关键词分类
src/score.js        聚类与重要性评分
src/llm.js          AI 打分适配器
src/collect.js      采集主流程
src/db.js           SQLite（node 内置，无需安装）
server.js           HTTP 服务与 API
public/             前端
data/news.db        数据库
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/news?day=2026-11-05&category=政治&limit=50` | 按日期与分类取新闻 |
| GET | `/api/stats` | 总量、按天、按分类、按来源 |
| POST | `/api/collect` | 立即抓取一次 |

## 工作台（/admin.html）

右上角「工作台」按钮进入，可做四件事：

1. **改 AI 配置**：接口地址、模型名、API Key，保存后即时生效，不用重启
2. **测试连接**：发一句最短请求，返回耗时与模型回复
3. **开关数据源**：14 个源逐个勾选，下次抓取生效
4. **立即抓取**并查看统计

Key 存在 `data/config.json`，前端只显示打码值（前 4 位 + 后 4 位）。

**权限**：本机访问免密；从其他设备访问需在请求头带 `x-admin-token`，
令牌在服务启动时打印在控制台，也可在工作台页面底部看到。

## 国家/地区与翻译对照

- 首页第二行是**国家/地区筛选**：美国、中国、俄罗斯、英国、中东等，由标题实体识别，识别不到时回落到来源所在地
- 点击任意一条标题，进入**全屏阅读**：左侧原文、右侧译文
- 点「翻译成中文」调用 AI 翻译，译文缓存在数据库，同一条不会重复计费
- 未配置 AI Key 时，阅读页会提示去工作台配置

## 微信小程序

工程在 `miniprogram/`，导入微信开发者工具即可。详见 `miniprogram/README.md`。

**注意**：小程序不允许请求 http 与未备案域名。开发时勾选「不校验合法域名」可连局域网地址；
上线必须有 HTTPS 域名并加入微信后台的 request 合法域名。

## 注意

- 只保存标题、摘要与原链接，不存储、不转载正文，规避版权风险。
- 抓取失败不会中断，报告里会列出失败的源。
- 数据库在 `data/news.db`，删掉即重置。
