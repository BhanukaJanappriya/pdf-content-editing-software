# AcrobatEdit - Premium Layout-Preserving PDF Editor for Windows

AcrobatEdit is a lightweight, modern, and user-friendly desktop PDF editing application. It features a premium, layout-preserving text editing engine that behaves like Microsoft Word within absolute-positioned PDF page layers.

## 🚀 Key Features
- **Accurate PDF Text Editing**: Double-click text to edit inline. Preserves colors, fonts, margins, character spacing, alignment, and wrapping without shifting other layouts.
- **True structural deletions**: Deletes text objects physically from the page content streams (no white rectangle mask cover-ups).
- **Text Reflow Engine**: Group words into paragraphs and reflow line-wrapping dynamically with justification, left, center, or right alignments.
- **Embedded Font Extraction & Fallbacks**: Detects embedded document fonts, maps them dynamically to frontend styling, and supports intelligent font fallback matching.
- **Image Editor**: Drag and drop images to reposition, bottom-right corners to resize, or replace images with local files.
- **Page Manager**: Visual sidebar thumbnails supporting rotation, duplication, re-ordering, additions, and deletions.
- **OCR Support**: Scans image-only PDFs using Tesseract OCR, overlaying searchable and editable text layers on top of the scanned pages.
- **Undo / Redo Stack**: Fully functional multi-page undo/redo capability across all features (text edits, images, page trees).

---

## 🛠️ Technology Stack
- **Frontend**: Electron, React, TypeScript, Tailwind CSS (v3), Lucide Icons.
- **Backend (Sidecar)**: Python, FastAPI, Uvicorn, pypdf, pdfplumber, pdfminer.six, pypdfium2, reportlab, pytesseract.

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js**: v20 or newer (v22 recommended)
- **Python**: v3.10 or newer (v3.14 recommended)
- **Tesseract OCR (Optional)**: Install Tesseract-OCR and ensure `tesseract.exe` is in your system PATH (or installed in standard locations like `C:\Program Files\Tesseract-OCR\`) to run OCR.

### Step 1: Install Python Backend Dependencies
From the repository root, run:
```bash
python -m pip install -r backend/requirements.txt
```

### Step 2: Install Frontend Node Dependencies
From the repository root, run:
```bash
npm install
```

---

## 🏃 Run in Development Mode
During development, run the following command in the repository root:
```bash
npm run dev
```
This single command automatically launches the FastAPI Python backend as a background child process, bundles Electron's main/preload scripts, and spins up the React-Vite hot-reloading desktop window.

---

## 🏗️ Building for Production
To package the application into a standalone Windows executable (`.exe`):
1. Package the Python backend using PyInstaller:
   ```bash
   pyinstaller --onedir --noconsole --name=pdf_backend backend/app/main.py
   ```
2. Build and compile the Electron React app:
   ```bash
   npm run build
   ```
3. Bundle them together using Electron Builder:
   ```bash
   npx electron-builder
   ```

---

## 📂 Architecture & Technical Workings

### 1. Text Parsing & Coordinates Mapping
We use the pure-Python `pdfplumber` library to scan documents. It parses text elements in browser-friendly screen-coordinates (top-left system: `x0`, `top`, `x1`, `bottom`).
The layout parser:
- Groups characters into lines using vertical tolerances.
- Groups lines into paragraphs (blocks) using vertical line-spacing heights.
- Extracts font names, font sizes, colors, bold/italic, and baseline alignment.

### 2. Live Dynamic Frontend Editing
When a document is loaded, the backend returns details for all text spans. The React app renders a page canvas and overlays absolute-positioned `<div class="text-span-editable">` elements. Double-clicking any div replaces it with an HTML `<input>` or `<textarea>` element matching the font size, color, family, and alignment coordinates exactly.

### 3. Acrobat-Style Structural Deletions & Replacements
Replacing words by just layering white rectangles is unprofessional (leaving text searchable). We achieve true object removal:
- Locate the original characters inside the page content stream (`page.get_contents()`).
- Rewrite the page `/Contents` stream dictionary by substituting the target text characters with spaces.
- Create a ReportLab canvas containing:
  - A white rectangle covering the bounding box.
  - The new text string drawn at the target coordinates using standard fonts.
- Merge the ReportLab overlay on top of the original page stream using `page.merge_page()`.
- Save the result.

### 4. In-Memory Transaction History (Undo/Redo)
Because PDF stream modifications occur on the backend, standard React state undos are insufficient. The FastAPI server maintains a document bytes stack (`self.undo_stack` and `self.redo_stack`). Each transaction saves page-byte snapshots. Calling `/undo` or `/redo` pops the previous state, re-opens the document, and refreshes the layout immediately.

---

## 🧪 Running Tests
We have integrated comprehensive unit and integration test suites for the PDF processing engine.

### 1. Run Unit Tests
To test isolated engine components (Fonts, Pages, Images, Text):
```bash
python backend/test_units.py
```

### 2. Run Integration Tests
To test the end-to-end PDF layout parsing and stream modification flow:
```bash
python backend/test_backend.py
```

These suites test:
1. Isolated class units for Font, Page, Image, and Text editors.
2. Sample document loading and metadata extraction.
3. In-memory font scanning.
4. Word grouping and coordinates extraction.
5. Structurally replacing text strings and merging overlays.
6. Paragraph reflowing and text justification inside a bounded frame.
7. Page duplications and rotations.
