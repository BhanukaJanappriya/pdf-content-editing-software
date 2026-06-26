import os
import io
import sys

# Add parent directory of 'app' to PYTHONPATH dynamically
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import base64
import shutil
import pypdf
import pypdfium2 as pdfium
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.pdf_engine import PDFEngine
from app.font_engine import FontEngine
from app.text_editor import TextEditor
from app.image_editor import ImageEditor
from app.page_manager import PageManager
from app.ocr_engine import OCREngine

app = FastAPI(title="Professional PDF Editor API")

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, "cache")
FONTS_DIR = os.path.join(CACHE_DIR, "fonts")
UPLOADS_DIR = os.path.join(CACHE_DIR, "uploads")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Mount static folder to serve fonts
app.mount("/static/fonts", StaticFiles(directory=FONTS_DIR), name="static_fonts")

# Initialize engines
pdf_engine = PDFEngine(cache_dir=CACHE_DIR)
font_engine = FontEngine(cache_dir=FONTS_DIR)
text_editor = TextEditor()
image_editor = ImageEditor(cache_dir=CACHE_DIR)
page_manager = PageManager()
ocr_engine = OCREngine()

# ----------------- History Manager -----------------
class HistoryManager:
    def __init__(self):
        self.undo_stack: Dict[str, List[bytes]] = {}
        self.redo_stack: Dict[str, List[bytes]] = {}

    def push_state(self, doc_id: str, doc_bytes: bytes):
        if doc_id not in self.undo_stack:
            self.undo_stack[doc_id] = []
        if len(self.undo_stack[doc_id]) >= 30:
            self.undo_stack[doc_id].pop(0)
        self.undo_stack[doc_id].append(doc_bytes)
        self.redo_stack[doc_id] = []

    def undo(self, doc_id: str, current_bytes: bytes) -> Optional[bytes]:
        if not self.undo_stack.get(doc_id):
            return None
        if doc_id not in self.redo_stack:
            self.redo_stack[doc_id] = []
        self.redo_stack[doc_id].append(current_bytes)
        return self.undo_stack[doc_id].pop()

    def redo(self, doc_id: str, current_bytes: bytes) -> Optional[bytes]:
        if not self.redo_stack.get(doc_id):
            return None
        self.undo_stack[doc_id].append(current_bytes)
        return self.redo_stack[doc_id].pop()

    def get_status(self, doc_id: str) -> Dict[str, bool]:
        return {
            "can_undo": len(self.undo_stack.get(doc_id, [])) > 0,
            "can_redo": len(self.redo_stack.get(doc_id, [])) > 0
        }

    def clear(self, doc_id: str):
        if doc_id in self.undo_stack:
            del self.undo_stack[doc_id]
        if doc_id in self.redo_stack:
            del self.redo_stack[doc_id]

history_manager = HistoryManager()

# ----------------- Schemas -----------------
class LoadDocRequest(BaseModel):
    file_path: str

class SaveDocRequest(BaseModel):
    output_path: str

class EditSpanRequest(BaseModel):
    page_num: int
    span_id: str
    new_text: str

class EditBlockRequest(BaseModel):
    page_num: int
    block_id: str
    new_text: str
    font_name: Optional[str] = None
    font_size: Optional[float] = None
    color_hex: Optional[str] = None
    align: int = 0

class AddTextRequest(BaseModel):
    page_num: int
    x: float
    y: float
    text: str
    font_name: str = "Helvetica"
    font_size: float = 10.0
    color_hex: str = "#000000"

class DeleteTextRequest(BaseModel):
    page_num: int
    bbox: List[float]

class DeleteImageRequest(BaseModel):
    page_num: int
    bbox: List[float]

class MoveImageRequest(BaseModel):
    page_num: int
    old_bbox: List[float]
    new_bbox: List[float]
    xref: int

class OCRPageRequest(BaseModel):
    page_num: int
    lang: str = "eng"

class OCRDocRequest(BaseModel):
    lang: str = "eng"

class PageActionRequest(BaseModel):
    action: str
    page_num: Optional[int] = None
    angle: Optional[int] = None
    new_order: Optional[List[int]] = None
    width: Optional[float] = 595.0
    height: Optional[float] = 842.0

# ----------------- Helper -----------------
def get_bytes_and_push_state(doc_id: str) -> bytes:
    doc_bytes = pdf_engine.get_document_bytes(doc_id)
    history_manager.push_state(doc_id, doc_bytes)
    return doc_bytes

# ----------------- Endpoints -----------------

