import io
import os
import pypdf
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from typing import Dict, Any, List

class ImageEditor:
    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    def delete_image(
        self, 
        doc_bytes: bytes, 
        page_num: int, 
        bbox: List[float],
        page_width: float,
        page_height: float
    ) -> bytes:
        """Deletes an image by covering it with a white rectangle."""
        x0, top, x1, bottom = bbox
        rect_x = x0
        rect_y = page_height - bottom
        rect_w = x1 - x0
        rect_h = bottom - top

        # Build white overlay
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        can.setFillColor(colors.white)
        can.rect(rect_x - 1, rect_y - 1, rect_w + 2, rect_h + 2, fill=True, stroke=False)
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

    def move_resize_image(
        self,
        doc_bytes: bytes,
        page_num: int,
        old_bbox: List[float],
        new_bbox: List[float],
        xref: int,
        page_width: float,
        page_height: float
    ) -> bytes:
        """
        Moves/Resizes an image:
        1. Covers the old image location with white.
        2. Re-draws the image object (by extracting it) in the new position.
        """
        x0_old, top_old, x1_old, bottom_old = old_bbox
        x0_new, top_new, x1_new, bottom_new = new_bbox

        rect_x_old = x0_old
        rect_y_old = page_height - bottom_old
        rect_w_old = x1_old - x0_old
        rect_h_old = bottom_old - top_old

        rect_x_new = x0_new
        rect_y_new = page_height - bottom_new
        rect_w_new = x1_new - x0_new
        rect_h_new = bottom_new - top_new

        # Attempt to extract the image bytes from the PDF using pypdf
        temp_img_path = None
        try:
            reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
            page = reader.pages[page_num]
            # Get images list
            images = list(page.images)
            if xref < len(images):
                img_file = images[xref]
                temp_img_path = os.path.join(self.cache_dir, f"temp_move_{xref}.png")
                with open(temp_img_path, "wb") as f:
                    f.write(img_file.data)
        except Exception as e:
            print(f"Warning: Could not extract original image bytes for movement ({e}). Redraw fallback.")

        # Build overlay
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        # Cover old position with white
        can.setFillColor(colors.white)
        can.rect(rect_x_old - 1, rect_y_old - 1, rect_w_old + 2, rect_h_old + 2, fill=True, stroke=False)
        
        # Draw image at new position if extracted, otherwise draw border outline placeholder
        if temp_img_path and os.path.exists(temp_img_path):
            can.drawImage(temp_img_path, rect_x_new, rect_y_new, width=rect_w_new, height=rect_h_new)
        else:
            # Placeholder outline
            can.setFillColor(colors.lightgrey)
            can.rect(rect_x_new, rect_y_new, rect_w_new, rect_h_new, fill=True, stroke=True)
            can.setFillColor(colors.black)
            can.setFont("Helvetica-Bold", 8)
            can.drawCentredString(rect_x_new + rect_w_new/2.0, rect_y_new + rect_h_new/2.0, "Image Moved")

        can.save()

        # Clean up temp file
        if temp_img_path and os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass

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

    def replace_image(
        self,
        doc_bytes: bytes,
        page_num: int,
        bbox: List[float],
        new_image_path: str,
        page_width: float,
        page_height: float
    ) -> bytes:
        """Replaces an image by covering it and drawing a new image file on top."""
        if not os.path.exists(new_image_path):
            raise FileNotFoundError(f"New image file not found: {new_image_path}")

        x0, top, x1, bottom = bbox
        rect_x = x0
        rect_y = page_height - bottom
        rect_w = x1 - x0
        rect_h = bottom - top

        # Build overlay
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        # Cover old image
        can.setFillColor(colors.white)
        can.rect(rect_x - 1, rect_y - 1, rect_w + 2, rect_h + 2, fill=True, stroke=False)
        
        # Draw new image
        can.drawImage(new_image_path, rect_x, rect_y, width=rect_w, height=rect_h)
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
