/**
 * home.js — 首页
 * 展示：头像、名字、介绍信息、统计、发布时间最晚的若干文章。
 */
import { el, formatDate, clear } from '../core/utils.js';
import { createAvatar, stagger } from '../ui/layout.js';
import { loadPosts, getAllPosts, collectTags } from '../core/store.js';
import { postUrl, postsUrl } from '../core/router.js';
import { bootPage, renderLoading, renderFatal } from '../ui/common.js';

async function main() {
  const { config, mount } = await bootPage({ title: null });
  if (!mount) return;

  mount.classList.add('page-enter');
  renderLoading(mount, 3);

  let state;
  try {
    state = await loadPosts();
  } catch (err) {
    renderFatal(mount, err);
    return;
  }

  const posts = getAllPosts();
  const tags = collectTags();
  const latest = posts.slice(0, config.home.latestCount);

  clear(mount);
  mount.append(renderHero(config, posts, tags));
  mount.append(renderLatest(config, latest, state));
  mount.append(renderTags(tags));
}

/** 首屏 Hero：超大字号姓名 + 头像 + 介绍 + 统计 */
function renderHero(config, posts, tags) {
  const lastUpdated = posts.reduce((acc, post) => Math.max(acc, post.timestamp), 0);

  const identity = el('div', { class: 'hero__id' }, [
    el('p', { class: 'micro micro--muted', text: config.author.role || 'AUTHOR' }),
    el('h1', { class: 'hero__name', text: config.author.name }),
    el('p', { class: 'hero__lede', text: config.author.bio })
  ]);

  const top = el('div', { class: 'hero__top' }, [createAvatar(config), identity]);

  const stats = el('div', { class: 'hero__stats' }, [
    stat('文章', String(posts.length)),
    stat('标签', String(tags.length)),
    stat('最近更新', lastUpdated ? formatDate(lastUpdated) : '—'),
    stat('技术栈', 'NO DEPS')
  ]);

  const hero = el('section', { class: 'hero' }, [
    el('p', { class: 'micro micro--muted', text: config.home.headline }),
    top,
    el('p', { class: 'hero__lede', text: config.home.intro }),
    stats
  ]);

  stagger(Array.from(hero.children));
  return hero;
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat__value', text: value }),
    el('span', { class: 'micro micro--muted', text: label })
  ]);
}

/** 最新文章 */
function renderLatest(config, latest, state) {
  const section = el('section', { class: 'section', 'aria-labelledby': 'latest-title' });

  section.append(el('div', { class: 'section-head' }, [
    el('div', {}, [
      el('p', { class: 'micro micro--muted', text: 'LATEST ENTRIES' }),
      el('h2', { class: 'section-head__title', id: 'latest-title', text: '最新文章' })
    ]),
    el('a', { class: 'btn btn--ghost btn--sm', href: postsUrl(), text: '查看全部 →' })
  ]));

  if (!state.manifestOk) {
    section.append(noticeForManifest(state.reason));
  } else if (!latest.length) {
    section.append(emptyState('还没有文章。在 posts/ 目录新增 Markdown 文件，并运行 tools/build-manifest.py 生成清单。'));
  } else {
    const grid = el('div', { class: 'latest-grid' });
    for (const post of latest) grid.append(postCard(post, config));
    section.append(grid);
    stagger(Array.from(grid.children));
  }

  if (state.invalid && state.invalid.length) {
    section.append(el('p', { class: 'micro micro--muted', style: 'margin-top:1rem', text: `注意：${state.invalid.length} 个 Markdown 文件元数据异常，已跳过。` }));
  }

  return section;
}

function postCard(post, config) {
  return el('article', { class: 'card' }, [
    el('p', { class: 'micro micro--muted', text: post.updated ? formatDate(post.updated) : '—' }),
    el('h3', { class: 'card__title' }, [
      el('a', { href: postUrl(post.id), text: post.title })
    ]),
    el('p', { class: 'card__meta micro', text: post.author || config.author.name }),
    post.summary ? el('p', { class: 'card__excerpt', text: post.summary }) : null,
    post.tags.length ? el('div', { class: 'tag-row' }, post.tags.slice(0, 3).map((tag) => el('span', { class: 'tag', text: tag }))) : null
  ]);
}

/** 标签云 */
function renderTags(tags) {
  const section = el('section', { class: 'section', 'aria-labelledby': 'tags-title' });
  section.append(el('div', { class: 'section-head' }, [
    el('div', {}, [
      el('p', { class: 'micro micro--muted', text: 'INDEX OF TAGS' }),
      el('h2', { class: 'section-head__title', id: 'tags-title', text: '标签' })
    ])
  ]));

  if (!tags.length) {
    section.append(el('p', { class: 'muted text-sm', text: '暂无标签。' }));
  } else {
    section.append(el('div', { class: 'tag-row' }, tags.map(([tag, count]) =>
      el('span', { class: 'tag', text: `${tag} (${count})` }))));
  }
  return section;
}

function emptyState(text) {
  return el('div', { class: 'empty-state' }, [el('p', { text })]);
}

function noticeForManifest(reason) {
  const reasonText = {
    MISSING: '未找到文章清单 data/posts.manifest.json。',
    INVALID_JSON: '文章清单 data/posts.manifest.json 不是合法 JSON。',
    NETWORK: '无法读取文章清单（请通过 HTTP 服务访问，而非直接打开本地文件）。'
  }[reason] || `文章清单读取失败：${reason || '未知原因'}。`;
  return el('div', { class: 'notice', role: 'status', text: `${reasonText} 请运行 python3 tools/build-manifest.py 生成后再试。` });
}

main().catch((err) => {
  const mount = document.querySelector('#main');
  renderFatal(mount, err);
});
