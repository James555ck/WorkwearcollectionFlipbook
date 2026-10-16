# Cottonridge Workwear Collection - flipbook

A page-turning flipbook of the Cottonridge Workwear Collection brochure, in the same style as the Cottonridge 2027 brochure.
Turn pages by dragging a corner, scrolling, clicking the arrows or using the left/right keys. Zoom with the buttons,
Ctrl + scroll, or `+` `-` `0`. Everything runs in the browser; nothing is sent to a server.

## Files
- `index.html`, `style.css`, `app.js` - the viewer
- `lib/page-flip.browser.js` - the page-turning library ([StPageFlip](https://github.com/Nodlik/StPageFlip), MIT)
- `pages/p01.jpg` ... - the 16 pages (150 dpi), rendered from the design file
- `catalog.json` - the page list
- `tools/render_pages.js` - regenerates `pages/` and `catalog.json` from the design file

## Updating the pages
The pages come from `Cottonridge Workwear Collection.dc.html` (the design file, with its `assets/` folder). To re-render after
the design changes:

    cd tools && npm install && cd ..
    node tools/render_pages.js "<folder with the .dc.html and assets>" .

Needs Google Chrome (set `CHROME` if it is not in the default place).

## Run it locally

    python -m http.server 8080

then open http://localhost:8080
