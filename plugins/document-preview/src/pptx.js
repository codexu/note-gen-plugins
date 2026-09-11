import { PptxViewer, parseZipLazyMedia, buildPresentation } from '@aiden0z/pptx-renderer';
import { el, t, iconButton, numberInput, clamp, report } from './ui.js';

export async function render(data, ctx) {
  ctx.status.textContent = t('正在解析演示文稿…', 'Reading presentation…');
  ctx.content.classList.add('pptx-content');
  const container = el('div', undefined, 'pptx-container');
  ctx.content.append(container);
  ctx.content.tabIndex = 0;
  ctx.content.setAttribute('aria-label', t('幻灯片预览', 'Slide preview'));
  // Keep document-authored links and shape actions inert, including slide jumps.
  const blockAction = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  container.addEventListener('click', blockAction, true);
  container.addEventListener('auxclick', blockAction, true);
  let viewer;
  let observer;
  let timer;
  let disposed = false;
  const dispose = () => {
    disposed = true;
    clearTimeout(timer);
    observer?.disconnect();
    viewer?.destroy();
    container.replaceChildren();
    ctx.setHostStatus('');
  };
  ctx.onDispose(dispose);
  const files = await parseZipLazyMedia(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
    maxEntries: 4096, maxEntryUncompressedBytes: 32 * 1048576,
    maxTotalUncompressedBytes: 96 * 1048576, maxMediaBytes: 64 * 1048576, maxConcurrency: 2,
  });
  if (!ctx.alive()) return;
  // ZIP text decoding retains UTF-8 BOMs as U+FEFF. WebKit's DOMParser can
  // reject that character before an XML declaration, losing relationships
  // (and therefore every slide). Strip only the encoding marker, including
  // from layout/master/media relationship parts; leave binary media intact.
  for (const [key, value] of Object.entries(files)) {
    if (typeof value === 'string') files[key] = value.replace(/^\uFEFF/, '');
    else if (value instanceof Map) {
      for (const [path, xml] of value) {
        if (typeof xml === 'string') value.set(path, xml.replace(/^\uFEFF/, ''));
      }
    }
  }
  for (const xml of [files.presentation, files.presentationRels]) {
    if (new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')) {
      throw new Error(t('演示文稿目录或页面关系 XML 无法解析', 'Invalid presentation or slide relationship XML'));
    }
  }
  const presentation = buildPresentation(files, { lazySlides: true });
  if (!presentation.slides.length) throw new Error(t('演示文稿没有幻灯片', 'The presentation has no slides'));
  if (presentation.slides.length > 300) throw new Error(t('最多支持 300 张幻灯片', 'At most 300 slides are supported'));
  if (![presentation.width, presentation.height].every(value => Number.isFinite(value) && value > 0 && value <= 20000)) {
    throw new Error(t('幻灯片尺寸无效或过大', 'Invalid or oversized slide dimensions'));
  }
  let slide = 0;
  let zoomPercent = 100;
  let fit = true;
  let revision = 0;
  let queue = Promise.resolve();
  let renderError = false;
  viewer = new PptxViewer(container, {
    fitMode: 'none', pdfjs: false, scrollContainer: ctx.content,
    onSlideError: (_index, error) => { if (!disposed) { renderError = true; report(error); } },
    onNodeError: () => {
      if (!disposed) { renderError = true; report(new Error(t('部分幻灯片内容无法显示', 'Some slide content could not be displayed'))); }
    },
  });
  viewer.load(presentation);
  const pageInput = numberInput(t('页码', 'Page'), 1, viewer.slideCount, 1);
  pageInput.className = 'page-input';
  const prev = iconButton(t('上一页', 'Previous page'), 'm14 6-6 6 6 6', () => go(slide - 1));
  const next = iconButton(t('下一页', 'Next page'), 'm10 6 6 6-6 6', () => go(slide + 1));
  const pages = el('div', undefined, 'toolbar-group page-controls');
  pages.append(prev, pageInput, el('span', `/ ${viewer.slideCount}`), next);
  const levels = [10, 25, 50, 75, 100, 125, 150, 200, 300];
  const select = el('select');
  select.setAttribute('aria-label', t('缩放', 'Zoom'));
  for (const [value, label] of [['fit', t('适合窗口', 'Fit window')], ...levels.map(value => [String(value), `${value}%`])]) {
    const option = el('option', label); option.value = value; select.append(option);
  }
  select.value = 'fit';
  const smaller = iconButton(t('缩小', 'Zoom out'), 'M5 12h14', () => zoom([...levels].reverse().find(value => value < zoomPercent - .01) ?? 10));
  const larger = iconButton(t('放大', 'Zoom in'), 'M5 12h14M12 5v14', () => zoom(levels.find(value => value > zoomPercent + .01) ?? 300));
  const zoomControls = el('div', undefined, 'toolbar-group zoom-controls');
  zoomControls.append(smaller, select, larger);
  ctx.toolbar.classList.add('pptx-toolbar');
  ctx.toolbar.append(pages, zoomControls);
  const alive = () => !disposed && ctx.alive();
  function updateControls() {
    pageInput.value = String(slide + 1);
    prev.disabled = slide === 0; next.disabled = slide === viewer.slideCount - 1;
    smaller.disabled = zoomPercent <= 10; larger.disabled = zoomPercent >= 300;
    select.title = `${t('缩放', 'Zoom')}: ${Math.round(zoomPercent)}%`;
  }
  function show(resetScroll = false) {
    const ownRevision = ++revision;
    queue = queue.catch(() => {}).then(async () => {
      if (!alive() || ownRevision !== revision) return;
      if (fit && ctx.content.clientWidth && ctx.content.clientHeight) {
        zoomPercent = clamp(Math.min((ctx.content.clientWidth - 32) / presentation.width,
          (ctx.content.clientHeight - 32) / presentation.height) * 100, 10, 300);
      }
      renderError = false;
      // Enter single-slide mode before changing zoom: the upstream default
      // render mode would otherwise mount the entire deck on the first zoom.
      await viewer.renderSlide(slide);
      if (!alive() || ownRevision !== revision) return;
      await viewer.setZoom(zoomPercent);
      if (!alive() || ownRevision !== revision) return;
      updateControls();
      if (resetScroll) { ctx.content.scrollLeft = 0; ctx.content.scrollTop = 0; }
      const statistics = t(`第 ${slide + 1} / ${viewer.slideCount} 页`, `Slide ${slide + 1} / ${viewer.slideCount}`);
      const hostStatus = ctx.setHostStatus(statistics);
      if (!renderError) { ctx.status.removeAttribute('role'); ctx.status.textContent = hostStatus ? '' : statistics; }
    });
    return queue;
  }
  function go(value) { slide = Math.round(clamp(value, 0, viewer.slideCount - 1)); return show(true); }
  function zoom(value) { fit = false; zoomPercent = value; select.value = String(value); return show(); }
  pageInput.addEventListener('change', () => { go(Number(pageInput.value) - 1).catch(report); });
  select.addEventListener('change', () => {
    if (select.value === 'fit') { fit = true; show(true).catch(report); }
    else zoom(Number(select.value)).catch(report);
  });
  ctx.content.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = { ArrowLeft: slide - 1, ArrowRight: slide + 1, PageUp: slide - 1,
      PageDown: slide + 1, Home: 0, End: viewer.slideCount - 1 }[event.key];
    if (target !== undefined) { event.preventDefault(); go(target).catch(report); }
  });
  observer = new ResizeObserver(() => {
    if (!fit || !alive()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (fit && alive()) show().catch(report); }, 100);
  });
  observer.observe(ctx.content);
  await show(true);
}
