import { el, t, button, numberInput, clamp, report } from './ui.js';

export async function render(bytes, ctx) {
  ctx.content.classList.add('sheet-content');
  const workerBytes = await ctx.asset('dist/xlsx.worker.js');
  if (!ctx.alive()) return;
  const worker = new Worker(ctx.blobURL(workerBytes, 'text/javascript'));
  let serial = 0;
  let stopped = false;
  const pending = new Map();
  const shutdown = (error = new Error('Preview closed')) => {
    ctx.setHostStatus('');
    stopped = true;
    worker.terminate();
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); }
    pending.clear();
  };
  ctx.onDispose(shutdown);
  worker.onerror = () => shutdown(new Error(t('工作表解析失败', 'Workbook worker failed')));
  worker.onmessage = ({ data }) => {
    const task = pending.get(data?.id);
    if (!task) return;
    pending.delete(data.id); clearTimeout(task.timer);
    data.error ? task.reject(new Error(data.error)) : task.resolve(data.result);
  };
  function request(fields, transfer = []) {
    if (stopped) return Promise.reject(new Error(t('解析器已停止，请重新打开文件', 'Parser stopped. Reopen the file.')));
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => shutdown(new Error(t('解析超过 30 秒，已停止，请使用桌面 Office 打开', 'Parsing exceeded 30 seconds and was stopped. Open in desktop Office.'))), 30000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ ...fields, id }, transfer);
    });
  }
  ctx.status.textContent = t('正在解析工作簿…', 'Parsing workbook…');
  const sheets = await request({ method: 'open', bytes }, [bytes.buffer]);
  const select = el('select');
  select.setAttribute('aria-label', t('工作表', 'Worksheet'));
  for (const sheet of sheets) {
    const option = el('option', `${sheet.name}${sheet.hidden ? t('（隐藏）', ' (hidden)') : ''}`);
    option.value = String(sheet.index); select.append(option);
  }
  let current = 0;
  let row = 0;
  let generation = 0;
  const rowInput = numberInput(t('起始行', 'Starting row'), 1, 100000, 1);
  const prev = button(t('上 100 行', 'Previous 100 rows'), () => { row = Math.max(0, row - 100); return show(); });
  const next = button(t('下 100 行', 'Next 100 rows'), () => { row += 100; return show(); });
  ctx.toolbar.append(select, prev, el('span', t('行', 'Row')), rowInput, next);
  select.addEventListener('change', () => { current = Number(select.value); row = 0; ctx.content.scrollLeft = 0; show().catch(report); });
  rowInput.addEventListener('change', () => { row = clamp(rowInput.value, 1, 100000) - 1; show().catch(report); });
  async function show() {
    const local = ++generation;
    ctx.setHostStatus('');
    const bounds = sheets[current].bounds;
    row = clamp(row, 0, Math.max(0, (bounds?.rows || 1) - 1));
    const page = await request({ method: 'page', sheet: current, row });
    if (!ctx.alive() || local !== generation) return;
    const table = el('table', undefined, 'sheet-grid');
    table.style.width = `${48 + page.columns.length * 180}px`;
    table.setAttribute('aria-label', sheets[current].name);
    const head = el('thead');
    const headings = el('tr');
    headings.append(el('th', '#'));
    page.columns.forEach(name => { const th = el('th', name); th.scope = 'col'; headings.append(th); });
    head.append(headings);
    const body = el('tbody');
    page.rows.forEach((cells, index) => {
      const tr = el('tr');
      const th = el('th', String(page.row + index + 1)); th.scope = 'row'; tr.append(th);
      cells.forEach(cell => {
        const td = el('td', cell.missing ? t('无缓存结果', 'No cached result') : cell.value);
        td.title = cell.formula ? `=${cell.formula}` : cell.value;
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(head, body);
    const scrollLeft = ctx.content.scrollLeft;
    ctx.content.replaceChildren(table);
    ctx.content.scrollLeft = scrollLeft;
    ctx.content.scrollTop = 0;
    rowInput.value = String(page.row + 1);
    prev.disabled = !page.row;
    next.disabled = !bounds || page.row + 100 >= bounds.rows;
    rowInput.max = String(bounds?.rows || 1);
    const statistics = bounds
      ? `${bounds.sourceRows} ${t('行', 'rows')} × ${bounds.sourceColumns} ${t('列', 'columns')}${bounds.truncated ? t(' · 仅浏览前 100000 行 / 256 列', ' · Browsing first 100000 rows / 256 columns only') : ''}`
      : t('空工作表', 'Empty worksheet');
    ctx.status.textContent = ctx.setHostStatus(statistics) ? '' : statistics;
  }
  await show();
}
