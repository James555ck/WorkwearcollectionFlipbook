/* Cottonridge Workwear Collection flipbook.
 *
 * Pages are plain images listed in catalog.json (see tools/build_from_pdf.py). In a two-page view the
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
  /** A page's image: embedded in the single-file copy, a file on the site. */
  function pageSrc(p) {
    return window.EMBEDDED ? window.EMBEDDED.images[p.id] : `pages/${p.id}.jpg?v=${catalog.build}`;
  }

  function pageEl(p) {
    const el = document.createElement('div');
    el.className = 'page';
    if (p.edge) { el.classList.add('edge'); return el; }
    const img = document.createElement('img');
    img.src = pageSrc(p);
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
    if (window.__ui) window.__ui(i, landscape);
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

  // ---- wrapper: counter, thumbnails, full screen, PDF, welcome screen ----------------
  const N = catalog => catalog.pages.length;
  window.__ui = function (i, landscape) {
    if (!catalog) return;
    const shown = [layout[i], landscape ? layout[i + 1] : null].filter((p) => p && !p.edge)
      .map((p) => catalog.pages.findIndex((q) => q.id === p.id) + 1);
    const total = N(catalog);
    $('count').textContent = shown.length === 2 ? `Pages ${shown[0]} and ${shown[1]} of ${total}` : `Page ${shown[0]} of ${total}`;
    document.querySelectorAll('#thumbs button').forEach((b) => b.classList.toggle('on', shown.includes(+b.dataset.n)));
  };

  function buildThumbs() {
    const box = $('thumbs');
    catalog.pages.forEach((p, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.n = k + 1; b.setAttribute('aria-label', 'Go to page ' + (k + 1));
      const im = document.createElement('img'); im.src = pageSrc(p); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      b.appendChild(im);
      b.onclick = () => {
        if (!flip) return;
        const landscape = flip.getOrientation() === 'landscape';
        let idx = landscape ? (k % 2 === 0 ? k + 1 : k) : k;   // spreads start on an even layout index
        if (landscape) idx = (k + 1) % 2 === 0 ? k + 1 : k;
        flip.turnToPage(idx); applyState(flip.getCurrentPageIndex());
      };
      box.appendChild(b);
    });
  }
  $('thumbtoggle').onclick = () => {
    const open = $('thumbs').classList.toggle('open');
    $('thumbtoggle').textContent = open ? 'Hide pages' : 'Show all pages';
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  };

  // full screen (hidden where the browser does not support it, e.g. iPhone)
  const root = document.documentElement;
  const canFS = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  if (!canFS) $('fs').style.display = 'none';
  $('fs').onclick = () => {
    const on = document.fullscreenElement || document.webkitFullscreenElement;
    try { on ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : (root.requestFullscreen || root.webkitRequestFullscreen).call(root); } catch (e) {}
  };

  // welcome screen
  const intro = $('intro');
  function enter() { intro.classList.add('gone'); }
  $('enter').onclick = enter;
  intro.addEventListener('click', (e) => { if (e.target === intro) enter(); });
  document.addEventListener('keydown', (e) => { if (!intro.classList.contains('gone') && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); enter(); } }, true);

  // PDF built in the browser from the page images already in this file, so it works offline
  function jpegSize(bytes) {
    let p = 2;
    while (p < bytes.length) {
      if (bytes[p] !== 0xFF) { p++; continue; }
      const m = bytes[p + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
        return { h: (bytes[p + 5] << 8) | bytes[p + 6], w: (bytes[p + 7] << 8) | bytes[p + 8], comps: bytes[p + 9] };
      p += 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
    }
    return { w: 1240, h: 1754, comps: 3 };
  }
  function makePDF() {
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const push = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
    const obj = (n, head, stream) => {
      offs[n] = len; push(`${n} 0 obj\n${head}`);
      if (stream) { push(`\nstream\n`); push(stream); push(`\nendstream`); }
      push(`\nendobj\n`);
    };
    const pgs = catalog.pages, n = pgs.length;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${pgs.map((_, k) => `${3 + k * 3} 0 R`).join(' ')}] >>`);
    const W = 595.28, H = 841.89;
    pgs.forEach((p, k) => {
      const b64 = window.EMBEDDED.images[p.id].split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let q = 0; q < bin.length; q++) bytes[q] = bin.charCodeAt(q);
      const sz = jpegSize(bytes), pn = 3 + k * 3, cn = pn + 1, im = pn + 2;
      obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`);
      const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
      obj(cn, `<< /Length ${content.length} >>`, enc.encode(content));
      obj(im, `<< /Type /XObject /Subtype /Image /Width ${sz.w} /Height ${sz.h} /ColorSpace ${sz.comps === 1 ? '/DeviceGray' : '/DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>`, bytes);
    });
    const total = 3 + n * 3, xref = len;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let k = 1; k < total; k++) push(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  $('pdf').onclick = () => {
    if (!window.EMBEDDED) {                       // on the site: the finished PDF
      const a = document.createElement('a'); a.href = 'downloads/Cottonridge-Workwear-Collection.pdf'; a.download = 'Cottonridge-Workwear-Collection-2027.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const b = $('pdf'), label = b.textContent; b.disabled = true; b.textContent = 'Preparing PDF…';
    setTimeout(() => {
      try {
        const url = URL.createObjectURL(makePDF());
        const a = document.createElement('a'); a.href = url; a.download = 'Cottonridge-Workwear-Collection-2027.pdf';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) { alert('Sorry, the PDF could not be prepared on this device.'); }
      b.disabled = false; b.textContent = label;
    }, 30);
  };

  async function init() {
    try {
      // the downloadable HTML copy carries its catalog and page images inside the file
      catalog = window.EMBEDDED ? window.EMBEDDED.catalog
        : await (await fetch('catalog.json?t=' + Date.now(), { cache: 'no-store' })).json();
    } catch (e) {
      status.textContent = 'Could not load the brochure.';
      return;
    }
    [pageW, pageH] = catalog.pageSize;
    applyZoom();
    buildThumbs();
    buildBook();
  }

  init();
})();
