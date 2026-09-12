/**
 * sanitize.js — 零依赖 HTML 白名单净化
 *
 * Markdown 允许原始 HTML，为避免 XSS（脚本注入、on* 事件、javascript: 协议等），
 * 渲染结果统一经过本模块净化后再插入页面。
 * 采用「白名单」策略：不在名单内的标签一律拆包保留文本，危险标签整体丢弃。
 */

/** 允许保留的标签 */
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'dd', 'del', 'details',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's',
  'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody',
  'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr'
]);

/** 这些标签连同内容一起丢弃 */
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'form', 'button', 'textarea', 'select', 'option', 'optgroup', 'link', 'meta',
  'base', 'noscript', 'template', 'svg', 'math', 'audio', 'video', 'source',
  'track', 'canvas', 'portal', 'dialog'
]);

/** 每个标签允许的属性（'*' 表示通用属性） */
const ALLOWED_ATTRS = {
  '*': ['class', 'id', 'title', 'dir', 'lang', 'align'],
  a: ['href', 'target', 'rel', 'name'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  input: ['type', 'checked', 'disabled'],
  td: ['colspan', 'rowspan', 'align'],
  th: ['colspan', 'rowspan', 'align', 'scope'],
  time: ['datetime'],
  ol: ['start', 'type', 'reversed'],
  pre: ['data-lang']
};

/** 允许 input 的类型（仅任务列表复选框） */
const ALLOWED_INPUT_TYPES = new Set(['checkbox']);

/** 判断 URL 是否安全；返回可用地址或 null */
export function safeUrl(value, { allowImageData = false } = {}) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;

  // 去除控制字符与空白后再判断协议，防止 "java\nscript:" 之类绕过
  const compact = raw.replace(/[\u0000-\u0020\u00a0\u2028\u2029]/g, '').toLowerCase();

  if (/^(javascript|vbscript|file):/.test(compact)) return null;
  if (/^data:/.test(compact) && !(allowImageData && /^data:image\//.test(compact))) return null;

  return raw;
}

function sanitizeElement(node) {
  const tag = node.tagName.toLowerCase();
  const allowedAttrs = ALLOWED_ATTRS[tag] || [];
  const genericAttrs = ALLOWED_ATTRS['*'];

  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    const isAllowed = genericAttrs.includes(name) || allowedAttrs.includes(name);

    if (!isAllowed || name.startsWith('on')) {
      node.removeAttribute(attr.name);
      continue;
    }

    if (name === 'href' || name === 'src') {
      const safe = safeUrl(attr.value, { allowImageData: name === 'src' && tag === 'img' });
      if (!safe) { node.removeAttribute(attr.name); continue; }
      node.setAttribute(attr.name, safe);
    }
  }

  // 任务列表复选框：只允许被禁用的 checkbox，避免用户误交互
  if (tag === 'input') {
    const type = (node.getAttribute('type') || '').toLowerCase();
    if (!ALLOWED_INPUT_TYPES.has(type)) { node.remove(); return; }
    node.setAttribute('disabled', '');
    node.removeAttribute('name');
    node.removeAttribute('value');
  }

  // 站外链接补 rel，防止 tabnabbing
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

function walk(node) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    // 注释直接移除
    if (child.nodeType === 8) { child.remove(); continue; }
    if (child.nodeType !== 1) continue; // 文本节点原样保留

    const tag = child.tagName.toLowerCase();
    walk(child);

    if (DROP_TAGS.has(tag)) { child.remove(); continue; }

    if (!ALLOWED_TAGS.has(tag)) {
      // 未知标签：拆包，仅保留其中已净化的子节点
      const fragment = child.ownerDocument.createDocumentFragment();
      while (child.firstChild) fragment.appendChild(child.firstChild);
      child.replaceWith(fragment);
      continue;
    }

    sanitizeElement(child);
  }
}

/**
 * 净化 HTML 字符串。
 * 若运行环境缺少 DOMParser（理论上不会），则退化为全量文本转义，保证安全。
 */
export function sanitizeHtml(html) {
  const source = String(html == null ? '' : html);
  if (typeof DOMParser === 'undefined') {
    return source
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html');
  walk(doc.body);
  return doc.body.innerHTML;
}
