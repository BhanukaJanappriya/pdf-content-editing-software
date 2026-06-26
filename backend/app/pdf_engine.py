import os
import io
import pypdf
import pdfplumber
from typing import Dict, Any, List, Optional

class PDFEngine:
    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self.active_docs: Dict[str, bytes] = {}
        self.doc_paths: Dict[str, str] = {}
        self.redacted_boxes: Dict[str, Dict[int, List[List[float]]]] = {}

    def load_document(self, doc_id: str, file_path: str) -> bytes:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found at {file_path}")
        
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
            
        self.active_docs[doc_id] = pdf_bytes
        self.doc_paths[doc_id] = file_path
        return pdf_bytes

    def close_document(self, doc_id: str):
        if doc_id in self.active_docs:
            del self.active_docs[doc_id]
        if doc_id in self.doc_paths:
            del self.doc_paths[doc_id]
        if doc_id in self.redacted_boxes:
            del self.redacted_boxes[doc_id]

    def add_redacted_box(self, doc_id: str, page_num: int, bbox: List[float]):
        if doc_id not in self.redacted_boxes:
            self.redacted_boxes[doc_id] = {}
        if page_num not in self.redacted_boxes[doc_id]:
            self.redacted_boxes[doc_id][page_num] = []
        self.redacted_boxes[doc_id][page_num].append(bbox)

    def get_document_bytes(self, doc_id: str) -> bytes:
        if doc_id not in self.active_docs:
            raise KeyError(f"Document with ID {doc_id} is not loaded.")
        return self.active_docs[doc_id]

    def extract_page_layout(self, doc_id: str, page_num: int) -> Dict[str, Any]:
        """
        Extracts layout using pdfplumber (pure-Python text analyzer).
        Groups words into lines and lines into spans.
        """
        pdf_bytes = self.get_document_bytes(doc_id)
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if page_num < 0 or page_num >= len(pdf.pages):
                raise IndexError("Page number out of range.")
                
            page = pdf.pages[page_num]
            width, height = float(page.width), float(page.height)

            words = page.extract_words(
                extra_attrs=["fontname", "size", "non_stroking_color"],
                x_tolerance=3,
                y_tolerance=3
            )

            # Filter words that overlap with redacted boxes
            redacted_list = self.redacted_boxes.get(doc_id, {}).get(page_num, [])
            if redacted_list:
                filtered_words = []
                for w in words:
                    is_redacted = False
                    for rx0, rtop, rx1, rbottom in redacted_list:
                        overlap_x = max(0.0, min(float(w["x1"]), float(rx1)) - max(float(w["x0"]), float(rx0)))
                        overlap_y = max(0.0, min(float(w["bottom"]), float(rbottom)) - max(float(w["top"]), float(rtop)))
                        w_w = float(w["x1"]) - float(w["x0"])
                        w_h = float(w["bottom"]) - float(w["top"])
                        if w_w > 0 and w_h > 0:
                            overlap_area = overlap_x * overlap_y
                            word_area = w_w * w_h
                            if (overlap_area / word_area) > 0.4:
                                is_redacted = True
                                break
                    if not is_redacted:
                        filtered_words.append(w)
                words = filtered_words

            # Group words into lines
            lines_map = {}
            for w in words:
                top_key = round(w["top"], 1)
                
                matched_key = None
                for k in lines_map.keys():
                    if abs(k - w["top"]) < 3.5:
                        matched_key = k
                        break
                        
                if matched_key is None:
                    matched_key = w["top"]
                    lines_map[matched_key] = []
                    
                lines_map[matched_key].append(w)

            # Sort lines from top to bottom
            sorted_line_keys = sorted(lines_map.keys())
            
            blocks = []
            block_idx = 0
            line_idx = 0
            
            current_block_lines = []
            prev_line_bottom = None

            for k in sorted_line_keys:
                line_words = sorted(lines_map[k], key=lambda x: x["x0"])
                if not line_words:
                    continue
                
                line_top = min(w["top"] for w in line_words)
                line_bottom = max(w["bottom"] for w in line_words)
                line_x0 = min(w["x0"] for w in line_words)
                line_x1 = max(w["x1"] for w in line_words)
                
                # Reconstruct spans
                spans = []
                span_idx = 0
                
                current_span_words = []
                prev_w = None
                
                for w in line_words:
                    is_new_span = False
                    
                    if prev_w is not None:
                        font_change = w.get("fontname") != prev_w.get("fontname")
                        size_change = abs(w.get("size", 0) - prev_w.get("size", 0)) > 0.5
                        color_change = w.get("non_stroking_color") != prev_w.get("non_stroking_color")
                        
                        spacing = w["x0"] - prev_w["x1"]
                        space_threshold = prev_w.get("size", 10) * 0.4
                        
                        if font_change or size_change or color_change or spacing > space_threshold:
                            is_new_span = True
                            
                    if is_new_span and current_span_words:
                        span_text = " ".join(sw["text"] for sw in current_span_words)
                        span_x0 = min(sw["x0"] for sw in current_span_words)
                        span_top = min(sw["top"] for sw in current_span_words)
                        span_x1 = max(sw["x1"] for sw in current_span_words)
                        span_bottom = max(sw["bottom"] for sw in current_span_words)
                        
                        color_tuple = current_span_words[0].get("non_stroking_color")
                        hex_color = self.parse_color_to_hex(color_tuple)
                        
                        spans.append({
                            "id": f"p{page_num}_b{block_idx}_l{line_idx}_s{span_idx}",
                            "text": span_text,
                            "bbox": [span_x0, span_top, span_x1, span_bottom],
                            "origin": [span_x0, span_bottom],
                            "font": current_span_words[0].get("fontname", "Helvetica"),
                            "size": current_span_words[0].get("size", 10),
                            "color": hex_color,
                            "flags": 0,
                            "bold": "bold" in current_span_words[0].get("fontname", "").lower(),
                            "italic": "italic" in current_span_words[0].get("fontname", "").lower() or "oblique" in current_span_words[0].get("fontname", "").lower(),
                        })
                        span_idx += 1
                        current_span_words = []
                        
                    current_span_words.append(w)
                    prev_w = w
                    
                if current_span_words:
                    span_text = " ".join(sw["text"] for sw in current_span_words)
                    span_x0 = min(sw["x0"] for sw in current_span_words)
                    span_top = min(sw["top"] for sw in current_span_words)
                    span_x1 = max(sw["x1"] for sw in current_span_words)
                    span_bottom = max(sw["bottom"] for sw in current_span_words)
                    color_tuple = current_span_words[0].get("non_stroking_color")
                    hex_color = self.parse_color_to_hex(color_tuple)
                    
                    spans.append({
                        "id": f"p{page_num}_b{block_idx}_l{line_idx}_s{span_idx}",
                        "text": span_text,
                        "bbox": [span_x0, span_top, span_x1, span_bottom],
                        "origin": [span_x0, span_bottom],
                        "font": current_span_words[0].get("fontname", "Helvetica"),
                        "size": current_span_words[0].get("size", 10),
                        "color": hex_color,
                        "flags": 0,
                        "bold": "bold" in current_span_words[0].get("fontname", "").lower(),
                        "italic": "italic" in current_span_words[0].get("fontname", "").lower() or "oblique" in current_span_words[0].get("fontname", "").lower(),
                    })

                line_data = {
                    "id": f"p{page_num}_b{block_idx}_l{line_idx}",
                    "bbox": [line_x0, line_top, line_x1, line_bottom],
                    "spans": spans
                }

                is_new_block = False
                if prev_line_bottom is not None:
                    line_gap = line_top - prev_line_bottom
                    line_height = line_bottom - line_top
                    if line_gap > line_height * 1.8:
                        is_new_block = True
                        
                if is_new_block and current_block_lines:
                    block_x0 = min(l["bbox"][0] for l in current_block_lines)
                    block_top = min(l["bbox"][1] for l in current_block_lines)
                    block_x1 = max(l["bbox"][2] for l in current_block_lines)
                    block_bottom = max(l["bbox"][3] for l in current_block_lines)
                    
                    blocks.append({
                        "id": f"p{page_num}_b{block_idx}",
                        "type": "text",
                        "bbox": [block_x0, block_top, block_x1, block_bottom],
                        "lines": current_block_lines
                    })
                    block_idx += 1
                    line_idx = 0
                    current_block_lines = []
                    
                line_data["id"] = f"p{page_num}_b{block_idx}_l{line_idx}"
                for s in line_data["spans"]:
                    s["id"] = s["id"].replace(f"b{block_idx}", f"b{block_idx}").replace(f"l{line_idx}", f"l{line_idx}")
                    
                current_block_lines.append(line_data)
                line_idx += 1
                prev_line_bottom = line_bottom

            if current_block_lines:
                block_x0 = min(l["bbox"][0] for l in current_block_lines)
                block_top = min(l["bbox"][1] for l in current_block_lines)
                block_x1 = max(l["bbox"][2] for l in current_block_lines)
                block_bottom = max(l["bbox"][3] for l in current_block_lines)
                
                blocks.append({
                    "id": f"p{page_num}_b{block_idx}",
                    "type": "text",
                    "bbox": [block_x0, block_top, block_x1, block_bottom],
                    "lines": current_block_lines
                })

            images = []
            for img_idx, img in enumerate(page.images):
                img_x0 = float(img.get("x0", 0))
                img_top = float(img.get("top", 0))
                img_x1 = float(img.get("x1", 0))
                img_bottom = float(img.get("bottom", 0))
                
                images.append({
                  "id": f"p{page_num}_img_{img_idx}",
                  "xref": img_idx,
                  "bbox": [img_x0, img_top, img_x1, img_bottom],
                  "width": round(img_x1 - img_x0),
                  "height": round(img_bottom - img_top),
                  "ext": "png"
                })

            return {
                "page_num": page_num,
                "width": width,
                "height": height,
                "rotation": int(page.rotation),
                "blocks": blocks,
                "images": images
            }

    def parse_color_to_hex(self, color_tuple) -> str:
        if not color_tuple:
            return "#000000"
            
        try:
            if isinstance(color_tuple, (list, tuple)):
                if len(color_tuple) == 3:
                    if all(isinstance(c, float) for c in color_tuple):
                        r = int(color_tuple[0] * 255)
                        g = int(color_tuple[1] * 255)
                        b = int(color_tuple[2] * 255)
                    else:
                        r, g, b = int(color_tuple[0]), int(color_tuple[1]), int(color_tuple[2])
                    return f"#{r:02x}{g:02x}{b:02x}"
                elif len(color_tuple) == 1:
                    c = int(color_tuple[0] * 255) if isinstance(color_tuple[0], float) else int(color_tuple[0])
                    return f"#{c:02x}{c:02x}{c:02x}"
            return "#000000"
        except Exception:
            return "#000000"

    def get_document_info(self, doc_id: str) -> Dict[str, Any]:
        pdf_bytes = self.get_document_bytes(doc_id)
        
        with pypdf.PdfReader(io.BytesIO(pdf_bytes)) as reader:
            metadata_dict = {}
            if reader.metadata:
                for k, v in reader.metadata.items():
                    key = k.lstrip('/')
                    metadata_dict[key] = str(v)
                    
            return {
                "page_count": len(reader.pages),
                "metadata": metadata_dict,
                "is_encrypted": reader.is_encrypted
            }
