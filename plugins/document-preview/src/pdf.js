import * as pdf from 'pdfjs-dist/build/pdf.mjs';
import { el, t, button, iconButton, input, numberInput, clamp, report } from './ui.js';

export async function render(data, ctx) {
  const workerBytes = await ctx.asset('dist/pdf.worker.mjs');
  if (!ctx.alive()) return;
  const worker = new Worker(ctx.blobURL(workerBytes, 'text/javascript'));
  const pdfWorker = new pdf.PDFWorker({ port: worker });
  let task;
  let renderTask;
  let textLayer;
  let searchGeneration = 0;
  let renderGeneration = 0;
  ctx.onDispose(() => {
    ++searchGeneration; ++renderGeneration;
    renderTask?.cancel(); textLayer?.cancel();
    pdfWorker.destroy();
    worker.terminate();
    pdf.TextLayer.cleanup();
    return task?.destroy();
  });
  // One integrity-checked resource avoids exceeding the host's 100-asset cap
  // (PDF.js alone ships over 100 CMaps). Nothing is fetched over the network.
  let supportPromise;
  async function supportFile(name) {
    supportPromise ||= ctx.asset('dist/pdf-support.json').then(bytes => JSON.parse(new TextDecoder().decode(bytes)));
    const support = await supportPromise;
    if (!Object.hasOwn(support, name)) throw new Error(`Missing bundled PDF resource: ${name}`);
    return Uint8Array.from(atob(support[name]), ch => ch.charCodeAt(0));
  }
  class CMaps { async fetch({ name }) { return { cMapData: await supportFile(`cmaps/${name}.bcmap`), compressionType: 1 }; } }
  class Fonts { fetch({ filename }) { return supportFile(`standard_fonts/${filename}`); } }
  task = pdf.getDocument({
    data, worker: pdfWorker, CMapReaderFactory: CMaps, StandardFontDataFactory: Fonts,
    useWorkerFetch: false, isEvalSupported: false, enableXfa: false,
    maxImageSize: 16 * 1024 * 1024, canvasMaxAreaInBytes: 64 * 1024 * 1024,
    useSystemFonts: true, stopAtErrors: true,
  });
  task.onPassword = (update, reason) => {
    ctx.toolbar.replaceChildren();
    const password = input(t('PDF 密码', 'PDF password'), 'password');
    const unlock = () => { const value = password.value; password.value = ''; update(value); };
    password.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
    ctx.toolbar.append(password, button(t('解锁', 'Unlock'), unlock));
    ctx.status.textContent = reason === pdf.PasswordResponses.INCORRECT_PASSWORD
      ? t('密码不正确，请重试', 'Incorrect password. Try again.')
      : t('此 PDF 需要密码，密码仅用于本地解密', 'This PDF requires a password, used only for local decryption.');
    password.focus();
  };
  worker.addEventListener('error', () => { report(new Error(t('PDF Worker 失败，请重新打开文件', 'PDF worker failed. Reopen the file.'))); void task.destroy().catch(() => {}); });
  const doc = await task.promise;
  if (!ctx.alive()) return;
  ctx.toolbar.replaceChildren();
  let pageNumber = 1;
  let scale = 1;
  let visiblePage;
  let hits = [];
  let hitIndex = -1;
  let query = '';
  let searchNote = '';
  let searching = false;
  let renderQueue = Promise.resolve();
  const pageInput = numberInput(t('页码', 'Page'), 1, doc.numPages, 1);
  pageInput.className = 'page-input';
  const pageCount = el('span', `/ ${doc.numPages}`);
  const zoomSelect = el('select');
  zoomSelect.setAttribute('aria-label', t('缩放', 'Zoom'));
  const zoomLevels = [.25, .5, .75, 1, 1.25, 1.5, 2, 3];
  for (const [value, label] of [['fit', t('适合宽度', 'Fit width')], ...zoomLevels.map(value => [String(value), `${value * 100}%`])]) {
    const option = el('option', label);
    option.value = value;
    zoomSelect.append(option);
  }
  zoomSelect.value = '1';
  const zoomOut = iconButton(t('缩小', 'Zoom out'), 'M5 12h14', () => zoom([...zoomLevels].reverse().find(value => value < scale - .001) ?? .25));
  const zoomIn = iconButton(t('放大', 'Zoom in'), 'M5 12h14M12 5v14', () => zoom(zoomLevels.find(value => value > scale + .001) ?? 3));
  const zoomControls = el('div', undefined, 'toolbar-group zoom-controls');
  zoomControls.append(zoomOut, zoomSelect, zoomIn);
  const search = input(t('搜索文本', 'Search text'), 'search');
  search.maxLength = 200;
  search.placeholder = t('搜索', 'Search');
  const prev = iconButton(t('上一页', 'Previous page'), 'm14 6-6 6 6 6', () => show(pageNumber - 1));
  const next = iconButton(t('下一页', 'Next page'), 'm10 6 6 6-6 6', () => show(pageNumber + 1));
  const findPrev = iconButton(t('上个匹配', 'Previous match'), 'm6 14 6-6 6 6', () => goHit(-1));
  const findNext = iconButton(t('下个匹配', 'Next match'), 'm6 10 6 6 6-6', () => goHit(1));
  const stop = button(t('停止', 'Stop'), () => { ++searchGeneration; searching = false; searchNote = t('搜索已停止，保留已找到结果', 'Search stopped; partial results retained'); highlight(); updateStatus(); });
  stop.setAttribute('aria-label', t('停止搜索', 'Stop search'));
  const clear = iconButton(t('清除搜索', 'Clear search'), 'm6 6 12 12M6 18 18 6', clearSearch);
  const matchCount = el('span', '', 'match-count');
  matchCount.setAttribute('aria-live', 'polite');
  const results = el('div', undefined, 'toolbar-group search-results');
  results.append(matchCount, findPrev, findNext, clear);
  const pages = el('div', undefined, 'toolbar-group page-controls');
  pages.append(prev, pageInput, pageCount, next);
  const findControls = el('div', undefined, 'toolbar-group search-controls');
  findControls.append(search, iconButton(t('搜索', 'Find'), 'M21 21l-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15', find), results, stop);
  ctx.toolbar.classList.add('pdf-toolbar');
  ctx.toolbar.append(pages, zoomControls, findControls);
  results.hidden = stop.hidden = true;
  zoomSelect.addEventListener('change', () => {
    (async () => {
      if (zoomSelect.value === 'fit') {
        const page = await doc.getPage(pageNumber);
        await zoom((ctx.content.clientWidth - 48) / page.getViewport({ scale: 1 }).width, true);
      } else await zoom(Number(zoomSelect.value));
    })().catch(report);
  });
  pageInput.addEventListener('change', () => { show(clamp(pageInput.value, 1, doc.numPages)).catch(report); });
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); (query === search.value.trim() && !searching && hits.length ? goHit(e.shiftKey ? -1 : 1) : find()).catch(report); }
    if (e.key === 'Escape') { e.preventDefault(); clearSearch(); }
  });
  search.addEventListener('input', () => { if (!search.value) clearSearch(); });
  function clearSearch() {
    ++searchGeneration;
    searching = false; query = ''; search.value = ''; hits = []; hitIndex = -1; searchNote = '';
    highlight(); updateStatus();
  }
  function updateStatus() {
    ctx.status.textContent = searchNote;
    ctx.status.setAttribute('role', 'status');
    results.hidden = !query;
    stop.hidden = !searching;
    matchCount.textContent = `${hitIndex + 1}/${hits.length}`;
    matchCount.setAttribute('aria-label', `${t('匹配', 'Matches')}: ${hitIndex + 1}/${hits.length}`);
    findPrev.hidden = findNext.hidden = !hits.length;
    findPrev.disabled = findNext.disabled = !hits.length;
  }
  const fold = text => text.replace(/[A-Z]/g, c => c.toLowerCase());
  function highlight() {
    if (!textLayer) return;
    const strings = textLayer.textContentItemsStr;
    const spans = textLayer.textDivs;
    let offset = 0;
    const pageHits = hits.filter(h => h.page === pageNumber);
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const text = strings[i];
      span.replaceChildren();
      let cursor = 0;
      for (const hit of pageHits) {
        const start = Math.max(0, hit.start - offset);
        const end = Math.min(text.length, hit.end - offset);
        if (end <= start) continue;
        span.append(document.createTextNode(text.slice(cursor, start)));
        const mark = el('mark', text.slice(start, end), `search-hit${hits[hitIndex] === hit ? ' current' : ''}`);
        span.append(mark);
        cursor = end;
      }
      span.append(document.createTextNode(text.slice(cursor)));
      offset += text.length;
    }
  }
  async function zoom(value, fit = false) {
    scale = clamp(value, .25, 3);
    zoomSelect.value = fit ? 'fit' : String(scale);
    zoomOut.disabled = scale <= .25;
    zoomIn.disabled = scale >= 3;
    return show(pageNumber);
  }
  function show(value) {
    pageNumber = clamp(value, 1, doc.numPages);
    const requestedPage = pageNumber;
    const requestedScale = scale;
    const generation = ++renderGeneration;
    renderTask?.cancel(); textLayer?.cancel();
    renderQueue = renderQueue.catch(() => {}).then(async () => {
      if (!ctx.alive() || generation !== renderGeneration) return;
      textLayer = undefined;
      visiblePage?.cleanup();
      const page = await doc.getPage(requestedPage);
      if (!ctx.alive() || generation !== renderGeneration) return;
      visiblePage = page;
      const viewport = page.getViewport({ scale: requestedScale });
      // Explicit canvas cap: large paper sizes cannot allocate an unbounded bitmap.
      const density = Math.min(devicePixelRatio || 1, 2, 16384 / viewport.width, 16384 / viewport.height, Math.sqrt(16 * 1024 * 1024 / (viewport.width * viewport.height)));
      const holder = el('div', undefined, 'pdf-page');
      holder.style.width = `${viewport.width}px`;
      holder.style.height = `${viewport.height}px`;
      holder.style.setProperty('--scale-factor', String(requestedScale));
      const canvas = el('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width * density));
      canvas.height = Math.max(1, Math.floor(viewport.height * density));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('aria-label', t(`PDF 第 ${requestedPage} 页`, `PDF page ${requestedPage}`));
      const layer = el('div', undefined, 'textLayer');
      holder.append(canvas, layer);
      ctx.content.replaceChildren(holder);
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] });
      await renderTask.promise;
      if (!ctx.alive() || generation !== renderGeneration) return;
      textLayer = new pdf.TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport });
      await textLayer.render();
      if (!ctx.alive() || generation !== renderGeneration) return;
      highlight();
      pageInput.value = String(requestedPage);
      zoomSelect.title = `${t('缩放', 'Zoom')}: ${Math.round(requestedScale * 100)}%`;
      prev.disabled = requestedPage === 1;
      next.disabled = requestedPage === doc.numPages;
      updateStatus();
    }).catch(error => { if (error?.name !== 'RenderingCancelledException' && error?.name !== 'AbortException') throw error; });
    return renderQueue;
  }
  async function goHit(direction) {
    if (!hits.length) return;
    hitIndex = hitIndex < 0 ? (direction < 0 ? hits.length - 1 : 0) : (hitIndex + direction + hits.length) % hits.length;
    await show(hits[hitIndex].page);
    ctx.content.querySelector('.current')?.scrollIntoView({ block: 'center' });
  }
  async function find() {
    const generation = ++searchGeneration;
    query = search.value.trim();
    hits = []; hitIndex = -1; searchNote = ''; searching = !!query;
    highlight(); updateStatus();
    if (!query) return;
    try {
    const needle = fold(query);
    let scannedCharacters = 0;
    const pageLimit = Math.min(doc.numPages, 2000);
    for (let pageNo = 1; pageNo <= pageLimit; pageNo++) {
      if (!ctx.alive() || generation !== searchGeneration) return;
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      if (!ctx.alive() || generation !== searchGeneration) return;
      const text = fold(content.items.filter(item => 'str' in item).map(item => item.str).join(''));
      scannedCharacters += text.length;
      for (let at = 0; hits.length < 5000 && (at = text.indexOf(needle, at)) !== -1; at += needle.length) {
        hits.push({ page: pageNo, start: at, end: at + needle.length });
      }
      // Do not evict the displayed/in-progress page's render resources.
      if (pageNo !== pageNumber) page.cleanup();
      searchNote = t(`正在搜索 ${pageNo}/${pageLimit}`, `Searching ${pageNo}/${pageLimit}`);
      updateStatus();
      if (hits.length >= 5000 || scannedCharacters >= 16 * 1024 * 1024) {
        searchNote = t('已达到搜索上限，结果不完整', 'Search limit reached; results are partial');
        break;
      }
      if (pageNo === pageLimit) searchNote = doc.numPages > pageLimit
        ? t('仅搜索了前 2000 页', 'Searched only the first 2000 pages')
        : hits.length ? '' : t('未找到匹配；扫描图片不支持文字搜索', 'No matches. Scanned images do not have searchable text.');
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!ctx.alive() || generation !== searchGeneration) return;
    if (hits.length) { hitIndex = 0; await show(hits[0].page); ctx.content.querySelector('.current')?.scrollIntoView({ block: 'center' }); }
    else { highlight(); updateStatus(); }
    } finally {
      if (ctx.alive() && generation === searchGeneration) { searching = false; updateStatus(); }
    }
  }
  await show(1);
}
