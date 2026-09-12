---
{
  "id": "getting-started",
  "title": "快速开始：三分钟搭建你的静态博客",
  "author": "YOUR NAME",
  "updated": "2025-01-05T10:00:00+08:00",
  "timestamp": 1736042400000,
  "summary": "从修改配置到发布第一篇 Markdown 文章，只需要三步。",
  "tags": ["指南", "开始"]
}
---

# 快速开始

这套博客系统没有数据库、没有后端、没有任何第三方依赖。你只需要维护两样东西：**一个 JSON 配置**和**一堆 Markdown 文件**。

## 第一步：修改站点配置

打开 `data/site.json`，填写你的名字、头像与介绍。头像字段既可以是本地路径，也可以是网络地址：

- 本地路径：`assets/img/avatar-sample.svg`
- 网络地址：`https://example.com/avatar.png`

> 如果该字段为空或地址失效，页面会自动显示 `NO IMAGE` 占位块，不会白屏。

## 第二步：新增一篇 Markdown

在 `posts/` 目录里新建一个 `.md` 文件。文件名只是给你自己看的，**系统不会用它做任何识别**。真正的唯一标识写在文件开头的 JSON 元数据里：

```
---
{
  "id": "your-unique-id",
  "title": "文章标题",
  "author": "作者",
  "updated": "2025-01-05T10:00:00+08:00",
  "timestamp": 1736042400000
}
---

正文从这里开始……
```

其中：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `id` | 必填 | 全局唯一，详情页地址为 `/post?id=<id>` |
| `title` | 必填 | 文章标题 |
| `author` | 可选 | 不填则使用配置里的作者名 |
| `updated` | 推荐 | 最后修改时间，用于展示 |
| `timestamp` | 推荐 | 用于排序的毫秒时间戳，缺失时回退用 `updated` |
| `summary` | 可选 | 摘要，缺失时自动从正文提取 |
| `tags` | 可选 | 字符串数组 |

## 第三步：生成清单并部署

静态托管平台无法列出目录，所以需要一个清单文件告诉前端有哪些文章：

```bash
python3 tools/build-manifest.py
```

然后按 `README.md` 的说明配置托管平台的 **URL 重写规则**，把 `/posts`、`/post`、`/search` 映射到对应的 HTML 文件。

- [x] 配置 `data/site.json`
- [x] 新增 Markdown 文件
- [x] 运行清单脚本
- [ ] 配置重写规则并部署
