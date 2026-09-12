/**
 * search.js — 搜索页
 * 对该路径下的 Markdown 全文做模糊查询，支持多关键词（空格分隔，需全部命中）。
 * 查询词同步到 URL（search.html?q=...），可分享、可前进后退。
 */
import { el, clear, debounce, formatDate } from '../core/utils.js';
import { loadPosts, searchPosts, getAllPosts } from '../core/store.js';
import { postUrl, getRoute, onNavigate, setQuery } from '../core/router.js';
import { bootPage, renderLoading, renderFatal, pageHead } from '../ui/common.js';
import { stagger } from '../ui/layout.js';

async function main() {
  const { config, mount } = await bootPage({ title: '搜索' });
  if (!mount) return;
  mount.classList.add('page-enter');

  renderLoading(mount, 4);

  try {
    await loadPosts();
  } catch (err) {
    renderFatal(mount, err);
    return;
  }

  clear(mount);

  const resultsBox = el('div', { class: 'search-results', id: 'search-results', 'aria-live': 'polite' });
  const summaryBox = el('div', { class: 'search-summary' });

  const input = el('input', {
    class: 'search-input',
    id: 'search-input',
    type: 'search',
    name: 'q',
    placeholder: '输入关键词后回车…',
    autocomplete: 'off',
    'aria-label': '搜索关键词',
    value: getRoute().q || ''
  });

  const form = el('form', { class: 'search-form', role: 'search' }, [
    input,
    el('button', { class: 'btn', type: 'submit', text: '搜索' }),
    el('button', { class: 'btn btn--ghost', type: 'button', text: '清空', onclick: () => { input.value = ''; runSearch('', { push: false }); input.focus(); } })
  ]);

  mount.append(pageHead({
    index: '03',
    eyebrow: 'QUERY',
    title: '搜索',
    lede: '对 Markdown 全文进行模糊查询。多个关键词以空格分隔，需同时命中。'
  }));

  mount.append(el('section', { class: 'search-panel' }, [
    form,
    el('div', { class: 'search-hint micro' }, [
      el('span', { text: `共 ${getAllPosts().length} 篇文章可检索` }),
      el('span', { text: `最短 ${config.search.minChars} 个字符` }),
      el('span', { text: '支持标题 / 作者 / 标签 / 正文' })
    ])
  ]));

  mount.append(summaryBox, resultsBox);

  const runSearch = (rawQuery, options = {}) => {
    const query = String(rawQuery || '').trim();
    // 把关键词写回当前地址的查询串（search.html?q=...）：同页 pushState，
    // 不刷新页面、不请求服务器，任何静态托管都能用，还能分享 / 前进后退。
    // setQuery() 会广播路由变化 → onNavigate → renderResults，因此这里不重复渲染。
    setQuery(query ? { q: query } : {}, { replace: options.push !== true });
  };

  const renderResults = (query) => {
    clear(resultsBox);
    clear(summaryBox);

    if (!query) {
      summaryBox.append(el('p', { class: 'micro micro--muted', text: 'READY / 输入关键词开始搜索' }));
      resultsBox.append(el('div', { class: 'empty-state' }, [
        el('p', { text: '在上方输入关键词，即可对该目录下的 Markdown 全文进行检索。' })
      ]));
      return;
    }

    if (query.length < config.search.minChars) {
      summaryBox.append(el('p', { class: 'micro micro--muted', text: `QUERY TOO SHORT / 至少 ${config.search.minChars} 个字符` }));
      return;
    }

    const started = performance.now();
    const results = searchPosts(query);
    const spent = Math.max(1, Math.round(performance.now() - started));

    summaryBox.append(
      el('p', { class: 'micro', text: `“${query}” 命中 ${results.length} 篇` }),
      el('p', { class: 'micro micro--muted', text: `ELAPSED ${spent} MS` })
    );

    if (!results.length) {
      resultsBox.append(el('div', { class: 'empty-state' }, [
        el('p', { text: '没有找到匹配的文章。可以尝试更短的关键词，或用空格分隔多个词。' })
      ]));
      return;
    }

    const nodes = results.map((result) => resultRow(result));
    resultsBox.append(...nodes);
    stagger(nodes);
  };

  // 输入防抖（性能：避免每次按键都全量扫描）
  const debounced = debounce((value) => runSearch(value), 160);
  input.addEventListener('input', () => debounced(input.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch(input.value, { push: true });
  });

  // 浏览器前进/后退时同步输入框与结果
  onNavigate((route) => {
    if (route.name !== 'search') return;
    const value = route.q || '';
    if (input.value !== value) input.value = value;
    renderResults(value);
  });

  renderResults(input.value);
}

function resultRow(result) {
  const { post, snippet } = result;
  return el('article', { class: 'result' }, [
    el('h2', { class: 'result__title' }, [
      el('a', { href: postUrl(post.id), text: post.title })
    ]),
    el('div', { class: 'result__meta micro' }, [
      el('span', { text: post.author || '—' }),
      el('span', { text: post.updated ? formatDate(post.updated) : '—' }),
      el('span', { text: `ID ${post.id}` })
    ]),
    // snippet 已在 store 中做过转义与 <mark> 高亮，可安全插入
    el('p', { class: 'result__snippet', html: snippet })
  ]);
}

main().catch((err) => renderFatal(document.querySelector('#main'), err));
