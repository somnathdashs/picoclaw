---
name: handle-any-pdf-works
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, OCR on scanned or multilingual PDFs, combining or merging multiple PDFs, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, and extracting images. If the user mentions a .pdf file or asks to produce one, use this skill.
---

# Handle Any PDF Works

## Overview

Essential PDF operations using Python libraries and command-line tools. For advanced features and JavaScript libraries, see reference.md. To fill out a PDF form, read forms.md and follow its instructions.

## Step 0: Triage Before Reading

Never assume a PDF is text or scanned. Classify each page first, because many PDFs are mixed (some pages digital, some scanned).

```python
import pdfplumber

def triage(path, min_chars=50):
    """Return {page_number: 'text' | 'scan'} for every page."""
    result = {}
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            txt = (page.extract_text() or "").strip()
            result[i] = "text" if len(txt) >= min_chars else "scan"
    return result
```

Then route:

| Page type | Route |
|---|---|
| `text` | Extract directly (pdfplumber / pypdf / pdftotext). No OCR. |
| `scan` | OCR pipeline below. |
| Garbled text (random symbols, wrong characters) | The text layer is broken (common with legacy Indic fonts). Treat as `scan`. |
| Complex layout, stamps, handwriting, tables in scans | Visual reading (see "Vision Fallback"). |

## Quick Start

```python
from pypdf import PdfReader

reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

text = ""
for page in reader.pages:
    text += (page.extract_text() or "")
```

## Reading Scanned and Multilingual PDFs (OCR)

### 1. Check what is installed

```bash
which tesseract && tesseract --list-langs
python3 -c "import pytesseract, pdf2image, cv2; print('ok')"
```

Install what is missing. The network may be restricted to package registries, so the Tesseract binary and language packs may not be installable. If so, use the Vision Fallback.

```bash
pip install --break-system-packages pytesseract pdf2image opencv-python-headless pillow langdetect
# apt-based systems (if allowed):
# apt-get install -y tesseract-ocr tesseract-ocr-hin tesseract-ocr-ben tesseract-ocr-ori poppler-utils
```

### 2. Choose the languages

- **Ask or detect** which languages appear. Do not blindly stack every language, because accuracy drops as more are added.
- Use Tesseract codes joined with `+`, with the primary language first: `eng+hin`, `eng+ben`, `eng+ori`.
- Common codes: `eng`, `hin` (Hindi), `ben` (Bengali), `ori` (Odia), `tam`, `tel`, `mar`, `guj`, `pan`, `urd`, `ara`, `rus`, `chi_sim`, `jpn`, `kor`, `deu`, `fra`, `spa`.
- Check availability with `tesseract --list-langs`. A missing pack gives an error, so drop it or fall back.
- Prefer the `tessdata_best` models for Indic and other complex scripts when available.

To detect the language from a quick first pass:

```python
from langdetect import detect_langs
print(detect_langs(sample_text))   # e.g. [en:0.7, hi:0.3]
```

Note that langdetect needs some text, so run a first OCR with `eng+hin` (or your best guess), then refine.

### 3. Preprocess the image

Preprocessing often improves accuracy more than changing the OCR engine.

```python
import cv2, numpy as np

def preprocess(pil_img):
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)
    img = cv2.fastNlMeansDenoising(img, None, 15, 7, 21)           # denoise
    img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 31, 11)          # binarize
    return img

def deskew(gray):
    coords = np.column_stack(np.where(gray < 128))
    if len(coords) < 100:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)
```

Rules of thumb:
- Render at **300 DPI** (400 for small print or Indic scripts). Below 200 DPI accuracy drops sharply.
- Skip binarization for clean, high-contrast scans, since it can hurt. Test both on one page.
- Auto-rotate pages with `pytesseract.image_to_osd` if pages may be sideways.

### 4. Full pipeline (mixed PDFs, confidence-aware)

```python
import pdfplumber, pytesseract
from pdf2image import convert_from_path

def read_pdf(path, langs="eng", dpi=300, min_chars=50, conf_threshold=60):
    pages_out = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = (page.extract_text() or "").strip()
            if len(text) >= min_chars:
                pages_out.append({"page": i, "method": "text", "text": text, "conf": None})
                continue

            # Render only this page, not the whole document
            img = convert_from_path(path, dpi=dpi, first_page=i, last_page=i)[0]
            gray = deskew(preprocess(img))

            data = pytesseract.image_to_data(
                gray, lang=langs, config="--oem 1 --psm 3",
                output_type=pytesseract.Output.DICT)
            words = [(w, int(c)) for w, c in zip(data["text"], data["conf"])
                     if w.strip() and int(c) >= 0]
            text = " ".join(w for w, _ in words)
            conf = sum(c for _, c in words) / len(words) if words else 0

            pages_out.append({"page": i, "method": "ocr", "text": text,
                              "conf": round(conf, 1),
                              "needs_review": conf < conf_threshold})
    return pages_out
```

Notes:
- `--oem 1` selects the LSTM engine. `--psm 3` is automatic page segmentation. Try `--psm 6` for a single uniform block, `--psm 4` for columns, `--psm 11` for sparse text.
- For long PDFs, render and OCR page by page (as above) to keep memory low.
- Always keep page numbers in the output so results can be cited and checked.
- Save the output to a file (`.txt`, `.md` or `.json`) instead of printing very long text.

