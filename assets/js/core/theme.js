/**
 * theme.js — 亮/暗主题切换
 * - 状态单独保存在 localStorage：mdnode:theme（'light' | 'dark'）
 * - 实际渲染由 theme-init.js 在 <head> 中提前完成，这里负责交互与图标/文案同步
 */
import { qs } from './utils.js';

export const THEME_KEY = 'mdnode:theme';
export const THEMES = ['light', 'dark'];

/** 读取当前生效主题 */
export function getTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

/** 应用主题（并同步 theme-color，让移动端状态栏跟色） */
export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.setAttribute('data-theme-source', 'manual');

  const meta = qs('meta[name="theme-color"]');
  if (meta) {
    // 读取 CSS 变量，保证配色改动只需改一处
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
  document.dispatchEvent(new CustomEvent('mdnode:themechange', { detail: { theme: next } }));
  return next;
}

/** 切换主题并持久化 */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  try { window.localStorage.setItem(THEME_KEY, next); } catch (_) { /* 隐私模式忽略 */ }
  return applyTheme(next);
}

/** 为按钮绑定切换事件与无障碍属性 */
export function bindThemeToggle(button) {
  if (!button) return;

  const sync = () => {
    const theme = getTheme();
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    const label = theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  };

  button.addEventListener('click', () => {
    toggleTheme();
    sync();
  });

  // 若其它标签页改了主题，跟随同步
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
      sync();
    }
  });

  sync();
}
