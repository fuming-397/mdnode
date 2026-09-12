/**
 * code-copy.js — 为渲染后的 Markdown 代码块附加「点击复制」按钮
 *
 * 用法：渲染完正文后调用一次 enhanceCodeBlocks(容器)
 *   - 每个 <pre> 会被包进 <div class="code-block">，按钮绝对定位在右上角
 *     （不放进 <pre> 内部，避免随代码横向滚动而移动）；
 *   - 复制优先使用异步剪贴板 API，不可用时回退到 textarea + execCommand，
 *     任何异常都不抛出，只把按钮切成失败态。
 *
 * 视觉：半透明（opacity .45），鼠标悬停 / 键盘聚焦时变为完全不透明，
 *       复制成功后短暂显示 COPIED。样式见 assets/css/markdown.css。
 */
import { el } from '../core/utils.js';

const LABEL_IDLE = 'COPY';
const LABEL_DONE = 'COPIED';
const LABEL_FAIL = 'FAILED';
const RESET_MS = 1500;

/**
 * 给容器内所有代码块加上复制按钮。
 * @param {ParentNode} root 已渲染 Markdown 的容器
 * @returns {number} 处理的代码块数量
 */
export function enhanceCodeBlocks(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;

  let count = 0;
  for (const pre of root.querySelectorAll('pre')) {
    // 已经处理过（或不是块级代码）则跳过
    if (pre.closest('.code-block')) continue;

    const code = pre.querySelector('code');
    const text = String((code || pre).textContent || '');
    if (!text.trim()) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.replaceWith(wrapper);
    wrapper.append(pre, createCopyButton(text));
    count++;
  }
  return count;
}

/** 单个复制按钮：三种状态（空闲 / 已复制 / 失败） */
function createCopyButton(text) {
  const button = el('button', {
    class: 'code-copy',
    type: 'button',
    text: LABEL_IDLE,
    'aria-label': '复制代码',
    title: '复制代码'
  });

  let timer = null;

  const setIdle = () => {
    button.textContent = LABEL_IDLE;
    button.setAttribute('aria-label', '复制代码');
    button.removeAttribute('data-state');
  };

  const setState = (state, label, ariaLabel) => {
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('data-state', state);
    clearTimeout(timer);
    timer = setTimeout(setIdle, RESET_MS);
  };

  button.addEventListener('click', async () => {
    const ok = await copyText(text);
    if (ok) setState('done', LABEL_DONE, '已复制到剪贴板');
    else setState('fail', LABEL_FAIL, '复制失败，请手动选择代码');
  });

  return button;
}

/** 复制文本：现代 API 优先，失败则回退旧方案 */
async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* 无权限 / 非安全上下文：继续尝试兜底方案 */ }
  }
  return legacyCopy(text);
}

/** 兜底：临时 textarea + execCommand（非安全上下文或旧浏览器） */
function legacyCopy(text) {
  let area = null;
  try {
    area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    return document.execCommand('copy');
  } catch (_) {
    return false;
  } finally {
    if (area) area.remove();
  }
}
