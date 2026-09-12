/**
 * post.js — 帖子详情页（全项目唯一的详情 HTML）
 * 依据 URL 中的 id 参数（post.html?id=<id>）查找对应 Markdown 文件并渲染。
 */
import { el, formatDateTime, clear, qsa } from '../core/utils.js';
import { loadPosts, getPostById, getAdjacentPosts } from '../core/store.js';
import { renderMarkdown } from '../core/markdown.js';
import { postUrl, postsUrl, getRoute } from '../core/router.js';
import { bootPage, renderLoading, renderFatal, metaTable } from '../ui/common.js';
import { enhanceCodeBlocks } from '../ui/code-copy.js';

async function main() {
  const { config, mount } = await bootPage({ title: '文章' });
  if (!mount) return;
  mount.classList.add('page-enter');

  renderLoading(mount, 4);

  try {
    await loadPosts();
  } catch (err) {
    renderFatal(mount, err);
    return;
  }

  // 地址由真实文件承载：切换文章就是一次普通的链接跳转（post.html?id=...），
  // 无需在同一页面内监听路由变化，旧浏览器 / 无重写平台表现完全一致。
  renderById(getRoute().id, mount, config);
}

function renderById(id, mount, config) {
  clear(mount);

  if (!id) {
    mount.append(notFound('URL 缺少文章 ID 参数。正确的访问形式为 post.html?id=<文章ID>。'));
    return;
  }

  const post = getPostById(id);
  if (!post) {
    mount.append(notFound(`没有找到 ID 为 “${id}” 的文章。它可能已被移动，或清单尚未更新。`));
    return;
  }

  document.title = `${post.title} · ${config.site.title}`;

  const article = el('article', { class: 'article' });

  // 文章头部（标题 / 日期 / 摘要）
  article.append(el('header', { class: 'post-header' }, [
    el('p', { class: 'micro micro--muted', text: `ENTRY / ${post.updated ? formatDateTime(post.updated) : 'NO DATE'}` }),
    el('h1', { class: 'post-header__title', text: post.title }),
    post.summary ? el('p', { class: 'post-header__summary', text: post.summary }) : null
  ]));

  // 元数据：放在正文**之前**（桌面与手机顺序一致，不再使用侧栏）
  article.append(el('section', { class: 'post-meta', 'aria-label': '文章元数据' }, [
    el('p', { class: 'micro micro--muted', text: 'METADATA / 文章信息' }),
    metaTable([
      ['ID', post.id],
      ['作者', post.author || config.author.name],
      ['最后修改', post.updated ? formatDateTime(post.updated) : '—'],
      ['时间戳', String(post.timestamp || '—')],
      ['标签', post.tags.length ? post.tags.join(', ') : '—']
    ])
  ]));

  // 正文：铺满内容宽度；代码块自动附加「复制」按钮
  const body = el('div', { class: 'md' });
  body.innerHTML = renderMarkdown(post.body);
  enhanceCodeBlocks(body);
  article.append(body);

  // 上/下一篇
  const { prev, next } = getAdjacentPosts(post.id);
  article.append(el('nav', { class: 'article-nav', 'aria-label': '文章导航' }, [
    prev
      ? el('a', { class: 'article-nav__item', href: postUrl(prev.id) }, [
          el('span', { class: 'micro micro--muted', text: '← 更新的一篇' }),
          el('span', { class: 'article-nav__title', text: prev.title })
        ])
      : el('div', { class: 'article-nav__item article-nav__item--empty' }, [
          el('span', { class: 'micro', text: '← 更新的一篇' }),
          el('span', { class: 'text-sm', text: '已是第一篇' })
        ]),
    next
      ? el('a', { class: 'article-nav__item', href: postUrl(next.id), style: 'text-align:right' }, [
          el('span', { class: 'micro micro--muted', text: '更早的一篇 →' }),
          el('span', { class: 'article-nav__title', text: next.title })
        ])
      : el('div', { class: 'article-nav__item article-nav__item--empty', style: 'text-align:right' }, [
          el('span', { class: 'micro', text: '更早的一篇 →' }),
          el('span', { class: 'text-sm', text: '已是最后一篇' })
        ])
  ]));

  article.append(el('footer', { class: 'article__footer' }, [
    el('a', { class: 'btn btn--ghost btn--sm', href: postsUrl(), text: '← 返回列表' }),
    el('a', { class: 'to-top', href: '#top', text: '↑ 回到顶部' })
  ]));

  mount.append(article);

  // 外部链接统一在新标签打开（正文内的站外链接）
  qsa('.md a[href^="http"]', article).forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

/** 文章不存在时的提示块 */
function notFound(message) {
  return el('div', { class: 'empty-state' }, [
    el('p', { class: 'micro micro--muted', text: 'ERROR / NOT FOUND' }),
    el('h1', { class: 'error-code', text: '404' }),
    el('p', { text: message }),
    el('p', { style: 'margin-top:1.5rem' }, [
      el('a', { class: 'btn', href: postsUrl(), text: '返回帖子列表 →' })
    ])
  ]);
}

main().catch((err) => renderFatal(document.querySelector('#main'), err));
