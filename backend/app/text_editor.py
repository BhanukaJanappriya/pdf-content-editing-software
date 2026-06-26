import io
import pypdf
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from typing import Dict, Any, Tuple, Optional
from app.font_engine import FontEngine

class TextEditor:
    def __init__(self):
        pass

    def hex_to_rl_color(self, hex_color: str) -> colors.Color:
        try:
            hex_color = hex_color.lstrip('#')
            if len(hex_color) != 6:
                return colors.black
            r = int(hex_color[0:2], 16) / 255.0
            g = int(hex_color[2:4], 16) / 255.0
            b = int(hex_color[4:6], 16) / 255.0
            return colors.Color(r, g, b)
        except Exception:
            return colors.black

    def map_font_to_reportlab(self, font_name: str) -> str:
        name = font_name.lower()
        is_bold = "bold" in name or "black" in name
        is_italic = "italic" in name or "oblique" in name
        
        if "serif" in name or "times" in name or "roman" in name or "georgia" in name:
            if is_bold and is_italic:
                return "Times-BoldItalic"
            elif is_bold:
                return "Times-Bold"
            elif is_italic:
                return "Times-Italic"
            else:
                return "Times-Roman"
        elif "mono" in name or "courier" in name or "consolas" in name:
            if is_bold and is_italic:
                return "Courier-BoldOblique"
            elif is_bold:
                return "Courier-Bold"
            elif is_italic:
                return "Courier-Oblique"
            else:
                return "Courier"
        else:
            if is_bold and is_italic:
                return "Helvetica-BoldOblique"
            elif is_bold:
                return "Helvetica-Bold"
            elif is_italic:
                return "Helvetica-Oblique"
            else:
                return "Helvetica"

    def clean_original_text_from_page(self, page: pypdf.PageObject, text_to_remove: str):
        """
        Locates word bytes in the page content streams, replaces them with spaces,
        and saves it back by replacing page['/Contents'] with a new DecodedStreamObject.
        """
        if not text_to_remove:
            return
            
        try:
            contents = page.get_contents()
            if contents is None:
                return
                
            data = contents.get_data()
            words = text_to_remove.split()
            targets = [text_to_remove] + words
            
            modified = False
            for target in targets:
                if len(target) < 2:
                    continue
                target_bytes = target.encode('latin-1', errors='ignore')
                if target_bytes in data:
                    replacement = b' ' * len(target_bytes)
                    data = data.replace(target_bytes, replacement)
                    modified = True
                    
                target_utf8 = target.encode('utf-8', errors='ignore')
                if target_utf8 in data and target_utf8 != target_bytes:
                    replacement = b' ' * len(target_utf8)
                    data = data.replace(target_utf8, replacement)
                    modified = True
                    
            if modified:
                from pypdf.generic import DecodedStreamObject, NameObject
                new_stream = DecodedStreamObject()
                new_stream.set_data(data)
                page[NameObject('/Contents')] = new_stream
        except Exception as e:
            print(f"Error cleaning original text: {e}")

    def edit_span(
        self, 
        doc_bytes: bytes, 
        page_num: int, 
        span_id: str, 
        new_text: str,
        page_width: float,
        page_height: float,
        span_layout_data: Dict[str, Any]
    ) -> bytes:
        """
        Edits a single text span:
        1. Cleans the original text structurally from the content stream.
        2. Draws the replacement text onto an overlay.
        3. Merges the overlay onto the page.
        """
        bbox = span_layout_data["bbox"]
        font_name = span_layout_data["font"]
        font_size = span_layout_data["size"]
        color_hex = span_layout_data["color"]
        old_text = span_layout_data["text"]

        x0, top, x1, bottom = bbox
        rect_x = x0
        rect_y = page_height - bottom
        rect_w = x1 - x0
        rect_h = bottom - top
        
        # 1. Build Overlay PDF
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        # Cover visually (for background safety)
        can.setFillColor(colors.white)
        can.rect(rect_x - 1, rect_y - 1, rect_w + 2, rect_h + 2, fill=True, stroke=False)
        
        # Draw new text
        rl_color = self.hex_to_rl_color(color_hex)
        can.setFillColor(rl_color)
        rl_font = self.map_font_to_reportlab(font_name)
        can.setFont(rl_font, font_size)
        
        can.drawString(rect_x, rect_y + 1, new_text)
        can.save()
        
        packet.seek(0)
        overlay_pdf = pypdf.PdfReader(packet)
        overlay_page = overlay_pdf.pages[0]

        # 2. Merge and Clean
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                # Structurally erase target text stream objects
                self.clean_original_text_from_page(page, old_text)
                page.merge_page(overlay_page)
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def edit_block_paragraph(
        self,
        doc_bytes: bytes,
        page_num: int,
        block_id: str,
        new_text: str,
        page_width: float,
        page_height: float,
        block_layout_data: Dict[str, Any],
        font_name: Optional[str] = None,
        font_size: Optional[float] = None,
        color_hex: Optional[str] = None,
        align: int = 0
    ) -> bytes:
        block_bbox = block_layout_data["bbox"]
        
        first_span = None
        for line in block_layout_data.get("lines", []):
            for span in line.get("spans", []):
                first_span = span
                break
            if first_span:
                break
                
        if not first_span:
            return doc_bytes

        if not font_name:
            font_name = first_span["font"]
        if not font_size:
            font_size = first_span["size"]
        if not color_hex:
            color_hex = first_span["color"]

        # Coordinates
        x0, top, x1, bottom = block_bbox
        rect_x = x0
        rect_y = page_height - bottom
        rect_w = x1 - x0
        rect_h = bottom - top

        # Build overlay
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        can.setFillColor(colors.white)
        can.rect(rect_x - 1, rect_y - 1, rect_w + 2, rect_h + 2, fill=True, stroke=False)
        
        rl_color = self.hex_to_rl_color(color_hex)
        rl_font = self.map_font_to_reportlab(font_name)
        
        rl_align = align
        if align == 3:
            rl_align = 4
            
        style = ParagraphStyle(
            'ReflowStyle',
            fontName=rl_font,
            fontSize=font_size,
            leading=font_size * 1.3,
            textColor=rl_color,
            alignment=rl_align
        )
        
        html_text = new_text.replace('\n', '<br/>')
        paragraph = Paragraph(html_text, style)
        
        frame = Frame(
            rect_x, 
            rect_y, 
            rect_w, 
            rect_h, 
            topPadding=0, 
            bottomPadding=0, 
            leftPadding=0, 
            rightPadding=0
        )
        frame.addFromList([paragraph], can)
        can.save()
        
        packet.seek(0)
        overlay_pdf = pypdf.PdfReader(packet)
        overlay_page = overlay_pdf.pages[0]

        # Merge and clean
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        # Gather all text spans in the block to remove them structurally
        texts_to_remove = []
        for line in block_layout_data.get("lines", []):
            line_text = "".join(s["text"] for s in line["spans"])
            texts_to_remove.append(line_text)
            for s in line["spans"]:
                texts_to_remove.append(s["text"])

        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                for text in texts_to_remove:
                    self.clean_original_text_from_page(page, text)
                page.merge_page(overlay_page)
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def add_new_text(
        self,
        doc_bytes: bytes,
        page_num: int,
        x: float,
        y: float,
        text: str,
        page_width: float,
        page_height: float,
        font_name: str = "Helvetica",
        font_size: float = 11.0,
        color_hex: str = "#000000"
    ) -> bytes:
        rect_x = x
        rect_y = page_height - y
        
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        rl_color = self.hex_to_rl_color(color_hex)
        can.setFillColor(rl_color)
        rl_font = self.map_font_to_reportlab(font_name)
        can.setFont(rl_font, font_size)
        
        can.drawString(rect_x, rect_y, text)
        can.save()
        
        packet.seek(0)
        overlay_pdf = pypdf.PdfReader(packet)
        overlay_page = overlay_pdf.pages[0]

        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                page.merge_page(overlay_page)
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()
