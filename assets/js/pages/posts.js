/**
 * posts.js — 帖子列表页
 * 完全依据 Markdown 文件开头的 JSON 元数据渲染，不把文件名当作任何识别信息。
 */
import { el, formatDateTime, clear } from '../core/utils.js';
import { loadPosts, getAllPosts } from '../core/store.js';
import { postUrl } from '../core/router.js';
import { bootPage, renderLoading, renderFatal, pageHead } from '../ui/common.js';
import { stagger } from '../ui/layout.js';

async function main() {
  const { config, mount } = await bootPage({ title: '帖子列表' });
  if (!mount) return;
  mount.classList.add('page-enter');

  renderLoading(mount, 5);

  let state;
  try {
    state = await loadPosts();
  } catch (err) {
    renderFatal(mount, err);
    return;
  }

  const posts = getAllPosts();
  clear(mount);

  mount.append(pageHead({
    index: '02',
    eyebrow: 'ARCHIVE',
    title: '帖子列表',
    lede: '按最后修改时间倒序排列。所有条目信息均来自 Markdown 文件开头的 JSON 元数据。'
  }));

  if (!state.manifestOk) {
    const reasonText = {
      MISSING: '未找到文章清单 data/posts.manifest.json。',
      INVALID_JSON: '文章清单不是合法 JSON。',
      NETWORK: '无法读取文章清单（请通过 HTTP 服务访问）。'
    }[state.reason] || `清单读取失败：${state.reason}`;
    mount.append(el('div', { class: 'notice', role: 'status', text: `${reasonText} 请运行 python3 tools/build-manifest.py。` }));
    return;
  }

  if (!posts.length) {
    mount.append(el('div', { class: 'empty-state' }, [
      el('p', { text: '清单中没有可用文章。请在 posts/ 目录新增 Markdown 文件并重新生成清单。' })
    ]));
    return;
  }

  mount.append(renderToolbar(posts));
  const list = el('div', { class: 'post-list', role: 'list' });
  mount.append(list);

  const renderRows = (items) => {
    clear(list);
    items.forEach((post, index) => list.append(postRow(post, index, config)));
    stagger(Array.from(list.children));
  };

  renderRows(posts);

  // 标签筛选（纯前端，不改变数据）
  const filters = collectFilters(posts);
  const filterRow = mount.querySelector('#tag-filters');
  if (filterRow && filters.length) {
    filterRow.append(
      filterButton('全部', true, () => renderRows(posts)),
      ...filters.map(([tag]) => filterButton(tag, false, () => renderRows(posts.filter((p) => p.tags.includes(tag)))))
    );
  }

  if (state.invalid && state.invalid.length) {
    mount.append(el('p', { class: 'micro micro--muted', style: 'margin-top:1.5rem', text: `注意：${state.invalid.length} 个文件元数据异常已跳过：${state.invalid.map((item) => item.file).join(', ')}` }));
  }

  // 透明提示：文章正文来自离线内容包（说明平台没有原样提供 .md）
  if (state.bundleUsed > 0) {
    mount.append(el('p', { class: 'micro micro--muted', style: 'margin-top:1rem', text: `注意：有 ${state.bundleUsed} 篇文章改从离线内容包 data/posts.bundle.json 读取（托管平台未原样提供 .md，常见于 GitHub Pages 缺少 .nojekyll）。修改正文后请重新运行 python3 tools/build-manifest.py。` }));
  }
}

function renderToolbar(posts) {
  const updated = posts.reduce((acc, post) => Math.max(acc, post.timestamp), 0);
  return el('div', { class: 'list-toolbar' }, [
    el('div', { class: 'filter-row', id: 'tag-filters', role: 'group', 'aria-label': '标签筛选' }),
    el('p', { class: 'micro micro--muted', text: `TOTAL ${String(posts.length).padStart(3, '0')} / UPDATED ${updated ? formatDateTime(updated).slice(0, 10) : '—'}` })
  ]);
}

function filterButton(label, pressed, onClick) {
  return el('button', {
    class: 'filter-btn',
    type: 'button',
    'aria-pressed': String(pressed),
    text: label,
    onclick: (event) => {
      const row = event.currentTarget.parentElement;
      row.querySelectorAll('.filter-btn').forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
      event.currentTarget.setAttribute('aria-pressed', 'true');
      onClick();
    }
  });
}

function collectFilters(posts) {
  const map = new Map();
  for (const post of posts) for (const tag of post.tags) map.set(tag, (map.get(tag) || 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

/** 单行文章条目 */
function postRow(post, index, config) {
  const meta = [
    post.author || config.author.name,
    post.updated ? formatDateTime(post.updated) : '—',
    `ID ${post.id}`,
    `TS ${post.timestamp || '—'}`
  ];

  return el('article', { class: 'post-row', role: 'listitem' }, [
    el('span', { class: 'post-row__index', text: String(index + 1).padStart(3, '0') }),
    el('div', { class: 'post-row__body' }, [
      el('h2', { class: 'post-row__title' }, [
        el('a', { href: postUrl(post.id), text: post.title })
      ]),
      el('div', { class: 'post-row__meta micro' }, meta.map((text) => el('span', { text }))),
      post.summary ? el('p', { class: 'post-row__summary', text: post.summary }) : null,
      post.tags.length
        ? el('div', { class: 'tag-row' }, post.tags.map((tag) => el('span', { class: 'tag', text: tag })))
        : null
    ])
  ]);
}

main().catch((err) => renderFatal(document.querySelector('#main'), err));
