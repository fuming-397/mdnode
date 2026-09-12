/**
 * config.js — 站点配置加载与校验
 * 数据来源：data/site.json
 *
 * 容错要求（硬约束）：配置缺失 / 格式错误 / 字段类型不对时，
 * 一律回退到内置默认值并给出可见提示，绝不白屏或抛错。
 */
import { safeFetchJson, cache } from './utils.js';
import { SITE_ROOT, absolute } from './site-root.js';

// 使用基于模块 URL 推导的绝对地址，子目录部署也不会 404
const CONFIG_URL = absolute('data/site.json');
const CACHE_KEY = 'mdnode:config:v1';

/** 内置默认配置：作为任何异常情况下的兜底占位内容 */
export const DEFAULT_CONFIG = {
  site: {
    title: '码字',
    shortName: 'MDNODE',
    tabTitle: '码字 · MDNode',
    description: '个人静态博客系统',
    keywords: 'Markdown, 博客, 静态站点',
    copyright: '码字 (MDNode)',
    license: '',
    basePath: '',
    nav: [
      { key: 'home', label: 'INDEX' },
      { key: 'posts', label: 'POSTS' },
      { key: 'search', label: 'SEARCH' }
    ]
  },
  author: {
    name: '未命名作者',
    role: 'AUTHOR / 作者',
    bio: '这里还没有填写介绍。请在 data/site.json 中配置作者信息。',
    avatar: '',
    location: '',
    email: '',
    social: []
  },
  home: {
    headline: 'WRITING IN MARKDOWN.',
    intro: '把想法写成文件，让时间替你归档。',
    latestCount: 4
  },
  posts: {
    dir: 'posts',
    manifest: 'data/posts.manifest.json',
    bundle: 'data/posts.bundle.json'
  },
  search: {
    minChars: 1,
    maxResults: 50,
    snippetLength: 180
  },
  theme: {
    default: 'light'
  },
  ui: {
    showTopbar: true,
    showStats: true,
    dateLocale: 'zh-CN'
  }
};

/** 深合并：仅覆盖默认结构中已存在的键，避免错误字段污染配置 */
function mergeDefaults(defaults, input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return defaults;
  const out = Array.isArray(defaults) ? defaults.slice() : { ...defaults };
  for (const [key, defValue] of Object.entries(defaults)) {
    const inValue = input[key];
    if (inValue === undefined) continue;
    if (defValue && typeof defValue === 'object' && !Array.isArray(defValue)
        && inValue && typeof inValue === 'object' && !Array.isArray(inValue)) {
      out[key] = mergeDefaults(defValue, inValue);
    } else if (typeof defValue === typeof inValue || defValue === null || defValue === '') {
      out[key] = inValue;
    }
    // 类型不匹配则保留默认值（容错，不报错）
  }
  return out;
}

/** 规范化：裁剪空白、过滤非法社交链接、收敛数值区间 */
function normalize(cfg) {
  cfg.site.title = String(cfg.site.title || '').trim() || DEFAULT_CONFIG.site.title;
  cfg.site.shortName = String(cfg.site.shortName || '').trim().toUpperCase() || DEFAULT_CONFIG.site.shortName;
  cfg.site.tabTitle = String(cfg.site.tabTitle || '').trim() || cfg.site.title;
  cfg.site.basePath = String(cfg.site.basePath || '').trim().replace(/\/+$/, '');

  if (!Array.isArray(cfg.site.nav)) cfg.site.nav = DEFAULT_CONFIG.site.nav;
  cfg.site.nav = cfg.site.nav
    .filter((item) => item && typeof item === 'object' && item.key)
    .map((item) => ({
      key: String(item.key),
      label: String(item.label || item.key).toUpperCase()
    }));
  if (!cfg.site.nav.length) cfg.site.nav = DEFAULT_CONFIG.site.nav;

  cfg.author.name = String(cfg.author.name || '').trim() || DEFAULT_CONFIG.author.name;
  cfg.author.bio = String(cfg.author.bio || '').trim() || DEFAULT_CONFIG.author.bio;
  cfg.author.avatar = String(cfg.author.avatar || '').trim();

  if (!Array.isArray(cfg.author.social)) cfg.author.social = [];
  cfg.author.social = cfg.author.social
    .filter((item) => item && typeof item === 'object' && item.url)
    .map((item) => ({
      label: String(item.label || item.url).toUpperCase(),
      url: String(item.url)
    }));

  const count = Number(cfg.home.latestCount);
  cfg.home.latestCount = Number.isFinite(count) ? Math.min(Math.max(count, 1), 12) : 4;

  const minChars = Number(cfg.search.minChars);
  cfg.search.minChars = Number.isFinite(minChars) ? Math.max(minChars, 1) : 1;
  const maxResults = Number(cfg.search.maxResults);
  cfg.search.maxResults = Number.isFinite(maxResults) ? Math.min(Math.max(maxResults, 1), 200) : 50;
  const snippet = Number(cfg.search.snippetLength);
  cfg.search.snippetLength = Number.isFinite(snippet) ? Math.min(Math.max(snippet, 40), 600) : 180;

  if (cfg.posts.dir) cfg.posts.dir = String(cfg.posts.dir).replace(/^\/+|\/+$/g, '') || 'posts';
  if (!cfg.posts.manifest) cfg.posts.manifest = DEFAULT_CONFIG.posts.manifest;
  if (!cfg.posts.bundle) cfg.posts.bundle = DEFAULT_CONFIG.posts.bundle;
  cfg.posts.bundle = String(cfg.posts.bundle).trim() || DEFAULT_CONFIG.posts.bundle;

  if (cfg.theme.default !== 'dark') cfg.theme.default = 'light';
  cfg.ui.dateLocale = String(cfg.ui.dateLocale || 'zh-CN');

  return cfg;
}

