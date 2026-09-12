/**
 * site-root.js — 自动探测站点根目录（解决子目录部署问题）
 *
 * 原理：本模块自身的 URL 一定是 <站点根>/assets/js/core/site-root.js，
 * 因此向上三级即可得到站点根，无需任何手动配置：
 *   https://user.github.io/md-node/assets/js/core/site-root.js
 *     → ../../../ → https://user.github.io/md-node/
 *   https://example.com/assets/js/core/site-root.js
 *     → ../../../ → https://example.com/
 *
 * 这样无论部署在域名根目录还是任意子路径，配置 / 清单 / 文章 / 图片
 * 的请求地址都能自动正确，不再依赖相对路径的解析基准。
 */

/** 站点根目录的绝对 URL（结尾一定带 /） */
export const SITE_ROOT = new URL('../../../', import.meta.url);

/** 站点根路径，例如 /md-node；部署在域名根时为 '' */
export const BASE_PATH = SITE_ROOT.pathname.replace(/\/+$/, '');

/**
 * 把站点内相对路径转为绝对 URL。
 * 已经是 http(s) / data: / blob: / // 开头的地址原样返回。
 */
export function absolute(path) {
  const value = String(path == null ? '' : path).trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  // 以 / 开头时按「站点根」处理，避免误解析到域名根
  return new URL(value.replace(/^\/+/, ''), SITE_ROOT).href;
}
