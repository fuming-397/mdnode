/**
 * store.js — 数据层：加载文章清单 → 抓取 Markdown → 解析元数据 → 缓存 → 排序
 *
 * 数据来源约定：
 *   data/posts.manifest.json  只存放文件名（不含任何语义信息）
 *   posts/*.md                正文 + 文件开头的 JSON 元数据（唯一 ID 在此）
 *   data/posts.bundle.json    离线兜底内容包（同一次脚本生成，见下）
 *
 * 静态托管无法列出目录，因此清单由 tools/build-manifest.py 生成。
 *
 * 关于「读取 Markdown 的最大可行性」：
 *   纯静态站点没有后端，能不能读到 .md 只取决于托管平台是否**原样**提供该文件。
 *   多数平台都可以（GitHub Pages 需要根目录的 .nojekyll，否则 Jekyll 会把 .md
 *   编译成 HTML）。为了在“平台就是不提供 .md”这种最坏情况下也能读，
 *   tools/build-manifest.py 会额外生成 data/posts.bundle.json（文件的快照副本）。
 *   运行时优先抓取原始 .md（保持“数据完全来自 Markdown”），只有在抓取失败时
 *   才回退到内容包，并在 state.bundleUsed 中记录数量，页面给出可见提示。
 */
import { getConfig } from './config.js';
import { safeFetch, safeFetchJson, cache, toTimestamp } from './utils.js';
import { absolute } from './site-root.js';
import { splitFrontMatter, extractPlainText } from './markdown.js';

const CACHE_PREFIX = 'mdnode:posts:v2:';

/** 内容包默认位置（可被 data/site.json 的 posts.bundle 覆盖） */
const DEFAULT_BUNDLE = 'data/posts.bundle.json';

/** 运行期状态 */
let postsPromise = null;
let state = {
  posts: [],
  invalid: [],     // 元数据异常的文章
  manifestOk: false,
  reason: null,
  fingerprint: '',
  bundleUsed: 0    // 有多少篇是通过离线内容包读到的（>0 时页面会提示）
};

/** 规范化清单文件：兼容 数组 / {files:[]} / {posts:[]} */
function normalizeManifest(data) {
  let files = [];
  if (Array.isArray(data)) files = data;
  else if (data && Array.isArray(data.files)) files = data.files;
  else if (data && Array.isArray(data.posts)) files = data.posts;

  files = files
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return String(item.file || item.path || item.name || '').trim();
      return '';
    })
    .filter(Boolean)
    // 只接受 Markdown 文件，防止清单被写入任意路径
    .filter((file) => /\.(md|markdown)$/i.test(file))
    .filter((file) => !file.includes('..'));

  const fingerprint = String(
    (data && (data.hash || data.generatedAt || data.updated)) || files.join('|')
  );

  return { files: Array.from(new Set(files)), fingerprint };
}

/** 把元数据规范化为内部文章对象（字段缺失时给出安全默认值） */
function buildPost(file, rawText, meta, parseError) {
  const body = parseError ? '' : String(rawText || '');
  const fallbackSummary = extractPlainText(body, 200);

  const id = meta && meta.id != null ? String(meta.id).trim() : '';
  const title = meta && meta.title != null ? String(meta.title).trim() : '';
  const tags = meta && Array.isArray(meta.tags) ? meta.tags.map(String).filter(Boolean) : [];

  const timestamp = toTimestamp(
    meta ? (meta.timestamp != null ? meta.timestamp : (meta.updated || meta.date)) : 0
  );

  return {
    id,
    title: title || '(无标题)',
    author: meta && meta.author ? String(meta.author) : '',
    updated: meta ? (meta.updated || meta.date || '') : '',
    timestamp,
    summary: meta && (meta.summary || meta.description) ? String(meta.summary || meta.description) : fallbackSummary,
    tags,
    file,
    body,
    meta: meta || {},
    parseError: parseError || null
  };
}

/**
 * 加载全部文章（含正文，供列表 / 搜索复用）。
 * @param {{force?: boolean}} options
 */
