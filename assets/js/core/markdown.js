/**
 * markdown.js — 自研零依赖 Markdown 渲染器（D1 方案 A）
 *
 * 支持语法：
 *   - 文件开头 JSON 元数据（--- 包裹）
 *   - ATX / Setext 标题、段落、硬换行、水平线
 *   - 粗体 / 斜体 / 粗斜体 / 删除线 / 行内代码
 *   - 围栏代码块（``` 与 ~~~，含语言标注）、四空格缩进代码块
 *   - 行内链接、引用式链接、自动链接、图片
 *   - 引用块、有序/无序/嵌套列表、任务列表
 *   - GFM 表格（含对齐）
 *   - 原始 HTML（渲染后经 sanitize.js 白名单净化）
 *
 * 设计原则：手写解析、无第三方依赖；任何异常输入都退化为纯文本，绝不抛错。
 */
import { escapeHtml, escapeRegExp, slugify } from './utils.js';
import { sanitizeHtml, safeUrl } from './sanitize.js';

const MAX_NESTING = 16; // 防止恶意深层嵌套导致栈溢出

/* ============================================================================
   1. 元数据解析
   ========================================================================== */

/**
 * 拆分文件开头的 JSON 元数据与正文。
 * 格式：
 *   ---
 *   { "id": "...", "title": "..." }
 *   ---
 *   正文……
 *
 * @returns {{meta: object|null, body: string, error: string|null}}
 */
export function splitFrontMatter(raw) {
  const text = String(raw == null ? '' : raw)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!match) return { meta: null, body: text, error: 'NO_FRONT_MATTER' };

  let meta = null;
  let error = null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed;
    else error = 'INVALID_META_SHAPE';
  } catch (_) {
    error = 'INVALID_META_JSON';
  }

  return { meta, body: text.slice(match[0].length), error };
}

/* ============================================================================
   2. 行处理工具
   ========================================================================== */

/** 统一换行、去 BOM，并把「行首」的 Tab 展开为 4 空格（保留正文内 Tab） */
function normalizeSource(source) {
  return String(source == null ? '' : source)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[ \t]*/, (ws) => ws.replace(/\t/g, '    ')));
}

/** 行首空格数 */
function leadingSpaces(line) {
  const m = /^ */.exec(line);
  return m ? m[0].length : 0;
}

/** 围栏代码块起始行 */
function matchFence(line) {
  const m = /^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/.exec(line);
  if (!m) return null;
  // ``` 之后若直接跟内容则不是围栏（行内代码）
  return { indent: m[1].length, mark: m[2], info: m[3].trim() };
}

/** 水平线 */
const HR_RE = /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/;

/** Setext 下划线 */
const SETEXT_RE = /^ {0,3}(=+|-+)[ \t]*$/;

/** 列表项匹配 */
const BULLET_RE = /^( *)([-+*])([ \t]+)(.*)$/;
const ORDERED_RE = /^( *)(\d{1,9})([.)])([ \t]+)(.*)$/;

function matchListItem(line) {
  const b = BULLET_RE.exec(line);
  if (b) {
    const marker = b[2];
    return { indent: b[1].length, marker, content: b[4], ordered: false, number: null, contentIndent: b[1].length + marker.length + b[3].length };
  }
  const o = ORDERED_RE.exec(line);
  if (o) {
    const marker = o[2] + o[3];
    return { indent: o[1].length, marker, content: o[5], ordered: true, number: parseInt(o[2], 10), contentIndent: o[1].length + marker.length + o[4].length };
  }
  return null;
}

/** HTML 块起始标签（只认块级标签，避免把行内 <span> 误判为块） */
const HTML_BLOCK_RE = /^ {0,3}<(\/?)(address|article|aside|blockquote|center|details|dialog|dir|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|iframe|li|main|menu|nav|noscript|ol|p|pre|script|section|style|summary|table|textarea|ul)\b/i;
function isHtmlBlockStart(line) {
  return HTML_BLOCK_RE.test(line) || /^ {0,3}<!--/.test(line);
}

/** 表格分隔行 */
function isTableDelimiter(line) {
  return /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/.test(line) && line.includes('-');
}

/** 元素是否为「块级起点」——用于终止段落 */
function isBlockStart(lines, i) {
  const line = lines[i];
  if (!line || !line.trim()) return true;
  if (matchFence(line)) return true;
  if (HR_RE.test(line)) return true;
  if (/^ {0,3}>/.test(line)) return true;
  if (/^ {0,3}#{1,6}[ \t]/.test(line)) return true;
  if (matchListItem(line)) return true;
  if (isHtmlBlockStart(line)) return true;
  return false;
}

/* ============================================================================
   3. 引用式链接定义
   ========================================================================== */
function extractReferences(lines) {
  const refs = new Map();
  const kept = [];
  const re = /^ {0,3}\[([^\]]+)\]:[ \t]*(\S+)(?:[ \t]+["'(]([^"')]*)["')])?[ \t]*$/;

  for (const line of lines) {
    const m = re.exec(line);
    if (m) refs.set(m[1].toLowerCase(), { href: m[2].replace(/^<|>$/g, ''), title: m[3] || '' });
    else kept.push(line);
  }
  return { lines: kept, refs };
}

