export let zh = false;
export function setLocale(locale) {
  zh = typeof locale === 'string' && locale.toLowerCase().startsWith('zh');
}
export const t = (cn, en) => zh ? cn : en;
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(label, action) {
  const node = el('button', label);
  node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve().then(action).catch(report); });
  return node;
}
export function iconButton(label, path, action) {
  const node = button('', action);
  node.className = 'icon-button';
  node.title = label;
  node.setAttribute('aria-label', label);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.append(shape);
  node.append(svg);
  return node;
}
export function report(error) {
  const target = document.getElementById('status');
  if (target) {
    target.textContent = `${t('无法完成预览操作', 'Preview operation failed')}: ${String(error?.message || error).slice(0, 400)}`;
    target.setAttribute('role', 'alert');
  }
}
export function input(label, type = 'text') {
  const node = el('input');
  node.type = type;
  node.setAttribute('aria-label', label);
  node.title = label;
  return node;
}
export function numberInput(label, min, max, value) {
  const node = input(label, 'number');
  Object.assign(node, { min: String(min), max: String(max), value: String(value) });
  return node;
}
export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