@app.post("/document/load")
def load_document(req: LoadDocRequest):
    doc_id = os.path.basename(req.file_path)
    try:
        pdf_engine.close_document(doc_id)
        history_manager.clear(doc_id)
    except KeyError:
        pass
        
    try:
        doc_bytes = pdf_engine.load_document(doc_id, req.file_path)
        font_engine.extract_all_fonts(doc_bytes)
        info = pdf_engine.get_document_info(doc_id)
        return {
            "status": "success",
            "doc_id": doc_id,
            "page_count": info["page_count"],
            "metadata": info["metadata"],
            "is_encrypted": info["is_encrypted"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load document: {str(e)}")

@app.post("/document/upload")
async def upload_document(file: UploadFile = File(...)):
    temp_path = os.path.join(UPLOADS_DIR, file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    doc_id = file.filename
    try:
        doc_bytes = pdf_engine.load_document(doc_id, temp_path)
        font_engine.extract_all_fonts(doc_bytes)
        info = pdf_engine.get_document_info(doc_id)
        return {
            "status": "success",
            "doc_id": doc_id,
            "file_path": temp_path,
            "page_count": info["page_count"],
            "metadata": info["metadata"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")

@app.post("/document/{doc_id}/close")
def close_document(doc_id: str):
    try:
        pdf_engine.close_document(doc_id)
        history_manager.clear(doc_id)
        return {"status": "success", "message": f"Document {doc_id} closed."}
    except KeyError:
        raise HTTPException(status_code=404, detail="Document not found.")

@app.get("/document/{doc_id}/info")
def get_document_info(doc_id: str):
    try:
        return pdf_engine.get_document_info(doc_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Document not found.")

@app.get("/document/{doc_id}/file")
def get_document_file(doc_id: str):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        return Response(content=doc_bytes, media_type="application/pdf")
    except KeyError:
        raise HTTPException(status_code=404, detail="Document not found.")

@app.get("/document/{doc_id}/page/{page_num}/image")
def get_page_image(doc_id: str, page_num: int, dpi: int = 150):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        # Render using pypdfium2
        doc = pdfium.PdfDocument(doc_bytes)
        if page_num < 0 or page_num >= len(doc):
            raise IndexError("Page number out of range.")
        page = doc[page_num]
        
        scale = dpi / 72.0
        bitmap = page.render(scale=scale)
        pil_img = bitmap.to_pil()
        
        # Convert to PNG Base64
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        base64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
        
        page.close()
        doc.close()
        return {"image": f"data:image/png;base64,{base64_data}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/document/{doc_id}/page/{page_num}/layout")
def get_page_layout(doc_id: str, page_num: int):
    try:
        layout = pdf_engine.extract_page_layout(doc_id, page_num)
        return layout
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/document/{doc_id}/fonts/css")
def get_document_fonts_css(doc_id: str, server_url: str = "http://localhost:8000"):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        fonts = font_engine.extract_all_fonts(doc_bytes)
        
        css_content = ""
        for font_name in fonts:
            css_content += font_engine.get_font_css(font_name, server_url)
            
        return {"css": css_content, "fonts": fonts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- History Endpoints -----------------

@app.get("/document/{doc_id}/history/status")
def get_history_status(doc_id: str):
    return history_manager.get_status(doc_id)

@app.post("/document/{doc_id}/undo")
def undo_action(doc_id: str):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        past_bytes = history_manager.undo(doc_id, doc_bytes)
        if past_bytes:
            pdf_engine.active_docs[doc_id] = past_bytes
            return {"status": "success", "message": "Undo successful", "history": history_manager.get_status(doc_id)}
        else:
            return {"status": "error", "message": "Nothing to undo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/redo")
def redo_action(doc_id: str):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        future_bytes = history_manager.redo(doc_id, doc_bytes)
        if future_bytes:
            pdf_engine.active_docs[doc_id] = future_bytes
            return {"status": "success", "message": "Redo successful", "history": history_manager.get_status(doc_id)}
        else:
            return {"status": "error", "message": "Nothing to redo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Editing Endpoints -----------------

@app.post("/document/{doc_id}/edit/span")
def edit_span(doc_id: str, req: EditSpanRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        # Fetch current layout to read target span metrics
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        # Locate span details
        span_data = None
        for block in layout["blocks"]:
            if block["type"] == "text":
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        if span["id"] == req.span_id:
                            span_data = span
                            break
                    if span_data: break
            if span_data: break
            
        if not span_data:
            raise HTTPException(status_code=404, detail="Target text span not found.")

        pdf_engine.add_redacted_box(doc_id, req.page_num, span_data["bbox"])
        updated_bytes = text_editor.edit_span(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            span_id=req.span_id,
            new_text=req.new_text,
            page_width=layout["width"],
            page_height=layout["height"],
            span_layout_data=span_data
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "updated": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/edit/block")
def edit_block(doc_id: str, req: EditBlockRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        # Locate block details
        block_data = None
        for block in layout["blocks"]:
            if block["id"] == req.block_id:
                block_data = block
                break
                
        if not block_data:
            raise HTTPException(status_code=404, detail="Target text block not found.")

        pdf_engine.add_redacted_box(doc_id, req.page_num, block_data["bbox"])
        updated_bytes = text_editor.edit_block_paragraph(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            block_id=req.block_id,
            new_text=req.new_text,
            page_width=layout["width"],
            page_height=layout["height"],
            block_layout_data=block_data,
            font_name=req.font_name,
            font_size=req.font_size,
            color_hex=req.color_hex,
            align=req.align
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "updated": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/edit/add_text")
def add_text(doc_id: str, req: AddTextRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        updated_bytes = text_editor.add_new_text(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            x=req.x,
            y=req.y,
            text=req.text,
            page_width=layout["width"],
            page_height=layout["height"],
            font_name=req.font_name,
            font_size=req.font_size,
            color_hex=req.color_hex
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "inserted": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/edit/delete_text")
def delete_text(doc_id: str, req: DeleteTextRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        pdf_engine.add_redacted_box(doc_id, req.page_num, req.bbox)
        updated_bytes = image_editor.delete_image(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            bbox=req.bbox,
            page_width=layout["width"],
            page_height=layout["height"]
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "deleted": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Image Endpoints -----------------

@app.post("/document/{doc_id}/image/delete")
def delete_image(doc_id: str, req: DeleteImageRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        updated_bytes = image_editor.delete_image(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            bbox=req.bbox,
            page_width=layout["width"],
            page_height=layout["height"]
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "deleted": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/image/move")
def move_image(doc_id: str, req: MoveImageRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, req.page_num)
        
        updated_bytes = image_editor.move_resize_image(
            doc_bytes=doc_bytes,
            page_num=req.page_num,
            old_bbox=req.old_bbox,
            new_bbox=req.new_bbox,
            xref=req.xref,
            page_width=layout["width"],
            page_height=layout["height"]
        )
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "moved": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/image/replace")
async def replace_image(
    doc_id: str,
    page_num: int = Form(...),
    bbox_json: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        layout = pdf_engine.extract_page_layout(doc_id, page_num)
        bbox = [float(x) for x in bbox_json.split(",")]
        
        temp_img_path = os.path.join(UPLOADS_DIR, f"replace_{file.filename}")
        with open(temp_img_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        updated_bytes = image_editor.replace_image(
            doc_bytes=doc_bytes,
            page_num=page_num,
            bbox=bbox,
            new_image_path=temp_img_path,
            page_width=layout["width"],
            page_height=layout["height"]
        )
        
        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)
            
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "replaced": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Page Management -----------------

@app.post("/document/{doc_id}/pages/manage")
def manage_pages(doc_id: str, req: PageActionRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        
        if req.action == "insert":
            if req.page_num is None:
                # Get current page count
                reader = pypdf.PdfReader(io.BytesIO(doc_bytes))
                req.page_num = len(reader.pages)
            updated_bytes = page_manager.insert_blank_page(doc_bytes, req.page_num, req.width, req.height)
            
        elif req.action == "delete":
            if req.page_num is None:
                raise HTTPException(status_code=400, detail="page_num is required for delete")
            updated_bytes = page_manager.delete_page(doc_bytes, req.page_num)
            
        elif req.action == "rotate":
            if req.page_num is None or req.angle is None:
                raise HTTPException(status_code=400, detail="page_num and angle are required for rotate")
            updated_bytes = page_manager.rotate_page(doc_bytes, req.page_num, req.angle)
            
        elif req.action == "duplicate":
            if req.page_num is None:
                raise HTTPException(status_code=400, detail="page_num is required for duplicate")
            updated_bytes = page_manager.duplicate_page(doc_bytes, req.page_num)
            
        elif req.action == "reorder":
            if not req.new_order:
                raise HTTPException(status_code=400, detail="new_order is required for reorder")
            updated_bytes = page_manager.reorder_pages(doc_bytes, req.new_order)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

        pdf_engine.active_docs[doc_id] = updated_bytes
        info = pdf_engine.get_document_info(doc_id)
        return {"status": "success", "page_count": info["page_count"], "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- OCR Endpoints -----------------

@app.post("/document/{doc_id}/ocr/check")
def check_ocr_available():
    return {"available": ocr_engine.is_tesseract_available()}

@app.post("/document/{doc_id}/ocr/page")
def ocr_page(doc_id: str, req: OCRPageRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        updated_bytes = ocr_engine.ocr_page(doc_bytes, req.page_num, req.lang)
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "processed": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/document/{doc_id}/ocr/doc")
def ocr_document(doc_id: str, req: OCRDocRequest):
    try:
        doc_bytes = get_bytes_and_push_state(doc_id)
        updated_bytes = ocr_engine.ocr_document(doc_bytes, req.lang)
        pdf_engine.active_docs[doc_id] = updated_bytes
        return {"status": "success", "processed": True, "history": history_manager.get_status(doc_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Save / Export -----------------

@app.post("/document/{doc_id}/save")
def save_document(doc_id: str, req: SaveDocRequest):
    try:
        doc_bytes = pdf_engine.get_document_bytes(doc_id)
        dir_name = os.path.dirname(req.output_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
            
        with open(req.output_path, "wb") as f:
            f.write(doc_bytes)
            
        return {"status": "success", "saved_path": req.output_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