/* ============================================================================
   4. 行内解析
   ========================================================================== */

const PH_OPEN = '\uE000';
const PH_CLOSE = '\uE001';

/** 行内渲染：代码 → 自动链接 → 转义 → 图片/链接 → 引用式链接 → 强调 */
function renderInline(raw, ctx) {
  const tokens = [];
  const stash = (html) => {
    tokens.push(html);
    return PH_OPEN + (tokens.length - 1) + PH_CLOSE;
  };

  let text = String(raw == null ? '' : raw);

  // 4.1 行内代码（支持多个反引号）
  text = text.replace(/(`+)([\s\S]*?)\1(?!`)/g, (_m, _ticks, code) => {
    let value = code;
    if (value.length > 1 && value.startsWith(' ') && value.endsWith(' ') && value.trim()) {
      value = value.slice(1, -1);
    }
    return stash(`<code>${escapeHtml(value)}</code>`);
  });

  // 4.2 自动链接 <https://...> 与 <mail@example.com>
  text = text.replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, (_m, href) => {
    const safe = safeUrl(href);
    if (!safe) return escapeHtml(href);
    const label = href.replace(/^mailto:/i, '');
    return stash(`<a href="${escapeHtml(safe)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  text = text.replace(/<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/g, (_m, mail) =>
    stash(`<a href="mailto:${escapeHtml(mail)}">${escapeHtml(mail)}</a>`));

  // 4.3 转义其余 HTML（占位符由私有区字符组成，不受影响）
  text = escapeHtml(text);

  // 4.4 图片 ![alt](src "title")（此时文本已转义，直接使用捕获值，切勿二次转义）
  text = text.replace(/!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)/g, (m, alt, src, title) => {
    const safe = safeUrl(src, { allowImageData: true });
    if (!safe) return m;
    const t = title ? ` title="${title}"` : '';
    return stash(`<img src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async">`);
  });

  // 4.5 行内链接 [label](href "title")
  text = text.replace(/\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)/g, (m, label, href, title) => {
    const safe = safeUrl(href);
    if (!safe) return m;
    const t = title ? ` title="${title}"` : '';
    const rel = /^https?:\/\//i.test(safe) ? ' rel="noopener noreferrer"' : '';
    return stash(`<a href="${safe}"${t}${rel}>${label}</a>`);
  });

  // 4.6 引用式链接 [label][ref] / [ref][] / [ref]
  if (ctx.refs && ctx.refs.size) {
    text = text.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (m, label, ref) => {
      const def = ctx.refs.get((ref || label).toLowerCase());
      if (!def) return m;
      const safe = safeUrl(def.href);
      if (!safe) return m;
      const t = def.title ? ` title="${escapeHtml(def.title)}"` : '';
      return stash(`<a href="${escapeHtml(safe)}"${t}>${label}</a>`);
    });
    text = text.replace(/\[([^\]]+)\](?!\()/g, (m, label) => {
      const def = ctx.refs.get(label.toLowerCase());
      if (!def) return m;
      const safe = safeUrl(def.href);
      if (!safe) return m;
      const t = def.title ? ` title="${escapeHtml(def.title)}"` : '';
      return stash(`<a href="${escapeHtml(safe)}"${t}>${label}</a>`);
    });
  }

  // 4.7 强调（顺序：粗斜体 → 粗体 → 斜体 → 删除线）
  // 注意：不使用后行断言（lookbehind），以兼容较旧的 Safari。
  text = text.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\w*])\*([^*\n]+?)\*(?![\w*])/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^\w_])___(?=\S)([\s\S]*?\S)___(?![\w_])/g, '$1<strong><em>$2</em></strong>');
  text = text.replace(/(^|[^\w_])__(?=\S)([\s\S]*?\S)__(?![\w_])/g, '$1<strong>$2</strong>');
  text = text.replace(/(^|[^\w_])_(?=[^\s_])([^_\n]+?\S)_(?![\w_])/g, '$1<em>$2</em>');
  text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

  // 4.8 还原占位符
  return text.replace(new RegExp(PH_OPEN + '(\\d+)' + PH_CLOSE, 'g'), (_m, idx) => tokens[Number(idx)] || '');
}

/* ============================================================================
   5. 块级解析
   ========================================================================== */

