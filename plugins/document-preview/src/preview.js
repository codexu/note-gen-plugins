import { el, t, report, setLocale } from './ui.js';
import { inspectOfficeZip } from './zip.js';
import css from './style.css';

let started = false;
// Must be installed synchronously: the host transfers the port once.
window.addEventListener('message', event => {
  if (started || event.data?.type !== 'notegen:preview-init' || event.data.protocol !== 1 || event.ports.length !== 1) return;
  started = true;
  setLocale(event.data.locale);
  const port = event.ports[0];
  const pending = new Map();
  const urls = new Set();
  const cleanups = [];
  let serial = 0;
  let disposed = false;
  const style = el('style', css);
  document.head.append(style);
  document.documentElement.lang = t('zh-CN', 'en');
  document.title = String(event.data.name || 'Document');
  const toolbar = el('nav');
  toolbar.setAttribute('aria-label', t('预览工具', 'Preview controls'));
  const status = el('p', t('正在读取文档…', 'Reading document…'));
  status.id = 'status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const content = el('main');
  document.body.append(toolbar, status, content);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.reverse()) { try { Promise.resolve(cleanup()).catch(() => {}); } catch {} }
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Preview closed')); }
    pending.clear();
    port.close();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  port.onmessage = ({ data }) => {
    const task = pending.get(data?.id);
    if (!task) return;
    pending.delete(data.id);
    clearTimeout(task.timer);
    if (data.error) task.reject(new Error(String(data.error)));
    else if (!(data.result instanceof Uint8Array)) task.reject(new Error('Invalid preview response'));
    else task.resolve(data.result);
  };
  function request(fields) {
    if (disposed) return Promise.reject(new Error('Preview closed'));
    // All callers serialize IO. PDF font requests use the queue below as well.
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(t('读取超时，请重新打开文件', 'Read timed out. Reopen the file.'))); }, 30000);
      pending.set(id, { resolve, reject, timer });
      port.postMessage({ id, ...fields });
    });
  }
  let queue = Promise.resolve();
  const read = fields => {
    const result = queue.then(() => request(fields));
    queue = result.catch(() => {});
    return result;
  };
  const asset = path => read({ method: 'readAsset', path });
  const blobURL = (bytes, type) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    urls.add(url);
    return url;
  };
  const setHostStatus = text => {
    if (disposed || event.data.capabilities?.statusBar !== true) return false;
    port.postMessage({ type: 'notegen:preview-status', text: String(text).slice(0, 240) });
    return true;
  };
  const ctx = { toolbar, content, status, asset, blobURL, setHostStatus, onDispose: fn => cleanups.push(fn), alive: () => !disposed };
  async function open() {
    const kind = String(event.data.name).split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'xlsx', 'pptx'].includes(kind)) throw new Error(t('暂不支持该格式', 'Unsupported format'));
    const limit = Math.min(Number(event.data.sizeLimit) || 256 * 1048576, (kind === 'pdf' ? 128 : 32) * 1048576);
    const chunks = [];
    let length = 0;
    for (;;) {
      const bytes = await read({ method: 'readDocument', offset: length, length: Math.min(1048576, limit - length + 1) });
      if (!bytes.length) break;
      length += bytes.length;
      if (length > limit) throw new Error(t(`预览上限为 ${limit / 1048576} MiB`, `Preview limit: ${limit / 1048576} MiB`));
      chunks.push(bytes);
      status.textContent = t(`已读取 ${(length / 1048576).toFixed(1)} MiB…`, `Read ${(length / 1048576).toFixed(1)} MiB…`);
    }
    if (!length) throw new Error(t('文件为空', 'The file is empty'));
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    chunks.length = 0;
    if (kind !== 'pdf') inspectOfficeZip(data, kind);
    const script = el('script');
    script.src = blobURL(await asset(`dist/${kind}.js`), 'text/javascript');
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error(t('无法加载随包渲染器', 'Cannot load the bundled renderer')));
      document.head.append(script);
    });
    if (!ctx.alive()) return;
    await globalThis.NoteGenPreviewRenderer.render(data, ctx);
  }
  open().catch(error => { report(error); dispose(); });
});
