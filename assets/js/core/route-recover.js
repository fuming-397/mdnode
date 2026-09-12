/**
 * route-recover.js — 旧链接兼容（必须在 <head> 中同步加载，避免闪一下 404）
 *
 * 正常浏览**完全不需要它**：站内所有链接都指向真实存在的 .html 文件
 * （index.html / posts.html / post.html?id=x / search.html?q=y），任何静态托管
 * 平台都能直接命中，无需任何路由或重写配置。
 *
 * 它只处理一种历史遗留情况：用户访问的是**不带 .html 后缀**的旧地址
 * （如 /posts、/post?id=x、/search），这类地址在无重写能力的平台上会落到
 * 404.html（GitHub Pages）或被 ErrorDocument 交给 index.html（Apache）。
 * 此时把请求送到对应的真实文件即可，地址栏随即变为 .../posts.html。
 *
 * 安全边界：
 *   - 地址已是 .html 时立即返回，绝不干预正常访问；
 *   - 只认站点根 / 与 posts、post、search 三个已知片段，未知路径仍显示 404；
 *   - sessionStorage 记录上次跳转目标，杜绝任何跳转循环。
 */
(function () {
  var FILE_BY_ROUTE = {
    home: 'index.html',
    posts: 'posts.html',
    post: 'post.html',
    search: 'search.html'
  };
  var ROUTE_BY_SEGMENT = {
    posts: 'posts',
    post: 'post',
    search: 'search'
  };
  var KEY = 'mdnode:recover';

  var path = window.location.pathname || '/';

  // 已经是真实 .html 地址：本次访问与我们无关，顺手清除防循环标记
  if (/\.html$/i.test(path)) {
    try { window.sessionStorage.removeItem(KEY); } catch (_) { /* ignore */ }
    return;
  }

  var declared = document.documentElement.getAttribute('data-page') || '';

  // 站点根：本脚本位于 <root>/assets/js/core/route-recover.js，向上三级即站点根
  var root = '/';
  try {
    var src = document.currentScript && document.currentScript.src;
    if (src) root = new URL('../../../', src).href;
  } catch (_) { root = '/'; }

  var trimmed = path.replace(/\/+$/, '');
  var segment = trimmed.slice(trimmed.lastIndexOf('/') + 1).toLowerCase();
  var route = ROUTE_BY_SEGMENT[segment];

  // 站点根（/ 或 /md-node/）视为首页
  if (!route) {
    var rootPath = '/';
    try { rootPath = new URL(root).pathname.replace(/\/+$/, ''); } catch (_) { /* ignore */ }
    if (trimmed === rootPath) route = 'home';
  }

  // 未知路径，或当前已经是对应页面：不做任何事
  if (!route || route === declared) return;

  var target = null;
  try { target = new URL(FILE_BY_ROUTE[route], root).href; } catch (_) { return; }
  target += (window.location.search || '') + (window.location.hash || '');

  try {
    if (window.sessionStorage.getItem(KEY) === target) return;
    window.sessionStorage.setItem(KEY, target);
  } catch (_) { /* 隐私模式：仍允许跳转一次 */ }

  window.location.replace(target);
})();
