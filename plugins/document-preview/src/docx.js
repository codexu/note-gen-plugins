import { renderAsync } from 'docx-preview';
import { button, el, t, clamp } from './ui.js';

export async function render(data, ctx) {
  ctx.status.textContent = t('正在排版 DOCX…', 'Laying out DOCX…');
  const container = el('div');
  const styles = el('div');
  ctx.content.append(styles, container);
  // Block all document links, including local/blob navigation. The sandbox
  // already blocks network requests, forms, nested frames and native APIs.
  const blockLink = event => { if (event.target.closest?.('a')) event.preventDefault(); };
  container.addEventListener('click', blockLink, true);
  container.addEventListener('auxclick', blockLink, true);
  ctx.onDispose(() => { container.replaceChildren(); styles.replaceChildren(); });
  await renderAsync(data, container, styles, {
    className: 'docx', inWrapper: true, breakPages: true,
    ignoreLastRenderedPageBreak: false, ignoreFonts: false,
    renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true,
    renderChanges: false, renderComments: false, renderAltChunks: false,
    // data: resources are scoped to this DOM; removing it releases images/fonts.
    useBase64URL: true, experimental: false,
  });
  if (!ctx.alive()) return;
  container.querySelectorAll('a').forEach(a => { a.removeAttribute('href'); a.removeAttribute('target'); });
  let scale = 1;
  const label = el('span', '100%');
  function zoom(value) {
    scale = clamp(value, .5, 2);
    // CSS zoom changes scroll geometry, unlike transform-only scaling.
    container.style.zoom = String(scale);
    label.textContent = `${Math.round(scale * 100)}%`;
  }
  ctx.toolbar.append(button('−', () => zoom(scale - .1)), label, button('+', () => zoom(scale + .1)), button(t('重置', 'Reset'), () => zoom(1)));
  ctx.status.textContent = '';
}
