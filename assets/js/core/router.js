/**
 * router.js — 真实文件路由（零重写依赖）
 *
 * 设计目标：在**任何**没有任何路由/重写配置的静态托管平台（GitHub Pages、
 * Netlify、Vercel、对象存储、校园主页空间……）上开箱即用。
 *
 * 做法：站内地址一律指向仓库里真实存在的 HTML 文件，附加普通查询串：
 *   index.html            首页
 *   posts.html            帖子列表
 *   post.html?id=<id>     帖子详情（全项目唯一详情页）
 *   search.html?q=<q>     搜索
 *  404.html              未知路径兜底（由托管平台自动使用）
 *
 * 因为浏览器请求的就是真实文件，所以不存在“服务器不认识某条路径”的情况，
 * 也就不需要 History API 重写规则、不需要 Hash 路由、不需要 404 重定向兜底。
 * 唯一保留的兜底是 route-recover.js：把**旧的**无后缀链接（/posts）送到真实文件。
 *
 * 子目录部署：站点根目录由 site-root.js 依据模块自身 URL 自动推导，
 * 也可以用 data/site.json 的 site.basePath 显式覆盖（见 configureRouter）。
 */
import { SITE_ROOT } from './site-root.js';

/** 路由名 → 真实页面文件 */
export const PAGE_FILES = {
  home: 'index.html',
  posts: 'posts.html',
  post: 'post.html',
  search: 'search.html',
  notFound: '404.html'
};

/** 文件名 → 路由名（仅用于调试与自检） */
const ROUTE_BY_FILE = {
  'index.html': 'home',
  'posts.html': 'posts',
  'post.html': 'post',
  'search.html': 'search',
  '404.html': 'notFound'
};

/** 站点根 URL（一定以 / 结尾），默认自动探测，可被 configureRouter 覆盖 */
let baseRoot = SITE_ROOT;

const listeners = new Set();
let currentRoute = null;

/**
 * 配置站点根：优先使用 data/site.json 中显式填写的 site.basePath，
 * 留空则使用 site-root.js 的自动探测值（子目录部署无需配置）。
 * @returns {URL} 生效的站点根 URL
 */
export function configureRouter(config) {
  const configured = config && config.site ? String(config.site.basePath || '').trim() : '';
  if (!configured) {
    baseRoot = SITE_ROOT;
    return baseRoot;
  }
  try {
    // 允许填写 "/blog"、"blog" 或完整 URL
    const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(configured)
      ? configured
      : new URL('/' + configured.replace(/^\/+/, ''), window.location.origin).href;
    baseRoot = new URL(href.endsWith('/') ? href : href + '/');
  } catch (_) {
    baseRoot = SITE_ROOT; // 配置非法时安全回退，不抛错
  }
  return baseRoot;
}

/** 当前生效的站点根路径（不含结尾斜杠），如 /md-node；域名根目录时为 '' */
export function getBasePath() {
  return baseRoot.pathname.replace(/\/+$/, '');
}

/** 当前页面自身声明的路由（来自 <html data-page="...">） */
export function declaredPage() {
  const value = document.documentElement.getAttribute('data-page') || 'notFound';
  return ROUTE_BY_FILE[PAGE_FILES[value]] ? value : 'notFound';
}

/** 某个路由对应页面文件的绝对地址 */
export function fileUrl(name) {
  return new URL(PAGE_FILES[name] || PAGE_FILES.home, baseRoot).href;
}

/* ---------------------------------------------------------------------------
   站内链接：全部指向真实 .html 文件，任何静态托管都能直接命中
   --------------------------------------------------------------------------- */

/** 给绝对地址追加查询参数（空值会被忽略） */
function withQuery(href, params) {
  if (!params) return href;
  const url = new URL(href);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

export const homeUrl = () => fileUrl('home');
export const postsUrl = () => fileUrl('posts');
export const postUrl = (id) => withQuery(fileUrl('post'), { id: String(id == null ? '' : id).trim() });
export const searchUrl = (q) => withQuery(fileUrl('search'), q ? { q: String(q) } : null);
export const notFoundUrl = () => fileUrl('notFound');

/* ---------------------------------------------------------------------------
   路由解析与订阅
   --------------------------------------------------------------------------- */

/**
 * 解析当前路由。
 * 页面身份来自 <html data-page="...">（因为浏览器加载的就是该文件本身），
 * 参数来自真实查询串：post.html?id=x、search.html?q=y。
 */
export function parseRoute(search = window.location.search) {
  const name = declaredPage();
  const query = new URLSearchParams(String(search || ''));
  return {
    name,
    path: window.location.pathname,
    query,
    id: name === 'post' ? (query.get('id') || '') : '',
    q: name === 'search' ? (query.get('q') || '') : ''
  };
}

export function getRoute() {
  if (!currentRoute) currentRoute = parseRoute();
  return currentRoute;
}

/** 订阅路由变化（popstate 与程序化 setQuery 都会触发） */
export function onNavigate(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit() {
  currentRoute = parseRoute();
  for (const handler of listeners) {
    try { handler(currentRoute); } catch (err) { console.error('[router] handler error', err); }
  }
}

/**
 * 在当前页面内更新查询串（不刷新页面、不请求服务器）。
 * 例如搜索页把关键词写入 search.html?q=...，可分享、可前进后退。
 * 注意：只改变当前地址的查询串，不会跳到其它文件。
 * @param {Record<string, string>} params
 * @param {{replace?: boolean}} options replace=true 时覆盖历史记录（输入防抖用）
 */
export function setQuery(params = {}, options = {}) {
  const url = new URL(window.location.href);
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === '') continue;
    next.set(key, String(value));
  }
  url.search = next.toString();

  // 查询串没有变化时（例如重复回车）不写历史，只广播一次
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    emit();
    return true;
  }

  const method = options.replace === true ? 'replaceState' : 'pushState';
  try {
    // pushState / replaceState 不会触发任何事件，因此手动广播
    window.history[method]({ mdnode: true }, '', url.pathname + url.search + url.hash);
    emit();
    return true;
  } catch (_) {
    // 极端环境（沙箱 iframe 等）下退化为整页跳转，功能不丢失
    try { window.location.search = url.search; } catch (_) { /* ignore */ }
    return false;
  }
}

/** 启动路由：监听浏览器前进/后退，并解析一次当前地址 */
export function startRouter() {
  window.addEventListener('popstate', emit);
  emit();
  return getRoute();
}

/** 标记导航激活状态 */
export function markActiveNav(root = document) {
  const route = getRoute();
  const links = root.querySelectorAll('[data-nav]');
  for (const link of links) {
    const key = link.getAttribute('data-nav');
    const active = (key === 'home' && route.name === 'home')
      || (key === 'posts' && (route.name === 'posts' || route.name === 'post'))
      || (key === 'search' && route.name === 'search');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** 供调试使用 */
export const pageFiles = { ...PAGE_FILES };