function renderHeading(level, content, ctx) {
  const inner = renderInline(content, ctx);
  const id = slugify(content.replace(/[*_`~[\]()]/g, ''));
  return `<h${level} id="${escapeHtml(id)}">${inner}</h${level}>`;
}

function renderParagraph(lines, ctx) {
  let html = '';
  let buffer = [];

  const flush = (hardBreak) => {
    if (!buffer.length) return;
    html += renderInline(buffer.join(' '), ctx) + (hardBreak ? '<br>' : '');
    buffer = [];
  };

  for (const line of lines) {
    const hard = / {2,}$/.test(line) || /\\$/.test(line);
    buffer.push(line.replace(/ {2,}$/, '').replace(/\\$/, ''));
    if (hard) flush(true);
  }
  flush(false);
  return `<p>${html}</p>`;
}

/** 列表项内容渲染（tight 列表去掉最外层 <p>） */
function renderListItem(buffer, ctx, isTask, depth) {
  let lines = buffer;
  let checkbox = '';
  let className = '';

  if (isTask) {
    const m = /^\[([ xX])\][ \t]+([\s\S]*)$/.exec(lines[0]);
    if (m) {
      className = ' class="task-list-item"';
      checkbox = `<input type="checkbox" disabled${m[1].toLowerCase() === 'x' ? ' checked' : ''}> `;
      lines = [m[2], ...lines.slice(1)];
    }
  }

  let html = renderBlocks(lines, ctx, depth + 1);
  html = html.replace(/^<p>([\s\S]*?)<\/p>\s*/, '$1');
  return `<li${className}>${checkbox}${html}</li>`;
}

function parseList(lines, start, ctx, depth) {
  const first = matchListItem(lines[start]);
  const baseIndent = first.indent;
  const ordered = first.ordered;
  const startNumber = first.number || 1;
  const items = [];
  let hasTask = false;
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const item = matchListItem(lines[i]);
    if (!item || item.indent !== baseIndent || item.ordered !== ordered) break;

    const contentIndent = item.contentIndent;
    let buffer = [item.content];
    i++;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        const next = matchListItem(lines[i + 1] || '');
        const nextIndented = lines[i + 1] && leadingSpaces(lines[i + 1]) >= contentIndent;
        if (next && next.indent === baseIndent && next.ordered === ordered) { loose = true; i++; break; }
        if (nextIndented) { buffer.push(''); i++; continue; }
        break;
      }

      const indent = leadingSpaces(line);
      if (indent >= contentIndent) { buffer.push(line.slice(contentIndent)); i++; continue; }

      const nested = matchListItem(line);
      if (nested && nested.indent > baseIndent) {
        buffer.push(line.slice(Math.min(indent, contentIndent)));
        i++;
        continue;
      }

      if (!nested && indent > baseIndent) { buffer.push(line.trim()); i++; continue; }
      break;
    }

    // 项内出现空行 → 松散列表
    if (buffer.some((l, idx) => idx > 0 && idx < buffer.length - 1 && !l.trim())) loose = true;
    if (!ordered && /^\[([ xX])\][ \t]+/.test(buffer[0])) hasTask = true;
    items.push(buffer);
  }

  const tag = ordered ? 'ol' : 'ul';
  const attrs = ordered && startNumber !== 1 ? ` start="${startNumber}"` : '';
  const cls = hasTask ? ' class="task-list"' : '';
  const body = items.map((buffer) => renderListItem(buffer, ctx, !ordered && /^\[([ xX])\][ \t]+/.test(buffer[0]), depth)).join('');
  return { html: `<${tag}${attrs}${cls}>${body}</${tag}>`, next: i };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function renderTable(header, aligns, rows, ctx) {
  const align = (index) => (aligns[index] ? ` align="${aligns[index]}"` : '');
  const head = header.map((cell, idx) =>
    `<th${align(idx)}>${renderInline(cell, ctx)}</th>`).join('');
  const body = rows.map((row) => {
    const cells = [];
    for (let c = 0; c < header.length; c++) cells.push(`<td${align(c)}>${renderInline(row[c] || '', ctx)}</td>`);
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  // 外层容器负责横向滚动，避免给 <table> 设置 display:block 破坏列对齐
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * 块级渲染主循环
 * @param {string[]} lines
 * @param {{refs: Map, depth: number}} ctx
 */
function renderBlocks(lines, ctx, depth = 0) {
  if (depth > MAX_NESTING) return `<p>${renderInline(lines.join(' '), ctx)}</p>`;

  const out = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // --- 围栏代码块 ---
    const fence = matchFence(line);
    if (fence) {
      const markChar = fence.mark[0];
      const closeRe = new RegExp('^ {0,3}' + escapeRegExp(markChar) + '{' + fence.mark.length + ',}[ \\t]*$');
      const buffer = [];
      i++;
      while (i < n && !closeRe.test(lines[i])) {
        buffer.push(lines[i].slice(0, fence.indent).trim() === '' ? lines[i].slice(fence.indent) : lines[i]);
        i++;
      }
      if (i < n) i++; // 跳过结束围栏
      const lang = (fence.info.split(/\s+/)[0] || '').toLowerCase().replace(/[^\w+#-]/g, '');
      const dataLang = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre${dataLang}><code${langClass}>${escapeHtml(buffer.join('\n'))}</code></pre>`);
      continue;
    }

    // --- 水平线 ---
    if (HR_RE.test(line)) { out.push('<hr>'); i++; continue; }

    // --- ATX 标题 ---
    const atx = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
    if (atx) {
      out.push(renderHeading(atx[1].length, atx[2].trim(), ctx));
      i++;
      continue;
    }

    // --- 引用块 ---
    if (/^ {0,3}>/.test(line)) {
      const buffer = [];
      while (i < n) {
        const current = lines[i];
        if (/^ {0,3}>/.test(current)) { buffer.push(current.replace(/^ {0,3}>[ \t]?/, '')); i++; continue; }
        if (!current.trim()) {
          if (i + 1 < n && /^ {0,3}>/.test(lines[i + 1])) { buffer.push(''); i++; continue; }
          break;
        }
        break;
      }
      out.push(`<blockquote>${renderBlocks(buffer, ctx, depth + 1)}</blockquote>`);
      continue;
    }

    // --- GFM 表格 ---
    if (line.includes('|') && i + 1 < n && isTableDelimiter(lines[i + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
      });
      i += 2;
      const rows = [];
      while (i < n && lines[i].includes('|') && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
      out.push(renderTable(header, aligns, rows, ctx));
      continue;
    }

    // --- 列表 ---
    if (matchListItem(line)) {
      const result = parseList(lines, i, ctx, depth);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // --- 缩进代码块（4 空格） ---
    if (/^ {4}/.test(line)) {
      const buffer = [];
      while (i < n && (/^ {4}/.test(lines[i]) || !lines[i].trim())) {
        if (!lines[i].trim()) {
          if (i + 1 < n && /^ {4}/.test(lines[i + 1])) { buffer.push(''); i++; continue; }
          break;
        }
        buffer.push(lines[i].slice(4));
        i++;
      }
      out.push(`<pre><code>${escapeHtml(buffer.join('\n'))}</code></pre>`);
      continue;
    }

    // --- 原始 HTML 块（收集到空行为止，稍后统一净化） ---
    if (isHtmlBlockStart(line)) {
      const buffer = [];
      while (i < n && lines[i].trim()) { buffer.push(lines[i]); i++; }
      out.push(buffer.join('\n'));
      continue;
    }

    // --- 段落（同时兜底处理多行 Setext 标题） ---
    const buffer = [];
    while (i < n && lines[i].trim() && !isBlockStart(lines, i)) { buffer.push(lines[i]); i++; }

    if (buffer.length >= 2 && SETEXT_RE.test(buffer[buffer.length - 1])) {
      const underline = buffer.pop();
      const level = underline.trim().startsWith('=') ? 1 : 2;
      out.push(renderHeading(level, buffer.join(' ').trim(), ctx));
    } else if (buffer.length) {
      out.push(renderParagraph(buffer, ctx));
    } else {
      // 极端情况兜底：跳过无法识别的一行，避免死循环
      out.push(`<p>${renderInline(lines[i], ctx)}</p>`);
      i++;
    }
  }

  return out.join('\n');
}

/* ============================================================================
   6. 对外接口
   ========================================================================== */

/**
 * 渲染 Markdown 正文为安全 HTML。
 * @param {string} source 不含元数据的正文
 * @param {{refs?: Map}} options
 */
export function renderMarkdown(source, options = {}) {
  const lines = normalizeSource(source);
  const { lines: bodyLines, refs } = extractReferences(lines);
  const ctx = { refs, depth: 0 };
  try {
    const html = renderBlocks(bodyLines, ctx, 0);
    return sanitizeHtml(html);
  } catch (err) {
    // 解析失败时退化为纯文本，保证页面不白屏
    console.error('[markdown] render failed, fallback to plain text', err);
    return `<pre><code>${escapeHtml(String(source || ''))}</code></pre>`;
  }
}

/**
 * 从 Markdown 原文中提取纯文本摘要（用于列表 / 搜索结果）。
 * 会移除元数据、代码块、标记符号与链接语法。
 */
export function extractPlainText(source, maxLength = 200) {
  let text = String(source == null ? '' : source);
  const fm = /^---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(text);
  if (fm) text = text.slice(fm[0].length);

  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^ {0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^ {0,3}>[ \t]?/gm, '')
    .replace(/^ {0,3}([-+*]|\d{1,9}[.)])[ \t]+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength > 0 && text.length > maxLength) {
    text = text.slice(0, maxLength).replace(/[\s,，。.;；:：-]+$/, '') + '…';
  }
  return text;
}
