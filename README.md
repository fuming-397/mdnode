# 码字（MDNode）

一个**零依赖**的个人静态博客系统，用纯原生 HTML + CSS + JavaScript 实现，文章完全由 Markdown 驱动。

- 无 npm、无框架、无 UI 库、无 CDN —— 所有代码都在本地。
- 自研 Markdown 渲染器 + 白名单 HTML 净化。
- 真实文件路由（`posts.html`、`post.html?id=<id>`）：**不需要任何重写配置**，
  任何静态托管平台（含 GitHub Pages）开箱即用，地址栏出现 `.html` 属正常现象。
- 文章数据完全来自 Markdown，并附带离线内容包兜底：即使平台不原样提供 `.md`，文章依然可读。
- 亮 / 暗主题切换，状态持久化在 `localStorage`。
- 全部颜色与动画由 CSS 变量统一控制，改一处即可全站换肤。
- 响应式，适配手机与桌面；尊重 `prefers-reduced-motion`。

---

## 一、目录结构

```
md_node/
├── AGENTS.md                     # 开发规划与进度记录（可删除，不影响运行）
├── README.md                     # 本文件
├── MDNode.md                     # 需求说明书
├── .nojekyll                     # ★ GitHub Pages 建议保留：关闭 Jekyll，让 .md 原样发布
├── .gitignore                    # 忽略构建产物
├── .htaccess                     # Apache 配置（可选，不配置也能用）
├── _redirects                    # Netlify / Cloudflare Pages 配置（可选，不配置也能用）
├── serve.json                    # npx serve 本地预览配置
├── vercel.json                   # Vercel 配置（可选，不配置也能用）
│
├── index.html                    # 首页
├── posts.html                    # 帖子列表页
├── post.html                     # 帖子详情页（全项目唯一）
├── search.html                   # 搜索页
├── 404.html                      # 404 兜底页
│
├── data/
│   ├── site.json                 # ★ 站点与作者配置（改这里）
│   ├── posts.manifest.json       # 文章清单：只有文件名（由脚本生成，勿手改）
│   └── posts.bundle.json         # 离线兜底内容包（由脚本生成，勿手改）
│
├── posts/                        # ★ 你的 Markdown 文章（只维护这里）
│   ├── getting-started.md
│   ├── markdown-syntax.md
│   ├── design-notes.md
│   └── changelog.md
│
├── assets/
│   ├── css/
│   │   ├── variables.css         # ★ 全局设计令牌：颜色 / 字体 / 间距 / 动效
│   │   ├── base.css              # 重置、纸张质感、通用排版
│   │   ├── layout.css            # 页头、导航、页脚、栅格、响应式
│   │   ├── components.css        # 按钮、标签、卡片、列表行、搜索框
│   │   ├── markdown.css          # 渲染后的 Markdown 正文样式
│   │   └── pages.css            # 各页面专属样式
│   ├── js/
│   │   ├── core/
│   │   │   ├── config.js         # 配置加载与容错回退
│   │   │   ├── site-root.js      # ★ 自动探测站点根目录（子目录部署关键）
│   │   │   ├── theme-init.js     # 主题预置（防首屏闪烁，head 内同步加载）
│   │   │   ├── route-recover.js  # 旧的无后缀链接兼容（正常 .html 访问不经过它）
│   │   │   ├── theme.js          # 主题切换逻辑
│   │   │   ├── router.js         # 真实文件路由：页面识别与链接生成
│   │   │   ├── utils.js          # 通用工具函数
│   │   │   ├── store.js          # 数据层：清单 → Markdown → 元数据 → 缓存
│   │   │   ├── markdown.js       # 自研 Markdown 渲染器
│   │   │   └── sanitize.js       # HTML 白名单净化（XSS 防护）
│   │   ├── ui/
│   │   │   ├── common.js         # 页面启动流程与通用渲染块
│   │   │   ├── layout.js         # 页头 / 页脚 / 头像组件
│   │   │   └── code-copy.js      # 代码块「点击复制」按钮
│   │   └── pages/
│   │       ├── home.js
│   │       ├── posts.js
│   │       ├── post.js
│   │       ├── search.js
│   │       └── not-found.js
│   └── img/
│       └── avatar-sample.svg     # 示例头像
│
└── tools/
    ├── build-manifest.py         # 扫描 posts/ 生成清单 + 离线内容包（Python 标准库）
    └── serve.py                  # 本地预览服务器（含路由重写）
```

