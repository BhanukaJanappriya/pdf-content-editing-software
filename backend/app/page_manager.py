import io
import pypdf
from typing import List

class PageManager:
    def __init__(self):
        pass

    def insert_blank_page(
        self, 
        doc_bytes: bytes, 
        at_page: int, 
        width: float = 595.0, 
        height: float = 842.0
    ) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        # Copy pages
        for idx, page in enumerate(reader.pages):
            if idx == at_page:
                writer.add_blank_page(width=width, height=height)
            writer.add_page(page)
            
        # If at_page is at the end
        if at_page >= len(reader.pages) or at_page == -1:
            writer.add_blank_page(width=width, height=height)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def delete_page(self, doc_bytes: bytes, page_num: int) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                continue
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def rotate_page(self, doc_bytes: bytes, page_num: int, angle: int) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            if idx == page_num:
                # pypdf rotate takes degrees (clockwise): 90, 180, 270
                # We set absolute rotation
                page.rotate(angle)
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def duplicate_page(self, doc_bytes: bytes, page_num: int) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(reader.pages):
            writer.add_page(page)
            if idx == page_num:
                # Add duplicate
                writer.add_page(page)
                
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def reorder_pages(self, doc_bytes: bytes, new_order: List[int]) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx in new_order:
            if idx < 0 or idx >= len(reader.pages):
                raise IndexError(f"Page index {idx} in new order is out of range")
            page = reader.pages[idx]
            writer.add_page(page)
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def merge_document(self, target_bytes: bytes, source_bytes: bytes, at_page: int) -> bytes:
        target_reader = pypdf.PdfReader(io.BytesIO(target_bytes))
        source_reader = pypdf.PdfReader(io.BytesIO(source_bytes))
        writer = pypdf.PdfWriter()
        
        for idx, page in enumerate(target_reader.pages):
            if idx == at_page:
                # Insert all source pages
                for s_page in source_reader.pages:
                    writer.add_page(s_page)
            writer.add_page(page)
            
        if at_page >= len(target_reader.pages) or at_page == -1:
            for s_page in source_reader.pages:
                writer.add_page(s_page)
                
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()

    def extract_pages(self, doc_bytes: bytes, page_nums: List[int]) -> bytes:
        reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
        writer = pypdf.PdfWriter()
        
        for idx in page_nums:
            writer.add_page(reader.pages[idx])
            
        out_packet = io.BytesIO()
        writer.write(out_packet)
        return out_packet.getvalue()