export function loadPosts(options = {}) {
  if (postsPromise && !options.force) return postsPromise;

  postsPromise = (async () => {
    const config = getConfig();
    // 转为绝对地址，子目录部署时不会因相对路径基准而 404
    const manifestUrl = absolute(config.posts.manifest);
    const dir = config.posts.dir;

    const res = await safeFetchJson(manifestUrl);
    if (!res.ok) {
      state = {
        posts: [], invalid: [], manifestOk: false,
        reason: res.reason || 'MISSING', fingerprint: '', bundleUsed: 0
      };
      return state;
    }

    const { files, fingerprint } = normalizeManifest(res.data);

    // 命中会话缓存：避免同一次浏览中重复抓取全部 Markdown
    const cacheKey = CACHE_PREFIX + (fingerprint || 'default');
    const cached = cache.get(cacheKey);
    if (cached && !options.force) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.posts)) {
          state = { ...parsed, manifestOk: true, reason: null, fingerprint, bundleUsed: parsed.bundleUsed || 0 };
          return state;
        }
      } catch (_) { /* 缓存损坏则重新抓取 */ }
    }

    const results = await Promise.allSettled(
      files.map(async (file) => {
        const url = absolute(`${dir}/${file}`);
        const fetched = await safeFetch(url);
        if (!fetched.ok) {
          return { ok: false, file, reason: fetched.status ? `HTTP ${fetched.status}` : 'NETWORK' };
        }
        const { meta, body, error } = splitFrontMatter(fetched.text);
        const post = buildPost(file, body, meta, error);
        return { ok: true, post, error };
      })
    );

    // 只在上面的抓取出现失败时才去读内容包（正常情况不产生额外请求）
    const failedAny = files.some((file, index) => {
      const result = results[index];
      return result.status !== 'fulfilled' || !result.value.ok;
    });
    const bundle = failedAny ? await loadBundle(config) : null;
    let bundleUsed = 0;

    const posts = [];
    const invalid = [];

    results.forEach((result, index) => {
      const file = files[index];
      const value = result.status === 'fulfilled' ? result.value : null;

      if (!value || !value.ok) {
        // 回退：用离线内容包里的同一文件（平台不提供原始 .md 时的唯一可行方案）
        const text = bundle ? bundle.get(file) : null;
        if (typeof text === 'string') {
          const { meta, body, error } = splitFrontMatter(text);
          const post = buildPost(file, body, meta, error);
          if (!post.id) { invalid.push({ file, reason: error || 'MISSING_ID' }); return; }
          post.source = 'bundle';
          bundleUsed++;
          posts.push(post);
          return;
        }
        invalid.push({ file, reason: value ? value.reason : 'LOAD_FAILED' });
        return;
      }

      const post = value.post;
      if (!post.id) { invalid.push({ file, reason: value.error || 'MISSING_ID' }); return; }
      post.source = 'md';
      posts.push(post);
    });

    // 排序：时间戳倒序（最新在前），时间相同按 id 稳定排序
    posts.sort((a, b) => (b.timestamp - a.timestamp) || String(a.id).localeCompare(String(b.id)));

    state = { posts, invalid, manifestOk: true, reason: null, fingerprint, bundleUsed };

    try {
      // 仅缓存可序列化字段，正文一并缓存以便搜索页复用
      cache.set(cacheKey, JSON.stringify({ posts, invalid, fingerprint, bundleUsed }));
    } catch (_) { /* 超出配额时忽略，不影响功能 */ }

    return state;
  })();

  return postsPromise;
}

/**
 * 规范化离线内容包，兼容多种写法：
 *   [{file, text}] / {posts:[...]} / {files:[...]} / {files:{name:text}} / {name:text}
 * 只接受 Markdown 文本条目，避免内容包被写入任意字段。
 * @returns {Map<string,string>} 文件名 → Markdown 原文
 */
function normalizeBundle(data) {
  const map = new Map();
  const put = (name, text) => {
    const file = String(name == null ? '' : name).trim();
    if (!file || typeof text !== 'string') return;
    if (!/\.(md|markdown)$/i.test(file) || file.includes('..')) return;
    map.set(file, text);
  };
  const listOf = (value) => (Array.isArray(value) ? value : null);

  const list = listOf(data) || listOf(data && data.files) || listOf(data && data.posts);
  if (list) {
    for (const item of list) {
      if (item && typeof item === 'object') {
        put(item.file || item.path || item.name, item.text != null ? item.text : (item.content != null ? item.content : item.body));
      }
    }
    return map;
  }

  for (const source of [data, data && data.files, data && data.posts]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [name, value] of Object.entries(source)) {
      if (typeof value === 'string') put(name, value);
      else if (value && typeof value === 'object') {
        put(name, value.text != null ? value.text : (value.content != null ? value.content : value.body));
      }
    }
  }
  return map;
}

