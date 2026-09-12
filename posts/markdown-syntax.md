---
{
  "id": "markdown-syntax",
  "title": "Markdown 语法支持一览",
  "author": "YOUR NAME",
  "updated": "2025-01-03T21:30:00+08:00",
  "timestamp": 1735911000000,
  "summary": "本项目自研的渲染器支持哪些 Markdown 语法？这一篇把它全部列出来。",
  "tags": ["Markdown", "参考"]
}
---

# Markdown 语法支持一览

下面的内容既是文档，也是渲染器的自测样例。

## 文本样式

**粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`，以及普通文本。

转义示例：\*这不是斜体\*，\`这不是代码\`。

## 标题层级

#### 四级标题
##### 五级标题
###### 六级标题

Setext 风格标题也支持：

一级标题
========

二级标题
--------

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套项 A
  - 嵌套项 B
- 第三项

有序列表：

1. 准备材料
2. 开始写作
3. 发布文章

任务列表：

- [x] 写完草稿
- [x] 校对错别字
- [ ] 配一张插图

## 引用

> 少即是多。
>
> 排版是沉默的设计。
>
> > 引用也可以嵌套。

## 代码

行内代码：`const answer = 42;`

围栏代码块（带语言标注）：

```javascript
// 一个无依赖的防抖实现
export function debounce(fn, wait = 180) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
```

缩进代码块：

    function legacy() {
      return 'four spaces';
    }

## 表格

| 功能 | 状态 | 备注 |
| :--- | :---: | ---: |
| 标题 | 支持 | ATX / Setext |
| 表格 | 支持 | 含对齐 |
| 脚注 | 未实现 | 保持轻量 |

## 链接与图片

行内链接：[MDN](https://developer.mozilla.org/ "MDN 文档")

自动链接：<https://example.com> 与 <hello@example.com>

引用式链接：[打开官网][home]

[home]: https://example.com "示例站点"

图片：

![占位图](assets/img/avatar-sample.svg "示例头像")

## 分割线

---

以上语法在渲染前都会经过白名单净化，`<script>` 之类的危险标签会被移除。

<p>原始 HTML 也可以写，但同样会被净化：<span class="tag">SPAN</span></p>