/**
 * 判断头像地址类型并解析为可用 URL。
 * 支持：绝对 URL(http/https/协议相对)、data:/blob:、站点内相对路径。
 * 相对路径一律基于自动探测的站点根目录解析（子目录部署安全）。
 * @returns {{url:string, kind:'url'|'path'|'empty'}}
 */
export function resolveAvatar(avatar) {
  const value = String(avatar == null ? '' : avatar).trim();
  if (!value) return { url: '', kind: 'empty' };
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) {
    return { url: value, kind: 'url' };
  }
  return { url: absolute(value), kind: 'path' };
}

/** 供需要拼接站点内地址的模块使用 */
export { SITE_ROOT, absolute };

/** 供页面使用的单例状态 */
let configPromise = null;
let configState = { config: DEFAULT_CONFIG, ok: false, reason: null, source: 'default' };

/**
 * 加载配置（带内存 + sessionStorage 缓存）。
 * @param {{force?: boolean}} options
 */
export function loadConfig(options = {}) {
  if (configPromise && !options.force) return configPromise;

  configPromise = (async () => {
    const cachedRaw = cache.get(CACHE_KEY);
    if (cachedRaw && !options.force) {
      try {
        const parsed = JSON.parse(cachedRaw);
        configState = { config: normalize(mergeDefaults(DEFAULT_CONFIG, parsed)), ok: true, reason: null, source: 'cache' };
        document.dispatchEvent(new CustomEvent('mdnode:configready', { detail: configState }));
        return configState;
      } catch (_) { /* 缓存损坏则重新请求 */ }
    }

    const res = await safeFetchJson(CONFIG_URL);
    if (res.ok && res.data && typeof res.data === 'object') {
      const merged = normalize(mergeDefaults(DEFAULT_CONFIG, res.data));
      configState = { config: merged, ok: true, reason: null, source: 'remote' };
      cache.set(CACHE_KEY, JSON.stringify(res.data));
    } else {
      // 缺失或损坏：使用默认配置 + 占位内容
      configState = {
        config: DEFAULT_CONFIG,
        ok: false,
        reason: res.reason || 'MISSING',
        source: 'default'
      };
    }
    // 通知其它模块（如 router）配置已就绪
    document.dispatchEvent(new CustomEvent('mdnode:configready', { detail: configState }));
    return configState;
  })();

  return configPromise;
}

/** 同步获取已加载的配置（未加载完成时返回默认值，保证不会 undefined） */
export function getConfig() {
  return configState.config;
}

/** 获取完整状态（含是否使用占位） */
export function getConfigState() {
  return configState;
}

/** 应用站点基础信息到 <title> 与 meta（页面可传入自己的标题） */
export function applySiteMeta(pageTitle) {
  const { config } = configState;
  const title = pageTitle ? `${pageTitle} · ${config.site.title}` : config.site.tabTitle;
  document.title = title;

  const setMeta = (selector, attr, value) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      if (selector.includes('name=')) node.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
      if (selector.includes('property=')) node.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
      document.head.appendChild(node);
    }
    node.setAttribute(attr, value);
  };

  if (config.site.description) setMeta('meta[name="description"]', 'content', config.site.description);
  if (config.site.keywords) setMeta('meta[name="keywords"]', 'content', config.site.keywords);
  setMeta('meta[property="og:title"]', 'content', title);
  if (config.site.description) setMeta('meta[property="og:description"]', 'content', config.site.description);
}

/** 配置异常时在页面顶部显示一条非阻塞提示 */
export function renderConfigWarning(mount) {
  if (!mount || configState.ok) return;
  const reasonText = {
    MISSING: '未找到 data/site.json（已使用内置占位内容）',
    INVALID_JSON: 'data/site.json 不是合法 JSON（已使用内置占位内容）',
    NETWORK: '无法读取 data/site.json，可能未通过 HTTP 服务访问（已使用内置占位内容）'
  }[configState.reason] || `配置读取失败：${configState.reason}（已使用内置占位内容）`;

  const box = document.createElement('div');
  box.className = 'notice';
  box.setAttribute('role', 'status');
  box.textContent = `配置提示：${reasonText}`;
  mount.prepend(box);
}
