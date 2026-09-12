/**
 * theme-init.js — 主题预置脚本
 * 必须在 <head> 中以同步方式加载，避免首屏主题闪烁（FOUC）。
 * 主题状态单独保存在 localStorage 的一个键中（需求：单独一条保存，刷新不丢失）。
 */
(function () {
  var KEY = 'mdnode:theme';
  var root = document.documentElement;

  var stored = null;
  try { stored = window.localStorage.getItem(KEY); } catch (e) { stored = null; }

  var theme;
  if (stored === 'light' || stored === 'dark') {
    theme = stored;
  } else if (window.matchMedia) {
    // 未手动设置过时，跟随系统偏好
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    theme = 'light';
  }

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-source', stored ? 'manual' : 'auto');
  root.setAttribute('data-theme-key', KEY);
})();
