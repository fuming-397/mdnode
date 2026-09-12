/**
 * not-found.js — 404 页面
 * 静态托管平台将未知路径重写到 404.html（或 index.html）后，由本脚本渲染提示。
 */
import { el } from '../core/utils.js';
import { homeUrl, postsUrl, searchUrl } from '../core/router.js';
import { bootPage, renderFatal } from '../ui/common.js';

async function main() {
  const { mount } = await bootPage({ title: '页面不存在' });
  if (!mount) return;
  mount.classList.add('page-enter');

  mount.append(el('section', { class: 'empty-state' }, [
    el('p', { class: 'micro micro--muted', text: 'ERROR / NOT FOUND' }),
    el('h1', { class: 'error-code', text: '404' }),
    el('p', { text: '你访问的页面不存在，可能是链接已失效或地址输入有误。' }),
    el('div', { class: 'filter-row', style: 'margin-top:2rem' }, [
      el('a', { class: 'btn', href: homeUrl(), text: '返回首页' }),
      el('a', { class: 'btn btn--ghost', href: postsUrl(), text: '浏览文章' }),
      el('a', { class: 'btn btn--ghost', href: searchUrl(), text: '去搜索' })
    ])
  ]));
}

main().catch((err) => renderFatal(document.querySelector('#main'), err));