/** 读取离线内容包；文件缺失 / 损坏时返回 null（不影响主流程） */
async function loadBundle(config) {
  const path = (config && config.posts && config.posts.bundle) || DEFAULT_BUNDLE;
  const res = await safeFetchJson(absolute(path));
  if (!res.ok) return null;
  const map = normalizeBundle(res.data);
  return map.size ? map : null;
}

/** 同步读取已加载状态（未加载完成时返回空结构） */
export function getPostsState() { return state; }

/** 获取全部文章（需先 await loadPosts） */
export function getAllPosts() { return state.posts; }

/** 按 ID 查找文章 */
export function getPostById(id) {
  const key = String(id == null ? '' : id).trim();
  if (!key) return null;
  return state.posts.find((post) => post.id === key) || null;
}

/** 取相邻文章：用于详情页上一篇 / 下一篇（列表已按时间倒序） */
export function getAdjacentPosts(id) {
  const index = state.posts.findIndex((post) => post.id === String(id));
  if (index < 0) return { prev: null, next: null };
  return {
    prev: state.posts[index - 1] || null, // 更新的一篇
    next: state.posts[index + 1] || null  // 更早的一篇
  };
}

/** 统计标签出现次数 */
export function collectTags() {
  const map = new Map();
  for (const post of state.posts) {
    for (const tag of post.tags) map.set(tag, (map.get(tag) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * 全文模糊搜索。
 * 命中范围：标题、作者、标签、正文。返回按相关度排序的结果，并附带高亮片段。
 * @param {string} query
 * @returns {Array<{post:object, score:number, snippet:string, matches:number}>}
 */
export function searchPosts(query) {
  const config = getConfig();
  const keyword = String(query == null ? '' : query).trim();
  if (keyword.length < config.search.minChars) return [];

  // 支持空格分隔的多关键词（全部命中才算匹配，提升精度）
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];

  for (const post of state.posts) {
    const title = post.title.toLowerCase();
    const author = (post.author || '').toLowerCase();
    const tags = post.tags.join(' ').toLowerCase();
    const body = post.body.toLowerCase();

    let score = 0;
    let matches = 0;
    let allHit = true;

    for (const term of terms) {
      const inTitle = title.includes(term);
      const inTags = tags.includes(term);
      const inAuthor = author.includes(term);
      const bodyCount = countOccurrences(body, term);

      if (!inTitle && !inTags && !inAuthor && bodyCount === 0) { allHit = false; break; }

      if (inTitle) score += 100;
      if (inTags) score += 40;
      if (inAuthor) score += 20;
      score += Math.min(bodyCount, 20) * 2;
      matches += bodyCount + (inTitle ? 1 : 0);
    }

    if (!allHit) continue;

    // 时间新近度加权（越新略微靠前）
    score += Math.min(post.timestamp / 1e11, 5);

    results.push({
      post,
      score,
      matches,
      snippet: buildSnippet(post, terms, config.search.snippetLength)
    });
  }

  results.sort((a, b) => b.score - a.score || b.post.timestamp - a.post.timestamp);
  return results.slice(0, config.search.maxResults);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1 && count < 50) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/** 生成包含命中关键词的摘要，并用 <mark> 高亮（返回转义后的安全 HTML） */
function buildSnippet(post, terms, maxLength) {
  const plain = extractPlainText(post.body, 0);
  const lower = plain.toLowerCase();

  let at = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1 && (at === -1 || index < at)) at = index;
  }

  const start = at === -1 ? 0 : Math.max(0, at - Math.floor(maxLength / 3));
  let snippet = plain.slice(start, start + maxLength);
  if (start > 0) snippet = '…' + snippet;
  if (start + maxLength < plain.length) snippet = snippet + '…';

  return highlight(snippet, terms);
}

/** 转义 + 命中高亮 */
function highlight(text, terms) {
  let out = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  for (const term of terms) {
    if (!term) continue;
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      // 由于原文已转义，需同时匹配 term 与其转义形式
      out = out.replace(new RegExp(`(${safeTerm})`, 'gi'), '<mark>$1</mark>');
    } catch (_) { /* 忽略非法正则 */ }
  }
  return out;
}

/** 清空缓存（调试用） */
export function clearPostsCache() {
  postsPromise = null;
  state = { posts: [], invalid: [], manifestOk: false, reason: null, fingerprint: '', bundleUsed: 0 };
}
