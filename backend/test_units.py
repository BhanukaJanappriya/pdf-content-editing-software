import os
import io
import unittest
from reportlab.lib import colors

# Add application path to PYTHONPATH
import sys
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(base_dir)

from app.font_engine import FontEngine
from app.page_manager import PageManager
from app.text_editor import TextEditor
from app.image_editor import ImageEditor
from app.pdf_engine import PDFEngine

class TestFontEngine(unittest.TestCase):
    def setUp(self):
        self.font_eng = FontEngine(cache_dir="test_cache")

    def test_clean_font_name(self):
        self.assertEqual(self.font_eng.clean_font_name("ABCDEF+Arial-BoldMT"), "Arial-BoldMT")
        self.assertEqual(self.font_eng.clean_font_name("/MyCustomFont"), "MyCustomFont")
        self.assertEqual(self.font_eng.clean_font_name("Helvetica"), "Helvetica")

    def test_get_fallback_font(self):
        family, details = self.font_eng.get_fallback_font("Arial-BoldMT")
        self.assertIn("Arial", family)
        self.assertIn("bold", details)

        family, details = self.font_eng.get_fallback_font("TimesNewRoman-Italic")
        self.assertIn("Times", family)
        self.assertIn("italic", details)

        family, details = self.font_eng.get_fallback_font("CourierNew-BoldItalic")
        self.assertIn("monospace", family)
        self.assertIn("bold", details)
        self.assertIn("italic", details)

    def test_get_font_css(self):
        css = self.font_eng.get_font_css("ABCDEF+Arial-Bold", "http://localhost:8000")
        self.assertIn(".font-name-ABCDEF_Arial_Bold", css)
        self.assertIn("font-family: \"Arial-Bold\"", css)


class TestTextEditor(unittest.TestCase):
    def setUp(self):
        self.text_editor = TextEditor()

    def test_hex_to_rl_color(self):
        c = self.text_editor.hex_to_rl_color("#ff0000")
        self.assertEqual(c.red, 1.0)
        self.assertEqual(c.green, 0.0)
        self.assertEqual(c.blue, 0.0)

        c = self.text_editor.hex_to_rl_color("invalid")
        self.assertEqual(c, colors.black)

    def test_map_font_to_reportlab(self):
        self.assertEqual(self.text_editor.map_font_to_reportlab("TimesNewRoman-BoldItalic"), "Times-BoldItalic")
        self.assertEqual(self.text_editor.map_font_to_reportlab("Arial-Bold"), "Helvetica-Bold")
        self.assertEqual(self.text_editor.map_font_to_reportlab("Courier-Oblique"), "Courier-Oblique")


class TestPDFEngine(unittest.TestCase):
    def setUp(self):
        self.pdf_eng = PDFEngine(cache_dir="test_cache")

    def test_parse_color_to_hex(self):
        self.assertEqual(self.pdf_eng.parse_color_to_hex((1.0, 0.0, 0.0)), "#ff0000")
        self.assertEqual(self.pdf_eng.parse_color_to_hex((0, 255, 0)), "#00ff00")
        self.assertEqual(self.pdf_eng.parse_color_to_hex(None), "#000000")

    def test_redacted_boxes(self):
        doc_id = "test_doc"
        self.pdf_eng.add_redacted_box(doc_id, 0, [10.0, 20.0, 50.0, 60.0])
        self.assertIn(doc_id, self.pdf_eng.redacted_boxes)
        self.assertIn(0, self.pdf_eng.redacted_boxes[doc_id])
        self.assertEqual(self.pdf_eng.redacted_boxes[doc_id][0][0], [10.0, 20.0, 50.0, 60.0])

        self.pdf_eng.close_document(doc_id)
        self.assertNotIn(doc_id, self.pdf_eng.redacted_boxes)


class TestPageManager(unittest.TestCase):
    def setUp(self):
        self.page_man = PageManager()
        # Create a tiny 1-page sample document for testing
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(500, 500))
        c.drawString(100, 100, "Hello World")
        c.save()
        self.sample_pdf_bytes = buf.getvalue()

    def test_insert_blank_page(self):
        new_pdf = self.page_man.insert_blank_page(self.sample_pdf_bytes, 0)
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(new_pdf))
        self.assertEqual(len(reader.pages), 2)

    def test_delete_page(self):
        # Insert a page first to make it 2 pages
        pdf_2 = self.page_man.insert_blank_page(self.sample_pdf_bytes, 0)
        pdf_1 = self.page_man.delete_page(pdf_2, 0)
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_1))
        self.assertEqual(len(reader.pages), 1)

    def test_rotate_page(self):
        rotated = self.page_man.rotate_page(self.sample_pdf_bytes, 0, 90)
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(rotated))
        self.assertEqual(reader.pages[0].rotation, 90)

    def test_duplicate_page(self):
        duplicated = self.page_man.duplicate_page(self.sample_pdf_bytes, 0)
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(duplicated))
        self.assertEqual(len(reader.pages), 2)

    def test_reorder_pages(self):
        # Create 2-page document
        pdf_2 = self.page_man.insert_blank_page(self.sample_pdf_bytes, 1)
        reordered = self.page_man.reorder_pages(pdf_2, [1, 0])
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(reordered))
        self.assertEqual(len(reader.pages), 2)


if __name__ == "__main__":
    unittest.main()
