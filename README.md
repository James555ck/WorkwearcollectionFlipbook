# Cottonridge Workwear Collection - flipbook

A page-turning flipbook of the Cottonridge Workwear Collection brochure, in the same style as the Cottonridge 2027 brochure.
Turn pages by dragging a corner, scrolling, clicking the arrows or using the left/right keys. Zoom with the buttons,
Ctrl + scroll, or `+` `-` `0`. Everything runs in the browser; nothing is sent to a server.

## Downloads
The two buttons top right offer:
- **Download PDF** - `downloads/Cottonridge-Workwear-Collection.pdf`, the finished brochure.
- **Download flipbook (HTML)** - `downloads/Cottonridge-Workwear-Collection-flipbook.html`, the whole flipbook in a single file
  (viewer, page-turning library and every page embedded). Open it in any browser, offline; share it by email. View-only.

Both are rebuilt from the PDF by `tools/build_from_pdf.py`, so they always match the pages on the site.

## Files
- `index.html`, `style.css`, `app.js` - the viewer
- `lib/page-flip.browser.js` - the page-turning library ([StPageFlip](https://github.com/Nodlik/StPageFlip), MIT)
- `pages/p01.jpg` ... - the 16 pages (150 dpi), rendered from the final PDF
- `downloads/` - the PDF and the single-file HTML flipbook offered for download
- `catalog.json` - the page list
- `tools/build_from_pdf.py`, `tools/render_pages.js` - regenerate `pages/` and `catalog.json` from a PDF or from the design file

## Updating the pages
From a finished PDF (this is how the current pages were made):

    pip install pymupdf
    python tools/build_from_pdf.py "path/to/Cottonridge Workwear Collection final.pdf"

Or straight from the design file (`Cottonridge Workwear Collection.dc.html` plus its `assets/` folder):

    cd tools && npm install && cd ..
    node tools/render_pages.js "<folder with the .dc.html and assets>" .

The design-file route needs Google Chrome (set `CHROME` if it is not in the default place).

## Run it locally

    python -m http.server 8080

then open http://localhost:8080
