"""Render the flipbook's pages from a finished PDF.

Usage:  python tools/build_from_pdf.py "<path to the brochure PDF>"

Writes pages/pNN.jpg (150 dpi, exactly as printed) and catalog.json. The page list, sizes and a build
stamp (added to every image URL so a new import never shows cached pages) go into catalog.json.
Needs pymupdf (pip install pymupdf).
"""
import json
import sys
import time
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
DPI = 150
JPG_QUALITY = 86


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


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
