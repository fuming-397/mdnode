/**
 * utils.js — 通用小工具（无依赖）
 * 仅放与业务无关的纯函数与 DOM 助手，便于复用。
 */

/** HTML 转义：用于把外部文本安全地插入 innerHTML 场景 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 创建元素：el('div', { class: 'x' }, [child, 'text']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** 按选择器查询（简化写法） */
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** 清空元素 */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

/**
 * 把时间戳 / 日期字符串格式化为稳定可读文本。
 * 非法输入返回占位符，绝不抛错（需求：容错显示，不白屏）。
 */
export function formatDateTime(input, locale = 'zh-CN') {
  const date = toDate(input);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date).replace(/\//g, '-');
  } catch (_) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** 仅日期（不含时分） */
export function formatDate(input, locale = 'zh-CN') {
  const date = toDate(input);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date).replace(/\//g, '-');
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

/** 宽松解析：支持数字时间戳、ISO 字符串、日期字符串 */
export function toDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    // 兼容秒级时间戳
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const str = String(input).trim();
  if (/^\d+$/.test(str)) return toDate(Number(str));
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 从任意值提取可用于排序的时间戳（毫秒）；无法解析返回 0 */
export function toTimestamp(value) {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

/** 防抖 */
export function debounce(fn, wait = 180) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** 转义正则元字符，用于把用户输入安全地构造为 RegExp */
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 安全 fetch：网络失败 / 404 / 非文本时返回 null，不抛异常。
 * @returns {Promise<{ok:boolean, status:number, text:string, url:string}>}
 */
export async function safeFetch(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return { ok: false, status: res.status, text: '', url };
    const text = await res.text();
    return { ok: true, status: res.status, text, url };
  } catch (err) {
    return { ok: false, status: 0, text: '', url, error: err };
  }
}

/** 安全读取 JSON：失败返回 null 并给出原因 */
export async function safeFetchJson(url) {
  const res = await safeFetch(url);
  if (!res.ok) return { ok: false, data: null, reason: res.status ? `HTTP ${res.status}` : 'NETWORK', url };
  try {
    return { ok: true, data: JSON.parse(res.text), reason: null, url };
  } catch (_) {
    return { ok: false, data: null, reason: 'INVALID_JSON', url };
  }
}

/** 生成 URL 友好的 slug（用于标题锚点） */
export function slugify(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'section';
}

/** 截断文本（按字符数，保留词边界感） */
export function truncate(text, max = 160) {
  const str = String(text || '').replace(/\s+/g, ' ').trim();
  if (str.length <= max) return str;
  return str.slice(0, max).replace(/[\s,，。.;；:：-]+$/, '') + '…';
}

/** requestAnimationFrame 节流 */
export function rafThrottle(fn) {
  let queued = false;
  let lastArgs = null;
  return function throttled(...args) {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn.apply(this, lastArgs);
    });
  };
}

/** 简易 sessionStorage 包装：任何异常都静默降级为内存存储 */
const memoryStore = new Map();
export const cache = {
  get(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw == null ? (memoryStore.has(key) ? memoryStore.get(key) : null) : raw;
    } catch (_) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  },
  set(key, value) {
    memoryStore.set(key, value);
    try { sessionStorage.setItem(key, value); } catch (_) { /* 隐私模式忽略 */ }
  },
  remove(key) {
    memoryStore.delete(key);
    try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ }
  }
};

/** 拼接路径，避免出现重复斜杠 */
export function joinUrl(base, path) {
  if (!path) return base || '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path; // 绝对 URL
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path).replace(/^\/+/, '');
  return b ? `${b}/${p}` : p;
}