---

## 二、修改站点配置

编辑 `data/site.json`，所有首页信息、标签页标题、导航文案都在这里。

```json
{
  "site": {
    "title": "码字",                    // 站点名称（页头、页脚、标题）
    "shortName": "MDNODE",             // 缩写标记
    "tabTitle": "码字 · MDNode",        // 浏览器标签页标题
    "description": "……",               // SEO 描述
    "copyright": "码字 (MDNode)",       // 版权栏文案（项目名只出现在这里）
    "license": "CC BY-NC-SA 4.0",
    "basePath": "",                    // 子目录部署时填写，如 "/blog"
    "nav": [
      { "key": "home", "label": "INDEX" },
      { "key": "posts", "label": "POSTS" },
      { "key": "search", "label": "SEARCH" }
    ]
  },
  "author": {
    "name": "YOUR NAME",
    "role": "AUTHOR / WRITER",
    "bio": "自我介绍",
    "avatar": "assets/img/avatar-sample.svg",
    "location": "Earth",
    "email": "you@example.com",
    "social": [
      { "label": "GITHUB", "url": "https://github.com/" }
    ]
  },
  "home": {
    "headline": "WRITING IN MARKDOWN.",
    "intro": "首页引言",
    "latestCount": 4                    // 首页展示的最新文章数量（1–12）
  },
  "posts": {
    "dir": "posts",                     // Markdown 所在目录
    "manifest": "data/posts.manifest.json",
    "bundle": "data/posts.bundle.json"   // 离线兜底内容包（由脚本生成）
  },
  "search": {
    "minChars": 1,
    "maxResults": 50,
    "snippetLength": 180
  }
}
```

### 头像支持两种形式

| 形式 | 写法 | 说明 |
| --- | --- | --- |
| 本地路径 | `"avatar": "assets/img/avatar-sample.svg"` | 相对站点根目录 |
| 网络地址 | `"avatar": "https://example.com/me.png"` | 直接使用绝对 URL |

前端会自动识别。**若字段为空、文件缺失或网络加载失败，会自动显示 `NO IMAGE` 占位块，页面不会报错或白屏。**

同理，`data/site.json` 缺失或 JSON 格式错误时，页面会使用内置默认配置并显示一条提示。

---

## 三、新增 / 修改文章

### 1. 新建文件

在 `posts/` 目录中新建 `.md` 文件。**文件名只用于你自己区分，系统不会把它当作任何识别信息。**

### 2. 写入元数据

文件开头必须是 `---` 包裹的 JSON 元数据：

