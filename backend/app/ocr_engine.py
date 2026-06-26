import io
import os
import pypdf
import pypdfium2 as pdfium
import pytesseract
from PIL import Image
from typing import List, Dict, Any, Optional

class OCREngine:
    def __init__(self):
        self.tesseract_cmd: Optional[str] = None
        standard_windows_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.expanduser(r"~\AppData\Local\Tesseract-OCR\tesseract.exe")
        ]
        
        try:
            pytesseract.get_tesseract_version()
        except pytesseract.TesseractNotFoundError:
            for path in standard_windows_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    self.tesseract_cmd = path
                    break

    def is_tesseract_available(self) -> bool:
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def ocr_page(self, doc_bytes: bytes, page_num: int, lang: str = "eng") -> bytes:
        """
        Runs OCR on a scanned page using pypdfium2 for rendering and pytesseract for OCR,
        then replaces the scanned page with the text-searchable OCR page.
        """
        if not self.is_tesseract_available():
            raise RuntimeError(
                "Tesseract OCR is not installed or not found in system PATH. "
                "Please install Tesseract-OCR to run OCR on scanned documents."
            )

        lang_map = {
            "english": "eng",
            "sinhala": "sin",
            "tamil": "tam",
            "eng": "eng",
            "sin": "sin",
            "tam": "tam"
        }
        tess_lang = lang_map.get(lang.lower(), "eng")

        # 1. Render page to PIL image using pypdfium2 at high DPI
        try:
            doc = pdfium.PdfDocument(doc_bytes)
            if page_num < 0 or page_num >= len(doc):
                raise IndexError("Page index out of range")
            page = doc[page_num]
            
            # scale=4 gives ~288 DPI (72 * 4) which is perfect for OCR
            bitmap = page.render(scale=4)
            pil_img = bitmap.to_pil()
            
            # Close pdfium refs
            page.close()
            doc.close()
        except Exception as e:
            raise RuntimeError(f"Failed to render page for OCR: {str(e)}")

        # 2. Run OCR and output PDF bytes containing the image and text overlay
        try:
            ocr_pdf_bytes = pytesseract.image_to_pdf_or_hocr(pil_img, lang=tess_lang, extension='pdf')
        except Exception as e:
            raise RuntimeError(f"Tesseract OCR processing failed: {str(e)}")

        # 3. Replace page in original document using pypdf
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        ocr_reader = pypdf.PdfReader(io.BytesIO(ocr_pdf_bytes))
        ocr_page = ocr_reader.pages[0]

        writer = pypdf.PdfWriter()
        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                # Replace with ocr_page
                writer.add_page(ocr_page)
            else:
                writer.add_page(page)

        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def ocr_document(self, doc_bytes: bytes, lang: str = "eng") -> bytes:
        """Runs OCR page by page on the full document bytes."""
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        page_count = len(reader.pages)
        
        current_bytes = doc_bytes
        for pno in range(page_count):
            current_bytes = self.ocr_page(current_bytes, pno, lang)
            
        return current_bytes
