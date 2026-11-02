"""Render the flipbook's pages from a finished PDF.

Usage:  python tools/build_from_pdf.py "<path to the brochure PDF>"

Writes pages/pNN.jpg (150 dpi, exactly as printed) and catalog.json. The page list, sizes and a build
stamp (added to every image URL so a new import never shows cached pages) go into catalog.json.

It also writes the two files the site offers for download, so they always match the pages:
  downloads/Cottonridge-Workwear-Collection.pdf               a copy of the PDF
  downloads/Cottonridge-Workwear-Collection-flipbook.html     the whole flipbook in ONE file (viewer, library
                                                               and all pages embedded; works offline, view-only)
Needs pymupdf (pip install pymupdf).
"""
import base64
import json
import re
import shutil
import sys
import time
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
DPI = 150
JPG_QUALITY = 86


def build_standalone(catalog: dict) -> Path:
    """One self-contained .html: index.html with the CSS, page-flip library, app and every page image inlined."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    lib = (ROOT / "lib" / "page-flip.browser.js").read_text(encoding="utf-8")
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    images = {p["id"]: "data:image/jpeg;base64," + base64.b64encode((ROOT / "pages" / f"{p['id']}.jpg").read_bytes()).decode()
              for p in catalog["pages"]}
    embedded = "window.EMBEDDED=" + json.dumps({"catalog": catalog, "images": images}, separators=(",", ":")) + ";"
    assert "</script" not in embedded + lib + app          # would end the inline script early

    # literal replacements (a regex replacement string would mangle backslashes in the code)
    def swap(pattern: str, replacement: str) -> None:
        nonlocal html
        found = re.search(pattern, html)
        assert found, f"index.html no longer contains {pattern}"
        html = html[:found.start()] + replacement + html[found.end():]

    swap(r'<link rel="stylesheet" href="style\.css[^"]*">', "<style>" + css + "</style>")
    swap(r'<script src="lib/page-flip\.browser\.js"></script>', "<script>" + lib + "</script>")
    swap(r'<script src="app\.js[^"]*"></script>', "<script>" + embedded + "</script><script>" + app + "</script>")
    swap(r"<body>", '<body class="standalone">')           # hides the download buttons: the copy is view-only
    out = ROOT / "downloads" / "Cottonridge-Workwear-Collection-flipbook.html"
    out.write_text(html, encoding="utf-8")
    return out


def main(pdf_path: str) -> None:
    doc = pymupdf.open(pdf_path)
    out = ROOT / "pages"
    out.mkdir(exist_ok=True)
    for old in out.glob("p*.jpg"):          # a shorter PDF must not leave stale pages behind
        old.unlink()

    pages = []
    for n, page in enumerate(doc, 1):
        pid = f"p{n:02d}"
        page.get_pixmap(dpi=DPI, alpha=False).save(out / f"{pid}.jpg", jpg_quality=JPG_QUALITY)
        pages.append({"id": pid, "src": n, "kind": "cover" if n == 1 else "back" if n == len(doc) else "page"})
        print("rendered", pid)

    first = doc[0].rect
    catalog = {
        "title": "Cottonridge Workwear Collection",
        "pageSize": [round(first.width, 2), round(first.height, 2)],
        "build": str(int(time.time())),
        "pages": pages,
    }
    (ROOT / "catalog.json").write_text(json.dumps(catalog, indent=1), encoding="utf-8")
    print("catalog.json written:", len(pages), "pages")

    (ROOT / "downloads").mkdir(exist_ok=True)
    shutil.copyfile(pdf_path, ROOT / "downloads" / "Cottonridge-Workwear-Collection.pdf")
    out_html = build_standalone(catalog)
    print("downloads written:", out_html.name, round(out_html.stat().st_size / 1e6, 1), "MB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