### 5. Vision Fallback (when OCR is weak or unavailable)

Use this when: Tesseract or its language packs are not installable, confidence is low, the script is rare, the page is handwritten, or the layout is complex (tables, stamps, forms, multi-column, mixed scripts on one line).

1. Render the page to PNG: `pdftoppm -r 150 -png -f N -l N input.pdf page` (150 DPI is usually enough for visual reading and keeps images small).
2. Open the image with the Read tool so it is viewed directly, and transcribe or translate from what is visible.
3. Do this only for the pages that need it, not the whole document.

Be honest about uncertainty. If a word, number or stamp is illegible, mark it `[illegible]` instead of guessing. Never invent text for names, dates, amounts, or ID numbers. Flag them for the user to verify.

### 6. Output for the user

- Say which pages were read directly, which were OCR'd, and which languages were used.
- List low-confidence pages (`needs_review`).
- If the user wants translation, transcribe first, then translate, and keep both when accuracy matters.
- Produce a searchable PDF only if asked (see "Make a Searchable PDF").

### Make a Searchable PDF

```bash
# Requires ocrmypdf (pip install ocrmypdf) plus tesseract and language packs
ocrmypdf -l eng+hin --deskew --rotate-pages --skip-text input.pdf searchable.pdf
```

`--skip-text` leaves pages that already have text untouched, which is right for mixed PDFs.

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        print(page.extract_text())
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        for table in page.extract_tables():
            if table:
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

Tables in scanned pages cannot be read by `extract_tables()`. OCR the page, or use the Vision Fallback and rebuild the table by hand.

### reportlab - Create PDFs

#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")
c.line(100, height - 140, 400, height - 140)
c.save()
```

#### Multi-Page PDF
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = [Paragraph("Report Title", styles["Title"]), Spacer(1, 12),
         Paragraph("This is the body of the report. " * 20, styles["Normal"]),
         PageBreak(),
         Paragraph("Page 2", styles["Heading1"]),
         Paragraph("Content for page 2", styles["Normal"])]
doc.build(story)
```

#### Non-Latin Text in New PDFs
reportlab's default fonts cannot draw Hindi, Bengali, Odia, Arabic, CJK, etc. Register a Unicode TTF font that covers the script (for example a Noto font) or the text will appear as blank boxes.

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("NotoDeva", "NotoSansDevanagari-Regular.ttf"))
c.setFont("NotoDeva", 12)
```

Complex scripts need text shaping, which reportlab does not do well. For reliable output in Indic scripts or Arabic, generate HTML and convert it with a shaping-capable renderer (for example Chromium or WeasyPrint).

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
pdftotext input.pdf output.txt
pdftotext -layout input.pdf output.txt
pdftotext -f 1 -l 5 input.pdf output.txt
```

### pdftoppm / pdfimages (poppler-utils)
```bash
pdftoppm -r 300 -png input.pdf page        # render pages to PNG for OCR or viewing
pdfimages -list input.pdf                  # a page with one big image and no text = scan
pdfimages -j input.pdf output_prefix       # extract embedded images
```

### qpdf
```bash
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf output.pdf --rotate=+90:1
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
pdftk file1.pdf file2.pdf cat output merged.pdf
pdftk input.pdf burst
pdftk input.pdf rotate 1east output rotated.pdf
```

## Common Tasks

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

watermark = PdfReader("watermark.pdf").pages[0]
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)

writer.encrypt("userpassword", "ownerpassword")
with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

If a PDF is password-protected, ask the user for the password. Do not try to guess or brute-force it.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Extracted text is empty | Scanned PDF | OCR pipeline |
| Extracted text is gibberish or wrong glyphs | Broken font encoding (common in legacy Indic fonts) | Treat as scan: render and OCR |
| `TesseractError: Failed loading language 'xyz'` | Language pack not installed | `tesseract --list-langs`, install the pack, or use Vision Fallback |
| OCR output has many wrong characters | Low DPI, skew, noise | Re-render at 300-400 DPI, deskew, denoise, try without binarization |
| Words merged or columns interleaved | Wrong page segmentation | Try `--psm 4` or `--psm 6` |
| Very slow OCR | Too many languages or huge pages | Limit languages, process page by page, lower DPI only if quality allows |
| Right-to-left text appears reversed | Extraction order issue | Check with a visual read of the page before trusting order |

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Classify page types | pdfplumber | `triage(path)` |
| Extract text (digital) | pdfplumber | `page.extract_text()` |
| Extract text (scanned) | pytesseract + preprocessing | `read_pdf(path, langs="eng+hin")` |
| Hard / handwritten / rare script | Vision Fallback | `pdftoppm` then Read the PNG |
| Searchable PDF from scan | ocrmypdf | `ocrmypdf -l eng+hin --skip-text` |
| Extract tables (digital) | pdfplumber | `page.extract_tables()` |
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Create PDFs | reportlab | Canvas or Platypus (register fonts for non-Latin) |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| Fill PDF forms | pdf-lib or pypdf | See forms.md |

## Next Steps

- For advanced pypdfium2 usage, see reference.md
- For JavaScript libraries (pdf-lib), see reference.md
- To fill out a PDF form, follow the instructions in forms.md
