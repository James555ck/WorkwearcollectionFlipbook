/* Render the Workwear Collection's pages from its design file (no PDF).
 *
 *   node tools/render_pages.js "<design folder>" [out folder]
 *
 * Reads "Cottonridge Workwear Collection.dc.html" from the design folder, finds every A4 page box that is
 * actually shown (the file also holds hidden alternates), puts them in reading order and writes
 *   pages/pNN.jpg         150 dpi page images
 *   catalog.json          page list for the viewer
 *
 * Needs Google Chrome (set CHROME to use another path) and playwright-core (`npm install` in tools/).
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const [designDir, outArg] = process.argv.slice(2);
if (!designDir) { console.error('usage: node tools/render_pages.js "<design folder>" [out folder]'); process.exit(1); }
const outDir = path.resolve(outArg || path.join(__dirname, '..'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'Cottonridge Workwear Collection.dc.html';
const SCALE = 150 / 72;                       // 150 dpi from CSS px at 72 per inch
const A4 = { w: 595.28, h: 841.89 };

const fileUrl = (f) => 'file:///' + path.resolve(designDir, f).split(path.sep).join('/').split(' ').join('%20');

async function main() {
  const pagesDir = path.join(outDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: SCALE });
  await page.goto(fileUrl(FILE), { waitUntil: 'load' });
  await page.waitForSelector('[data-screen-label]');
  await page.waitForTimeout(3000);

  // make sure every image (background or <img>) has loaded before anything is captured
  await page.evaluate(async () => {
    const urls = new Set();
    document.querySelectorAll('*').forEach((el) => {
      for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) urls.add(m[1]);
      if (el.tagName === 'IMG' && el.src) urls.add(el.src);
    });
    await Promise.all([...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; })));
  });
  await page.waitForTimeout(1500);

  // tag each A4 box that is really on screen (hidden alternates have display:none ancestors), in reading order
  const count = await page.evaluate(([w, h]) => {
    const isBox = (d) => d.style.position === 'relative' && d.style.width === w + 'px' && d.style.height === h + 'px';
    const shown = [...document.querySelectorAll('div')].filter((d) => isBox(d) && d.getClientRects().length > 0);
    shown.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return Math.round(ra.top + window.scrollY) - Math.round(rb.top + window.scrollY) || ra.left - rb.left;
    });
    shown.forEach((d, i) => d.setAttribute('data-pg', String(i + 1)));
    return shown.length;
  }, [A4.w, A4.h]);
  console.log('page boxes found:', count);

  const pages = [];
  for (let n = 1; n <= count; n++) {
    const loc = page.locator(`[data-pg="${n}"]`);
    await loc.scrollIntoViewIfNeeded();
    const id = 'p' + String(n).padStart(2, '0');
    await loc.screenshot({ type: 'jpeg', quality: 86, path: path.join(pagesDir, id + '.jpg') });
    pages.push({ id, src: n, kind: n === 1 ? 'cover' : n === count ? 'back' : 'page' });
    console.log('rendered', id);
  }
  await browser.close();

  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify({
    title: 'Cottonridge Workwear Collection',
    pageSize: [A4.w, A4.h],
    build: String(Math.floor(Date.now() / 1000)),   // stamped on every image URL so a new render never shows cached pages
    pages,
  }, null, 1));
  console.log('catalog.json written:', pages.length, 'pages');
}

main().catch((e) => { console.error(e); process.exit(1); });
