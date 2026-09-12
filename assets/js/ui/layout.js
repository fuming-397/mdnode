/**
 * layout.js — 可复用的页头 / 页脚 / 头像组件（HTML 片段集中在此，便于维护）
 * 各页面只需提供 <div id="site-header"> 与 <div id="site-footer"> 两个挂载点。
 */
import { el, qs, formatDate } from '../core/utils.js';
import { resolveAvatar } from '../core/config.js';
import { bindThemeToggle } from '../core/theme.js';
import { homeUrl, postsUrl, searchUrl, markActiveNav, getRoute } from '../core/router.js';

/** 导航项 → 干净 URL */
function navHref(key) {
  if (key === 'posts') return postsUrl();
  if (key === 'search') return searchUrl();
  return homeUrl();
}

/** 头像组件：支持路径 / 网络地址；加载失败自动退化为占位块 */
export function createAvatar(config) {
  const { url } = resolveAvatar(config.author.avatar);
  const wrap = el('div', { class: 'avatar' + (url ? '' : ' is-placeholder') });

  if (url) {
    const img = el('img', {
      class: 'avatar__img',
      src: url,
      alt: config.author.name,
      loading: 'eager',
      decoding: 'async'
    });
    // 任何加载失败都不报错，只切换到占位显示（需求：配置错误显示占位内容）
    img.addEventListener('error', () => {
      wrap.classList.add('is-placeholder');
      img.remove();
    });
    wrap.append(img);
  }

  wrap.append(el('span', { class: 'avatar__fallback', text: 'NO IMAGE' }));
  return wrap;
}

/** 顶部辅助信息条：全大写英文 + 拉大字距 */
function renderTopbar(config, route) {
  const meta = [
    config.site.shortName,
    'STATIC BLOG',
    'MARKDOWN DRIVEN'
  ];

  // 当前页面标识，同样是英文大写
  const pageLabel = { home: 'INDEX', posts: 'ARCHIVE', post: 'ENTRY', search: 'QUERY' }[route.name] || 'PAGE';

  return el('div', { class: 'topbar' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'topbar__inner' }, [
        el('div', { class: 'topbar__meta micro' }, meta.map((text) => el('span', { text }))),
        el('div', { class: 'topbar__meta micro micro--muted' }, [
          el('span', { text: `PAGE / ${pageLabel}` }),
          el('span', { text: formatDate(new Date()) })
        ])
      ])
    ])
  ]);
}

/** 页头：品牌 + 导航 + 主题切换 */
function renderHeader(config, route) {
  const brand = el('a', { class: 'brand', href: homeUrl(), 'aria-label': config.site.title }, [
    el('span', { class: 'brand__mark', text: config.site.shortName.slice(0, 1) || 'M' }),
    el('span', { class: 'brand__text' }, [
      el('span', { class: 'brand__name', text: config.site.title }),
      el('span', { class: 'micro micro--muted', text: config.site.shortName })
    ])
  ]);

  const navItems = config.site.nav.map((item) =>
    el('a', {
      class: 'nav__link',
      href: navHref(item.key),
      'data-nav': item.key,
      text: item.label
    })
  );

  const themeButton = el('button', {
    class: 'theme-toggle',
    type: 'button',
    'aria-pressed': 'false'
  }, [
    el('span', { class: 'theme-toggle__icon', 'aria-hidden': 'true' }),
    el('span', { class: 'theme-toggle__label', text: 'THEME' })
  ]);

  const nav = el('nav', { class: 'nav', 'aria-label': '主导航' }, [
    ...navItems,
    el('div', { class: 'nav__theme' }, [themeButton])
  ]);

  const header = el('header', { class: 'site-header' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'site-header__inner' }, [brand, nav])
    ])
  ]);

  // 主题切换绑定（无障碍属性同步在 bindThemeToggle 内完成）
  bindThemeToggle(themeButton);

  // 高亮当前页
  queueMicrotask(() => markActiveNav(header));
  return header;
}

/** 页脚：版权 + 导航 + 联系方式 + 技术说明 */
function renderFooter(config, route) {
  const year = new Date().getFullYear();

  const navColumn = el('div', { class: 'site-footer__col' }, [
    el('p', { class: 'micro micro--muted', text: 'NAVIGATION' }),
    ...config.site.nav.map((item) =>
      el('a', { class: 'text-sm', href: navHref(item.key), text: item.label }))
  ]);

  const socialItems = (config.author.social || []).map((item) =>
    el('a', {
      class: 'text-sm mono',
      href: item.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: item.label
    })
  );

  const contactColumn = el('div', { class: 'site-footer__col' }, [
    el('p', { class: 'micro micro--muted', text: 'CONTACT' }),
    ...(config.author.email
      ? [el('a', { class: 'text-sm mono', href: `mailto:${config.author.email}`, text: config.author.email })]
      : []),
    ...(config.author.location
      ? [el('p', { class: 'text-sm muted', text: config.author.location })]
      : []),
    ...(socialItems.length
      ? [el('div', { class: 'social-row' }, socialItems)]
      : [el('p', { class: 'text-sm muted', text: '—' })])
  ]);

  const aboutColumn = el('div', { class: 'site-footer__col' }, [
    el('p', { class: 'micro micro--muted', text: 'ABOUT' }),
    el('p', { class: 'text-sm muted', text: config.site.description || '—' })
  ]);

  const colophonColumn = el('div', { class: 'site-footer__col' }, [
    el('p', { class: 'micro micro--muted', text: 'COLOPHON' }),
    el('p', { class: 'text-sm muted', text: 'PURE HTML / CSS / JS' }),
    el('p', { class: 'text-sm muted', text: 'MARKDOWN DRIVEN' }),
    el('p', { class: 'text-sm muted', text: 'NO FRAMEWORK / NO CDN' })
  ]);

  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'site-footer__inner' }, [
        el('div', { class: 'site-footer__cols' }, [aboutColumn, navColumn, contactColumn, colophonColumn]),
        el('div', { class: 'site-footer__bottom' }, [
          el('p', { class: 'micro micro--muted', text: `© ${year} ${config.site.copyright}` }),
          el('p', { class: 'micro micro--muted', text: config.site.license || 'ALL RIGHTS RESERVED' }),
          el('a', { class: 'to-top micro', href: '#top', text: '↑ 回到顶部' })
        ])
      ])
    ])
  ]);
}

/**
 * 挂载整站布局。
 * @param {{config: object}} options
 * @returns {{route: object}}
 */
export function mountLayout({ config }) {
  const route = getRoute();

  const headerMount = qs('#site-header');
  const footerMount = qs('#site-footer');

  if (headerMount) {
    // 直接替换为两个兄弟节点（不加包裹层），否则包裹层会限制 position: sticky 的作用范围
    headerMount.replaceWith(renderTopbar(config, route), renderHeader(config, route));
  }
  if (footerMount) footerMount.replaceWith(renderFooter(config, route));

  document.documentElement.setAttribute('lang', 'zh-CN');
  return { route };
}

/** 为元素列表添加错峰入场动画（--i 由 CSS 计算延迟） */
export function stagger(nodes, startIndex = 0) {
  nodes.forEach((node, index) => {
    if (!node || !node.setAttribute) return;
    node.setAttribute('data-animate', '');
    node.style.setProperty('--i', String(startIndex + index));
  });
  return nodes;
}

/** 页面顶部锚点，供「回到顶部」使用 */
export function ensureTopAnchor() {
  if (!qs('#top')) {
    const anchor = el('span', { id: 'top' });
    document.body.prepend(anchor);
  }
}
