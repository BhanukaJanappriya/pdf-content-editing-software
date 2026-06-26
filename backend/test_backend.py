import os
from app.pdf_engine import PDFEngine
from app.font_engine import FontEngine
from app.text_editor import TextEditor
from app.page_manager import PageManager

def run_tests():
    print("=== STARTING PURE-PYTHON BACKEND INTEGRATION TESTS ===")
    
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_path = os.path.join(base_dir, "..", "sample.pdf")
    edited_path = os.path.join(base_dir, "..", "sample_test_edited.pdf")
    cache_dir = os.path.join(base_dir, "cache_test")
    
    os.makedirs(cache_dir, exist_ok=True)

    # 1. Initialize Engines
    print("1. Initializing pure-Python engines...")
    pdf_eng = PDFEngine(cache_dir=cache_dir)
    font_eng = FontEngine(cache_dir=cache_dir)
    text_edit = TextEditor()
    page_man = PageManager()

    doc_id = "test_doc.pdf"
    
    # 2. Load PDF
    print(f"2. Loading PDF: {sample_path}")
    doc_bytes = pdf_eng.load_document(doc_id, sample_path)
    print(f"   Page bytes loaded: {len(doc_bytes)}")
    info = pdf_eng.get_document_info(doc_id)
    print(f"   Page count: {info['page_count']}")
    assert info['page_count'] == 2, "Expected 2 pages in test PDF"
    
    # 3. Font Scanning
    print("3. Scanning PDF structure fonts...")
    fonts = font_eng.extract_all_fonts(doc_bytes)
    print(f"   Fonts detected: {fonts}")
    
    # 4. Extract Layout
    print("4. Extracting page 0 layout...")
    layout = pdf_eng.extract_page_layout(doc_id, 0)
    print(f"   Page dimensions: {layout['width']} x {layout['height']}")
    
    # Find a text span to edit (e.g. title: "AcrobatEdit Test Document")
    target_span = None
    target_block = None
    for block in layout["blocks"]:
        if block["type"] == "text":
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if "AcrobatEdit" in span["text"]:
                        target_span = span
                        target_block = block
                        break
                if target_span:
                    break
        if target_span:
            break
            
    assert target_span is not None, "Target test span not found in layout"
    print(f"   Target span found: '{target_span['text']}' with ID {target_span['id']}")

    # 5. Test Inline Span Edit
    print("5. Testing inline span editing via overlay page merging and stream clearing...")
    new_text = "ReactPDF Editor Test Document"
    updated_bytes = text_edit.edit_span(
        doc_bytes=doc_bytes,
        page_num=0,
        span_id=target_span["id"],
        new_text=new_text,
        page_width=layout["width"],
        page_height=layout["height"],
        span_layout_data=target_span
    )
    assert len(updated_bytes) > 0, "Span edit failed to output bytes"
    
    # Update active document state in engine
    pdf_eng.active_docs[doc_id] = updated_bytes
    
    # Verify span text change in-memory
    new_layout = pdf_eng.extract_page_layout(doc_id, 0)
    edited_span_text = ""
    for block in new_layout["blocks"]:
        if block["id"] == target_block["id"]:
            # Our span editor cleared "AcrobatEdit Test Document" structurally and drew "ReactPDF Editor Test Document"
            # It should extract the new text!
            edited_span_text = block["lines"][0]["spans"][0]["text"]
            break
            
    print(f"   Span text after edit: '{edited_span_text}'")
    assert edited_span_text == new_text, f"Span text mismatch: expected '{new_text}', got '{edited_span_text}'"

    # 6. Test Block Reflow Edit
    print("6. Testing paragraph block reflow editing...")
    paragraph_block_id = "p0_b2"
    reflowed_text = "This paragraph has been fully edited and reflowed by our custom text reflow algorithm. " \
                    "It wraps and adjusts line breaks automatically while preserving the original layout and font properties."
                    
    # Retrieve current block data
    block_data = None
    for block in new_layout["blocks"]:
        if block["id"] == paragraph_block_id:
            block_data = block
            break
            
    assert block_data is not None, "Paragraph block not found for reflow test"
    
    updated_bytes = text_edit.edit_block_paragraph(
        doc_bytes=updated_bytes,
        page_num=0,
        block_id=paragraph_block_id,
        new_text=reflowed_text,
        page_width=layout["width"],
        page_height=layout["height"],
        block_layout_data=block_data,
        align=3 # Justified
    )
    assert len(updated_bytes) > 0, "Block reflow failed to output bytes"
    pdf_eng.active_docs[doc_id] = updated_bytes

    # 7. Test Page Management (Duplication & Rotation)
    print("7. Testing page management...")
    updated_bytes = page_man.duplicate_page(updated_bytes, 0)
    pdf_eng.active_docs[doc_id] = updated_bytes
    
    info = pdf_eng.get_document_info(doc_id)
    assert info['page_count'] == 3, f"Expected 3 pages after duplication, got {info['page_count']}"
    print("   Page duplicated successfully.")

    updated_bytes = page_man.rotate_page(updated_bytes, 2, 90)
    pdf_eng.active_docs[doc_id] = updated_bytes
    print("   Page rotated 90 degrees successfully.")

    # 8. Save Document
    print(f"8. Saving edited document to: {edited_path}")
    if os.path.exists(edited_path):
        os.remove(edited_path)
    with open(edited_path, "wb") as f:
        f.write(updated_bytes)
    print("   Document saved successfully.")

    print("=== PURE-PYTHON BACKEND TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
