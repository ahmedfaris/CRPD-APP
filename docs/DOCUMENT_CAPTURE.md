# Document capture — scanning, OCR and PDF/A

How scanned paper gets into the Letters Archive.

```
 MFP scan-to-folder ─┐
 Vendor ISIS/TWAIN   ├─► hot folder ─┐
 capture software ───┘               │
 Desk scanner (TWAIN) ─► scan agent ─┼─► capture queue ─► barcode/QR separation ─► OCR ara+eng
 Browser upload ─────────────────────┘                    deskew · despeckle · rotate ─► PDF/A-2b
                                                                       │
                       clerk reviews in "Scanning and indexing" ◄──────┘
                       └─► register as a new letter / attach to an existing record
```

## What happens to each batch

1. **Normalize**: PDF, multi-page TIFF, JPEG and PNG files become one PDF, in order.
2. **Barcodes and QR codes** are read on every page (zbar, 200 dpi).
   - A **separator sheet** (`LAS1|SEP|…` QR, printed from *Scanning and indexing → Separator sheets*)
     starts a new document and is removed. Its code carries indexing data: registry unit, category,
     urgency, confidentiality, sender. A 1D barcode reading `LAS-SEP` also works as a plain separator.
   - A **record label** (`LAS1|REC|IN/D1-02/2026/0145`, printed from a record) links the page's
     document to that record, so the clerk can attach it in one click.
3. **OCR** with OCRmyPDF and Tesseract in **Arabic and English**: automatic page rotation,
   **deskew**, **despeckle** (unpaper), 300 dpi oversampling for OCR.
4. **Layout preserved**: the stored file is the scanned image, with an invisible text layer placed at
   the same positions as the words, so text can be searched, selected and read by screen readers.
5. **PDF/A-2b (ISO 19005-2)** output. The file's PDF/A claim is checked after conversion. If
   `VERAPDF_BIN` points to [veraPDF](https://verapdf.org), every file is also validated independently.
6. The document appears in its registry desk's **indexing queue**. The clerk sees the PDF, the OCR
   text and the barcode data, and then registers it, attaches it to an existing record, or discards it
   (with a reason). Every step is in the audit log.

Scans attached directly in a form (not through capture) are also converted in the background: a
searchable PDF/A copy is added next to the original.

OCR text is searchable (Arabic-normalized: أ/إ/آ, ة/ه, ى/ي), and the *Read text* button shows it as
an accessible text view.

## Accuracy

Measured on a noisy 150 dpi Arabic test letter: about 78% of words were read correctly with these
settings (39% without oversampling). A clean page read at about 93%. For best results:

- scan at **300 dpi**, greyscale;
- build the Docker image with `TESSDATA=best` (Tesseract's more accurate Arabic model; the default
  `docker-compose.yml` does this).

## Installing the processing tools

**Docker (recommended)**: everything is in the image.

```bash
docker compose up -d --build
```

Put hot folders under `./hotfolders` on the host (or set `HOTFOLDERS_DIR`), share them with the MFPs,
and add each one in *Scanning and indexing → Capture settings* with its container path, for example
`/hotfolders/registry-d1`.

**Linux without Docker**:

```bash
sudo apt-get install tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng unpaper ghostscript qpdf poppler-utils zbar-tools python3-venv
```

```bash
sudo python3 -m venv /opt/ocrmypdf
```

```bash
sudo /opt/ocrmypdf/bin/pip install "ocrmypdf==16.10.4" "pikepdf==9.11.0" "img2pdf==0.5.1"
```

Then start the app with `OCRMYPDF_BIN=/opt/ocrmypdf/bin/ocrmypdf` and
`IMG2PDF_BIN=/opt/ocrmypdf/bin/img2pdf`.

Without the tools, uploads and hot folders still work: batches wait as *Waiting for OCR tools* and
are processed once the tools are installed. *Capture settings* shows what is missing.

## Settings

| Environment variable | Default | Meaning |
|---|---|---|
| `OCRMYPDF_BIN`, `TESSERACT_BIN`, `ZBARIMG_BIN`, `QPDF_BIN`, `PDFTOPPM_BIN`, `IMG2PDF_BIN` | on `PATH` | Tool locations |
| `PIKEPDF_PYTHON` | OCRmyPDF's Python | Python used to read the PDF/A claim back |
| `VERAPDF_BIN` | — | Optional independent PDF/A validation |
| `CAPTURE_ROOT` | `./capture` | Work area for batches waiting to be indexed |
| `LAS_ARCHIVE_ROOT` | `./letters archive` | Archive file storage |
| `CAPTURE_CONCURRENCY` | `1` | Batches processed at the same time |

Hot folders, OCR languages, parallel OCR jobs, polling interval and despeckling of the stored image
are set in *Scanning and indexing → Capture settings* (administrators only).

## Desk scanners

- **TWAIN**: install the scanning agent on the registry PC (`tools/scan-agent`, see its README).
  The clerk presses *Start scanning* in the browser.
- **ISIS**: ISIS drivers need the vendor's licensed SDK, so use the vendor capture program
  (PaperStream Capture, Kodak Capture Pro, Kofax Express…) and save into a hot folder.

## Tests

`tests/las-capture-test.mjs` runs the whole flow against a server with the tools installed. It
covers:

- a hot folder pickup;
- separation by separator sheets;
- OCR and PDF/A;
- registering and attaching scans;
- OCR search;
- the agent's ticket upload;
- automatic conversion of uploaded scans;
- failures and retry;
- permissions and the audit log.

Generate its test scans with `tests/capture-fixtures/make.cjs` and `scanify.py`.
`tests/capture-fixtures/fake-agent.cjs` stands in for the Windows agent in browser tests.
