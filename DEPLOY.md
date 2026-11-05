# 部署到 GitHub Pages

目标：不用自己的电脑开机，每小时自动抓一次新闻，手机浏览器随时打开。

## 一、创建仓库

在 GitHub 上新建一个仓库，建议设成 **Public**（公开仓库跑 Actions 不计分钟数，私有仓库每月只有 2000 分钟）。名字随意，比如 `news-desk`。

创建时**不要**勾选 "Add a README file"，保持空仓库。

## 二、推送代码

在本机 `E:\news-platform` 目录下打开 PowerShell，把下面命令里的 `你的用户名` 和 `仓库名` 换掉：

```powershell
cd E:\news-platform
git init
git config user.name "你的名字"
git config user.email "你的邮箱"
git add .
git commit -m "新闻台：抓取、分类、排序、静态发布"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

第一次 push 会弹出 GitHub 登录窗口，按提示授权即可。

## 三、开启 Pages

仓库页面 → **Settings** → 左侧 **Pages** → Source 选 **GitHub Actions**。

不需要选分支，工作流会自动上传产物。

## 四、配置 AI Key

仓库页面 → **Settings** → 左侧 **Secrets and variables** → **Actions** → **New repository secret**

- Name: `LLM_API_KEY`
- Secret: 你的 DeepSeek key

可选：在 **Variables** 里加 `LLM_BASE_URL` 和 `LLM_MODEL`，不加就默认 `https://api.deepseek.com/v1` 和 `deepseek-chat`。

## 五、手动跑一次

仓库页面 → **Actions** → 左侧「抓取并发布」→ 右侧 **Run workflow**。

大约 1–2 分钟。跑完后地址是：

```
https://你的用户名.github.io/仓库名/
```

手机浏览器打开这个地址，添加到主屏幕，用起来和小程序差不多。

## 六、之后怎么更新

不用管。工作流每小时第 13 分钟自动跑一次，抓完自动发布。

## 需要注意

- **GitHub Actions 的定时任务在仓库 60 天没有任何提交时会自动停用**。每月随便改个文件提交一次就能保住。
- 定时任务不保证准点，高峰期可能延迟几分钟到十几分钟，这是 GitHub 的机制。
- 静态版**只能看预翻译的条目**，每天翻译重要性最高的 24 条；没有后端的翻译按钮，其余条目点「原文」看外链。
- 静态版没有「抓取」和「工作台」按钮，这两个是本机服务才有的。本机跑 `node server.js` 时功能完整。
- `data/` 和 `public/data/` 都在 .gitignore 里，**数据库和 API Key 不会被提交到仓库**。Key 只存在 GitHub Secrets 里。

## 小程序为什么用不了这个

微信小程序要求接口地址是**已备案的 HTTPS 域名**，`github.io` 没有备案号，填不进「request 合法域名」。所以这套静态发布只服务于网页版。
