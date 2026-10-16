/* Cottonridge Workwear Collection flipbook.
 *
 * Pages are plain images listed in catalog.json (see tools/render_pages.js). In a two-page view the
 * cover and back cover each sit alone beside a see-through blank page, so they turn like any other
 * page. Turning (wheel, keys, arrows) follows the Cottonridge brochure: wheel movement is summed to a
 * threshold, and turns asked for mid-flip (up to 2) are queued and played straight after.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const wrap = $('bookwrap'), zoomer = $('zoomer'), status = $('status');
  const prevBtn = $('prev'), nextBtn = $('next');
  const FLIP_MS = 480;                       // one constant speed for every turn

  let catalog = null;
  let flip = null;
  let layout = [];                           // what the engine shows: pages, plus see-through end blanks in a two-page view
  let dims = { pw: 0, ph: 0, portrait: false };
  let pageW = 595.28, pageH = 841.89;

  // ---- sizing -----------------------------------------------------------------
  /** Largest page size whose spread (or single page on narrow screens) fits the stage. */
  function measure() {
    const aw = wrap.clientWidth - 8, ah = wrap.clientHeight - 8;
    const portrait = aw < 640 || aw / ah < 1.0;
    const ratio = (portrait ? 1 : 2) * pageW / pageH;
    const w = Math.min(aw, ah * ratio);
    return { pw: Math.floor(w / (portrait ? 1 : 2)), ph: Math.floor(w / ratio), portrait };
  }

  function place(book) {
    const w = dims.pw * (dims.portrait ? 1 : 2), h = dims.ph;
    book.style.width = w + 'px';
    book.style.height = h + 'px';
    book.style.left = Math.floor((wrap.clientWidth - w) / 2) + 'px';
    book.style.top = Math.floor((wrap.clientHeight - h) / 2) + 'px';
  }

  // ---- book -------------------------------------------------------------------
  function pageEl(p) {
    const el = document.createElement('div');
    el.className = 'page';
    if (p.edge) { el.classList.add('edge'); return el; }
    const img = document.createElement('img');
    img.src = `pages/${p.id}.jpg?v=${catalog.build}`;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    el.appendChild(img);
    return el;
  }

  function buildBook() {
    // keep the reader on the same page after a rebuild (e.g. a resize)
    const here = flip && layout[flip.getCurrentPageIndex()];
    const hereId = here && !here.edge ? here.id : null;

    resetGo();
    if (flip) { try { flip.destroy(); } catch (e) { /* already gone */ } flip = null; }
    zoomer.innerHTML = '';

    dims = measure();
    if (dims.pw < 50 || dims.ph < 50) { status.hidden = false; return; }   // stage not laid out yet: the resize observer retries

    layout = dims.portrait ? catalog.pages.slice()
      : [{ edge: true }, ...catalog.pages, ...(catalog.pages.length % 2 === 0 ? [{ edge: true }] : [])];

    // The engine sizes itself from its container's parent, so give it a frame we control.
    const book = document.createElement('div');
    book.id = 'book';
    const host = document.createElement('div');
    book.appendChild(host);
    zoomer.appendChild(book);
    place(book);

    flip = new St.PageFlip(host, {
      width: dims.pw, height: dims.ph, size: 'fixed',
      minWidth: 100, maxWidth: 2000, minHeight: 140, maxHeight: 2800,
      showCover: false, usePortrait: true, mobileScrollSupport: false,
      maxShadowOpacity: 0.3, drawShadow: true, flippingTime: FLIP_MS, useMouseEvents: true,
    });
    flip.loadFromHTML(layout.map(pageEl));
    flip.on('flip', () => { if (!busy) applyState(flip.getCurrentPageIndex()); });
    flip.on('changeOrientation', () => applyState(flip.getCurrentPageIndex()));

    if (hereId) {
      const idx = layout.findIndex((p) => p.id === hereId);
      if (idx > 1) flip.turnToPage(idx);
    }
    applyState(flip.getCurrentPageIndex());
    status.hidden = true;
  }

  /** Button states and cover/back-cover centring for the spread that starts at page index i. */
  function applyState(i) {
    if (!flip) return;
    const n = flip.getPageCount();
    const landscape = flip.getOrientation() === 'landscape';
    const last = landscape ? n - 2 : n - 1;
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= last;
    // the cover and back cover sit alone on one half of the spread: slide the book to centre them
    let shift = 0;
    if (landscape && i === 0) shift = -25;
    else if (landscape && i >= last && layout[layout.length - 1].edge) shift = 25;
    const book = $('book');
    if (book) book.style.transform = `translateX(${shift}%)`;
  }

  // ---- turning pages ----------------------------------------------------------
  let busy = false, queued = 0, queuedDir = 0, busyTimer = 0;

  function resetGo() { clearTimeout(busyTimer); busy = false; queued = 0; queuedDir = 0; wheelAcc = 0; }

  function go(dir) {
    if (!flip) return;
    if (busy) {                                           // remember up to two turns for when this one lands
      if (queuedDir && queuedDir !== dir) queued = 0;
      queuedDir = dir;
      queued = Math.min(queued + 1, 2);
      return;
    }
    const landscape = flip.getOrientation() === 'landscape', n = flip.getPageCount();
    const last = landscape ? n - 2 : n - 1, cur = flip.getCurrentPageIndex();
    const target = Math.max(0, Math.min(last, cur + dir * (landscape ? 2 : 1)));
    if (target === cur) { queued = 0; return; }
    busy = true;
    busyTimer = setTimeout(finishGo, FLIP_MS * 0.8);      // free again a little before the animation ends
    applyState(target);                                   // start centring the cover/back now, not after
    if (dir > 0) flip.flipNext(); else flip.flipPrev();
  }

  function finishGo() {
    if (!flip) return;
    if (flip.getState() !== 'read') { busyTimer = setTimeout(finishGo, 16); return; }
    applyState(flip.getCurrentPageIndex());
    busy = false;
    if (queued > 0) { const d = queuedDir; queued--; if (!queued) queuedDir = 0; go(d); }
  }

  prevBtn.onclick = () => go(-1);
  nextBtn.onclick = () => go(1);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.5);
    else if (e.key === '-' || e.key === '_') setZoom(zoom / 1.5);
    else if (e.key === '0') setZoom(1);
  });

  // scroll turns pages: wheel movement is summed to a threshold, then one turn fires
  let wheelAcc = 0, wheelIdle = 0;
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { setZoom(zoom * Math.exp(-e.deltaY * 0.01)); return; }
    if (zoom > 1) { panX -= e.deltaX; panY -= e.deltaY; applyZoom(); return; }
    wheelAcc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelAcc = 0; }, 120);
    if (Math.abs(wheelAcc) >= 50) {
      const dir = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      go(dir);
    }
  }, { passive: false });

  // ---- zoom -------------------------------------------------------------------
  const Z_MIN = 1, Z_MAX = 4;
  let zoom = 1, panX = 0, panY = 0;

  function applyZoom() {
    const mx = (zoom - 1) * wrap.clientWidth / 2, my = (zoom - 1) * wrap.clientHeight / 2;
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
    if (zoom === 1) panX = panY = 0;
    zoomer.style.transform = zoom === 1 ? '' : `translate(${panX}px,${panY}px) scale(${zoom})`;
    wrap.classList.toggle('zoomed', zoom > 1);
    $('zv').textContent = Math.round(zoom * 100) + '%';
    $('zout').disabled = zoom <= Z_MIN;
    $('zin').disabled = zoom >= Z_MAX;
    $('zreset').disabled = zoom === 1;
  }
  function setZoom(z) { zoom = Math.max(Z_MIN, Math.min(Z_MAX, Math.round(z * 100) / 100)); applyZoom(); }

  $('zin').onclick = () => setZoom(zoom * 1.5);
  $('zout').onclick = () => setZoom(zoom / 1.5);
  $('zreset').onclick = () => setZoom(1);

  // drag to pan while zoomed
  let drag = null;
  wrap.addEventListener('pointerdown', (e) => {
    if (zoom <= 1) return;
    drag = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    wrap.classList.add('panning');
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    panX = drag.px + e.clientX - drag.x;
    panY = drag.py + e.clientY - drag.y;
    applyZoom();
  });
  const endDrag = () => { drag = null; wrap.classList.remove('panning'); };
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  // rebuild at the new size when the stage changes (window resize, fonts settling, phone rotation)
  let rz;
  new ResizeObserver(() => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!catalog) return;
      if (!flip) { buildBook(); return; }                 // first build was skipped (stage had no size yet)
      const d = measure();
      if (d.portrait !== dims.portrait || Math.abs(d.pw - dims.pw) > 2 || Math.abs(d.ph - dims.ph) > 2) buildBook();
      applyZoom();
    }, 150);
  }).observe(wrap);

  // ---- init -------------------------------------------------------------------
  async function init() {
    try {
      catalog = await (await fetch('catalog.json?t=' + Date.now(), { cache: 'no-store' })).json();
    } catch (e) {
      status.textContent = 'Could not load the brochure.';
      return;
    }
    [pageW, pageH] = catalog.pageSize;
    $('title').textContent = catalog.title;
    document.title = catalog.title;
    applyZoom();
    buildBook();
  }

  init();
})();