```markdown
---
{
  "id": "my-first-post",
  "title": "我的第一篇文章",
  "author": "你的名字",
  "updated": "2025-01-05T10:00:00+08:00",
  "timestamp": 1736042400000,
  "summary": "可选摘要",
  "tags": ["随笔", "生活"]
}
---

正文从这里开始，正常书写 Markdown 即可。
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 全局唯一字符串，详情页地址为 `post.html?id=<id>` |
| `title` | ✅ | 文章标题 |
| `author` | — | 缺省时使用 `data/site.json` 中的作者名 |
| `updated` | 推荐 | 最后修改时间（ISO 字符串），用于展示 |
| `timestamp` | 推荐 | 毫秒时间戳，用于排序；缺失时回退解析 `updated` |
| `summary` | — | 摘要；缺失时自动从正文提取 |
| `tags` | — | 字符串数组 |

> `timestamp` 换算：`date -d "2025-01-05T10:00:00+08:00" +%s000`

### 3. 重新生成文章清单（新增 / 删除文件后必做）

静态托管平台无法在前端列出目录，所以需要一个清单文件告诉页面「有哪些 Markdown 文件」：

```bash
python3 tools/build-manifest.py
```

该脚本只使用 Python 标准库，会同时写出两个文件：

| 文件 | 内容 | 作用 |
| --- | --- | --- |
| `data/posts.manifest.json` | 只有文件名 | 告诉前端要读取哪些 Markdown（不含标题、ID 等任何语义信息） |
| `data/posts.bundle.json` | 文件名 + Markdown 原文 | 离线兜底：平台不原样提供 `.md` 时前端改用它，保证文章依然可读 |

平时前端始终优先抓取 `posts/*.md`（**数据完全来自 Markdown**），只有抓取失败才会用到内容包。因此：

- 修改已有文章的**正文**：无需重新生成，刷新页面即可看到最新内容；
- 新增 / 删除 / 重命名文件：必须重新生成清单；
- 希望兜底内容包也保持最新（或平台就是不提供 `.md`）：重新生成一次即可。

常用参数：

```bash
python3 tools/build-manifest.py --check      # 检查清单与内容包是否最新（可用于 CI）
python3 tools/build-manifest.py --no-bundle  # 只生成清单，不生成内容包
```

### 4. 支持的 Markdown 语法

标题（ATX / Setext）、段落、粗体 / 斜体 / 删除线、行内代码、围栏代码块（含语言标注）、
缩进代码块、链接（行内 / 引用式 / 自动链接）、图片、引用块、有序 / 无序 / 嵌套列表、
任务列表、GFM 表格（含对齐）、水平线、硬换行、反斜杠转义、原始 HTML（会被净化）。

> 原始 HTML 会经过白名单净化：`<script>`、`on*` 事件属性、`javascript:` 协议等危险内容会被移除。

代码块右上角附带一个半透明的 **COPY** 按钮：点击即可复制该代码块的全部内容，
鼠标悬停 / 键盘聚焦时会完全显现，复制成功后短暂显示 `COPIED`（样式见 `assets/css/markdown.css`，
逻辑见 `assets/js/ui/code-copy.js`）。

---

## 四、本地预览

浏览器的 ES Module 与 `fetch` **无法通过 `file://` 直接打开**。请使用项目自带的服务器：

```bash
python3 tools/serve.py
# 然后访问 http://127.0.0.1:8000/
```

`tools/serve.py` 直接按真实文件提供服务，与线上表现一致，**开箱即用、无需任何配置**。

如果你更习惯 Node 工具，也可以使用 `npx serve`（仓库根目录已附带 `serve.json`）。

> 提示：站内地址都是真实文件（`/posts.html`、`/post.html?id=x`），
> 即使服务器不支持任何重写也能正常浏览；但 `fetch` 读取 JSON / Markdown
> 仍必须通过 HTTP 访问（不能用 `file://` 直接打开）。详见下方「八、常见问题」。

---

## 五、部署与路由（重要）

### 路由模型：真实文件，零配置

站内所有链接都指向仓库里真实存在的文件，并附带普通查询参数：

| 页面 | 地址 | 实际文件 |
| --- | --- | --- |
| 首页 | `…/` 或 `…/index.html` | `index.html` |
| 帖子列表 | `…/posts.html` | `posts.html` |
| 帖子详情 | `…/post.html?id=<id>` | `post.html` |
| 搜索 | `…/search.html?q=<关键词>` | `search.html` |
| 未知路径 | 平台自动使用 | `404.html` |

因为浏览器请求的就是真实文件，**不需要 URL 重写规则、不需要 Hash 路由、也不需要 404 重定向兜底**，
可以在任何静态托管平台上直接使用（GitHub Pages、Netlify、Cloudflare Pages、Vercel、对象存储、
Nginx / Apache、校园主页空间……）。地址栏里出现 `.html` 是正常的，也正是它换来了零配置的可靠性。

要点：

- 站点根目录由 `assets/js/core/site-root.js` 依据模块自身 URL **自动探测**；
  子目录部署（如 `https://user.github.io/md-node/`）**无需任何配置**，JSON / Markdown 请求不会 404。
- 只有**旧的无后缀链接**（`/posts`、`/post?id=x`、`/search`）才会由 `404.html`（或 `index.html`）
  里的 `route-recover.js` 送到真实文件；正常站内浏览完全不经过它。
- 仓库附带的 `_redirects`、`.htaccess`、`serve.json`、`vercel.json` **都是可选的**，
  删掉不影响使用（它们只是让旧的无后缀链接少跳一次）。

### 可选：为旧链接配置别名

不做任何配置也能完整使用本站。若希望**旧的无后缀链接**（`/posts` 等）直接命中文件、
省去 `route-recover.js` 的一次跳转，可以使用仓库已附带的配置：

**Netlify / Cloudflare Pages**（`_redirects`，已附带）

```
/posts   /posts.html   200
/post    /post.html    200
/search  /search.html  200
/*       /404.html     404
```

**Vercel**（`vercel.json`，已附带）

```json
{ "cleanUrls": false, "trailingSlash": false }
```

**Apache**（`.htaccess`，已附带）

```apache
RewriteEngine On
RewriteRule ^posts/?$  posts.html  [L]
RewriteRule ^post/?$   post.html   [L]
RewriteRule ^search/?$ search.html [L]
ErrorDocument 404 /404.html
```

**Nginx**

```nginx
location ~ ^/posts/?$  { try_files /posts.html  =404; }
location ~ ^/post/?$   { try_files /post.html   =404; }
location ~ ^/search/?$ { try_files /search.html =404; }
error_page 404 /404.html;
```

### GitHub Pages（实测部署目标）

⚠️ **建议保留仓库根目录的 `.nojekyll` 文件（空文件即可，已附带）。**

GitHub Pages 默认启用 Jekyll，而本项目的 `posts/*.md` 以 `---` 开头，会被 Jekyll
当成带 front matter 的页面**编译成 HTML**，原始 `.md` 文件因此不再提供 —— 这正是
“文章清单 / 文章无法读取、HTTP 404”的根本原因。加上 `.nojekyll` 后，所有文件按原样发布，
文章内容始终以最新 Markdown 为准。

即使不加 `.nojekyll`（或平台干脆不提供 `.md`），页面也不会白屏或空列表：前端会自动
改用离线内容包 `data/posts.bundle.json`，并在列表页显示一条提示；重新运行一次
`python3 tools/build-manifest.py` 即可让兜底内容跟上最新正文。

部署步骤：

1. （建议）确认仓库根目录存在 `.nojekyll`；
2. 仓库 Settings → Pages → Source 选择分支与 `/ (root)`；
3. 推送后访问 `https://<用户名>.github.io/<仓库名>/`。

GitHub Pages **不需要配置任何重写规则**：

- 站内链接都是真实文件（`/md-node/posts.html`、`/md-node/post.html?id=x`），直接命中；
- 只有手动输入或外部引用的旧地址 `/md-node/posts` 会落到 `404.html`，
  由 `route-recover.js` 自动跳转到 `/md-node/posts.html`。

### 子目录部署

站点根目录会自动探测，**通常无需手动配置**。若需强制指定（例如自定义域名映射到子目录），
可在 `data/site.json` 中设置 `site.basePath`；留空则使用自动探测值。

---

## 六、主题与配色

- 所有颜色、字体、间距、动画时长与缓动函数都定义在 `assets/css/variables.css`。
- 组件中一律通过 `var(--xxx)` 引用，**修改配色只需改这一个文件**。
- 主题状态保存在 `localStorage` 的单独键 `mdnode:theme`（值为 `light` 或 `dark`），刷新不丢失。
- 首次访问且未手动切换时，跟随系统的 `prefers-color-scheme`。

---

## 七、第三方依赖声明

**本项目不包含任何第三方库。** Markdown 渲染器与 HTML 净化器均为自研，全部代码本地化，无 CDN、无 npm、无构建步骤。

---

## 八、常见问题

### 症状对照表（最常见）

| 现象 | 原因 | 解决办法 |
| --- | --- | --- |
| GitHub Pages 上文章全部读不到，提示清单 **HTTP 404** | 缺少 `.nojekyll`，Jekyll 把 `posts/*.md` 编译成了 HTML，原始 `.md` 不存在 | 在仓库根目录添加空文件 `.nojekyll` 并重新部署；或者直接运行一次 `python3 tools/build-manifest.py` 生成离线内容包兜底 |
| 列表页提示“有 N 篇文章改从离线内容包读取” | 平台没有原样提供 `.md`（Jekyll 编译过、或平台屏蔽了 `.md`） | 加 `.nojekyll` 让 `.md` 原样发布；同时重新运行 `python3 tools/build-manifest.py`，让兜底内容保持最新 |
| 子目录部署（如 `/md-node/`）时 JSON / 文章 404 | 用相对路径请求时基准路径不对 | 已改为基于 `site-root.js` 自动探测的绝对地址，无需配置 |
| 访问 `/posts/` 显示 **listing directory /posts/**（目录列表） | 服务器把 `/posts/` 当成真实目录 | 站内链接现在都是真实文件（`posts.html`），不会走到这里；也可用 `python3 tools/serve.py` 或 `npx serve` |
| 访问 `/search` 显示 **Cannot GET /search** | 服务器不支持无后缀路由且未配置重写 | 站内导航现在都是真实文件（`search.html`）；手动输入旧地址时由 `route-recover.js` → `404.html` 兜底 |
| 页面空白 / 控制台报 `Failed to fetch` | 用 `file://` 直接打开了 HTML | 用 `python3 tools/serve.py` 通过 HTTP 访问 |
| 新增文章后列表里没有 | 未重新生成清单，或元数据缺少 `id` | 运行 `python3 tools/build-manifest.py`；列表页会提示异常文件数量 |
| 文章标题显示为 `(无标题)` | 元数据 JSON 格式错误或缺少 `title` | 检查 `---` 之间的内容是否为合法 JSON |
| 访问深层未知路径（如 `/a/b/c`）时样式丢失 | 平台将未知路径重写到 `index.html`，URL 不变，相对资源基准错位 | 站内链接全部是真实文件，不会遇到；这是平台对待未知路径的行为，并非本项目可控 |

### 现在还依赖服务器重写吗？

**完全不依赖。** 站内所有链接都是真实存在的文件（`/posts.html`、`/post.html?id=x`、
`/search.html?q=y`），任何静态托管平台都能直接命中，**不需要配置任何重写规则**。

需要一点说明的只有两件事：

- **旧的无后缀链接**（如 `/md-node/posts`）：平台会返回 404，由 `404.html` 中的
  `route-recover.js` 把你送到 `posts.html`；正常站内浏览不会经过这条路径。
- **GitHub Pages 的 `.nojekyll`**：建议保留，让 `posts/*.md` 原样发布，文章始终以最新 Markdown 为准；
  即使不加也会自动回退到 `data/posts.bundle.json`，不会白屏或空列表。

另外：`fetch` 读 JSON / Markdown 必须通过 HTTP，本地请用 `python3 tools/serve.py`，
不要用 `file://` 直接打开。

### Markdown 能读到什么程度？

纯静态站点没有后端，能读到什么完全取决于“仓库里有什么文件”：

| 能力 | 是否可行 | 说明 |
| --- | --- | --- |
| 读取指定 `.md` 的全文 | ✅ | 同源 `fetch` 即可，与 `.md` 的 MIME 类型无关；需要平台原样发布该文件（GitHub Pages 加 `.nojekyll`） |
| 平台不提供 `.md` 时仍能读 | ✅ | 自动回退到脚本生成的离线内容包 `data/posts.bundle.json` |
| 自动发现新增的 `.md` 文件 | ❌ | 静态托管不支持目录列表（浏览器端无法枚举服务器文件），因此必须运行 `tools/build-manifest.py` 更新清单——这是原理上的限制，任何静态博客都绕不开 |
| 不运行脚本就让兜底内容跟着更新 | ❌ | 内容包是生成时的快照；能在正常提供 `.md` 的平台上，正文始终以最新 `.md` 为准 |
| 直接双击 `index.html`（`file://`）打开 | ❌ | 浏览器禁止 `file://` 下的模块 / `fetch`，与本项目无关；请用本地 HTTP 服务器 |

---

## 九、许可

代码可自由使用与修改；文章内容版权归作者所有，默认采用 `data/site.json` 中配置的许可协议。
