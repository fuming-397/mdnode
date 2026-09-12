/**
 * common.js — 各页面共用的启动流程与渲染辅助
 */
import { loadConfig, applySiteMeta, renderConfigWarning } from '../core/config.js';
import { configureRouter, startRouter, getRoute } from '../core/router.js';
import { mountLayout, ensureTopAnchor } from './layout.js';
import { qs, el, clear } from '../core/utils.js';

/**
 * 统一页面启动：加载配置 → 初始化路由 → 应用站点信息 → 挂载页头页脚。
 * 任何异常都会被捕获并渲染为可见提示，保证不白屏。
 * @param {{title?: string, mount?: string}} options
 */
export async function bootPage(options = {}) {
  ensureTopAnchor();

  const state = await loadConfig();
  configureRouter(state.config);
  startRouter();

  applySiteMeta(options.title);
  mountLayout({ config: state.config });

  const mount = qs(options.mount || '#main');
  if (mount && !state.ok) {
    // 配置异常提示放在 <main> 之外：页面渲染时会 clear(#main)，放在里面会被一并清掉
    const banner = el('div', { class: 'container' });
    renderConfigWarning(banner);
    if (mount.parentNode) mount.parentNode.insertBefore(banner, mount);
  }

  return { config: state.config, configOk: state.ok, route: getRoute(), mount };
}

/** 渲染加载占位（骨架屏） */
export function renderLoading(mount, rows = 4) {
  if (!mount) return;
  clear(mount);
  const block = el('div', { class: 'loading-block', 'aria-busy': 'true', 'aria-live': 'polite' }, [
    el('span', { class: 'skeleton skeleton--title' })
  ]);
  for (let i = 0; i < rows; i++) block.append(el('span', { class: 'skeleton skeleton--line' }));
  mount.append(block);
}

/** 渲染错误 / 空状态提示（页面级，非致命） */
export function renderNotice(mount, message, kind = 'notice') {
  if (!mount) return;
  const node = el('div', { class: kind, role: 'status', text: message });
  mount.append(node);
}

/** 渲染致命错误兜底 */
export function renderFatal(mount, error) {
  if (!mount) return;
  clear(mount);
  mount.append(el('div', { class: 'notice', role: 'alert' }, [
    el('p', { text: '页面渲染出现问题，已降级显示。' }),
    el('p', { class: 'text-sm mono', text: String(error && error.message ? error.message : error) })
  ]));
}

/** 页面头部区块：序号 + 大写标签 + 大标题 + 引言 */
export function pageHead({ index, eyebrow, title, lede }) {
  return el('header', { class: 'page-head' }, [
    el('p', { class: 'micro page-head__index', text: [index, eyebrow].filter(Boolean).join(' / ') }),
    el('h1', { class: 'page-head__title', text: title }),
    lede ? el('p', { class: 'page-head__lede', text: lede }) : null
  ]);
}

/** 元数据表 */
export function metaTable(entries) {
  const dl = el('dl', { class: 'meta-table' });
  for (const [label, value] of entries) {
    if (value == null || value === '') continue;
    dl.append(el('dt', { text: label }));
    dl.append(el('dd', {}, [value instanceof Node ? value : document.createTextNode(String(value))]));
  }
  return dl;
}
