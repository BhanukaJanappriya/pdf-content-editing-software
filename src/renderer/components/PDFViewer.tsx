import { useState, useRef, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import type { EditTool, PDFPageLayout, PDFBlock, PDFSpan, PDFImageInfo } from '../../types';
import { api } from '../../api';

interface PDFViewerProps {
  docId: string;
  pageNum: number;
  zoom: number;
  currentTool: EditTool;
  layout: PDFPageLayout | null;
  pageImage: string | null;
  selectedSpan: PDFSpan | null;
  setSelectedSpan: (span: PDFSpan | null) => void;
  selectedBlock: PDFBlock | null;
  setSelectedBlock: (block: PDFBlock | null) => void;
  selectedImage: PDFImageInfo | null;
  setSelectedImage: (image: PDFImageInfo | null) => void;
  onRefreshLayout: () => void;
  onImageMoved: (image: PDFImageInfo, oldBbox: number[], newBbox: number[]) => void;
  onAddText: (x: number, y: number, text: string) => void;
  onDeleteText: (bbox: number[]) => void;
  onOpenFile?: (path?: string) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  docId,
  pageNum,
  zoom,
  currentTool,
  layout,
  pageImage,
  selectedSpan,
  setSelectedSpan,
  selectedBlock: _selectedBlock,
  setSelectedBlock,
  selectedImage,
  setSelectedImage,
  onRefreshLayout,
  onImageMoved,
  onAddText,
  onDeleteText,
  onOpenFile
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Inline text editing states
  const [editingSpanId, setEditingSpanId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState('');
  
  // Floating new text state
  const [newTextPos, setNewTextPos] = useState<{ x: number; y: number } | null>(null);
  const [newTextVal, setNewTextVal] = useState('');
  const newTextInputRef = useRef<HTMLInputElement>(null);

  // Dragging images state
  const [draggingImgId, setDraggingImgId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgOffset, setImgOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingImgId, setResizingImgId] = useState<string | null>(null);
  const [resizeStartBbox, setResizeStartBbox] = useState<number[]>([]);

  // Focus add text input
  useEffect(() => {
    if (newTextPos && newTextInputRef.current) {
      newTextInputRef.current.focus();
    }
  }, [newTextPos]);

  if (!pageImage || !layout) {
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onOpenFile) {
        const file = e.dataTransfer.files[0];
        // Electron injects absolute filesystem path directly in the path property of HTML5 File objects
        const absPath = (file as any).path || file.name;
        if (absPath.toLowerCase().endsWith('.pdf')) {
          onOpenFile(absPath);
        }
      }
    };

    const handleBrowseClick = () => {
      if (onOpenFile) {
        onOpenFile();
      }
    };

    return (
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex items-center justify-center p-6 bg-brand-50/50 dark:bg-brand-950/20 transition-all duration-200"
      >
        <div 
          onClick={handleBrowseClick}
          className={`glass-panel border-2 border-dashed rounded-3xl p-10 max-w-md w-full text-center cursor-pointer transition-all duration-300 transform hover:scale-[1.01] hover:shadow-xl ${
            isDragging 
              ? 'border-brand-500 bg-brand-500/10 dark:bg-brand-500/5 shadow-2xl scale-[1.02]' 
              : 'border-brand-300 dark:border-brand-800 hover:border-brand-450 dark:hover:border-brand-700'
          }`}
        >
          <div className="flex justify-center mb-6">
            <div className={`p-4 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-500 dark:text-brand-400 transition-all duration-300 ${isDragging ? 'animate-bounce text-brand-650' : ''}`}>
              <UploadCloud className="w-12 h-12" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-brand-900 dark:text-white mb-2">
            Open PDF Document
          </h3>
          <p className="text-xs text-brand-500 dark:text-brand-400 leading-relaxed mb-6">
            Drag and drop your PDF document here, or click anywhere inside this box to browse files from your computer.
          </p>
          <button 
            onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all duration-200 transform hover:translate-y-[-1px] active:translate-y-0"
          >
            Select PDF File
          </button>
        </div>
      </div>
    );
  }

  const { width: pageWidth, height: pageHeight } = layout;

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentTool !== 'add_text') return;
    
    // Check if clicked directly on editable text (avoid overlap)
    if ((e.target as HTMLElement).classList.contains('text-span-editable')) {
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      setNewTextPos({ x, y });
      setNewTextVal('');
    }
  };

  const handleAddTextSubmit = () => {
    if (newTextPos && newTextVal.trim()) {
      onAddText(newTextPos.x, newTextPos.y, newTextVal);
    }
    setNewTextPos(null);
  };

  const handleSpanDoubleClick = (span: PDFSpan) => {
    if (currentTool !== 'edit_text') return;
    setSelectedSpan(span);
    setSelectedBlock(null);
    setSelectedImage(null);
    setEditingSpanId(span.id);
    setEditingTextVal(span.text);
  };

  const handleSpanEditBlur = async (span: PDFSpan) => {
    setEditingSpanId(null);
    if (editingTextVal !== span.text) {
      try {
        await api.editSpan(docId, pageNum, span.id, editingTextVal);
        onRefreshLayout();
      } catch (err) {
        console.error("Failed to edit span", err);
      }
    }
  };

  const handleSpanClick = (e: React.MouseEvent, span: PDFSpan, block: PDFBlock) => {
    e.stopPropagation();
    
    if (currentTool === 'erase_text') {
      onDeleteText(span.bbox);
      return;
    }

    if (currentTool === 'annotate_highlight' || currentTool === 'annotate_underline' || currentTool === 'annotate_strikeout') {
      // In a real app we'd draw standard highlight vector shapes or write to PDF
      // For this implementation, we highlight it on frontend and save.
      console.log(`Add annotation ${currentTool} to span`, span);
      return;
    }

    setSelectedSpan(span);
    setSelectedBlock(block);
    setSelectedImage(null);
  };

  // Image dragging handlers
  const handleImageMouseDown = (e: React.MouseEvent, img: PDFImageInfo) => {
    e.stopPropagation();
    if (currentTool !== 'image_edit') return;

    setSelectedImage(img);
    setSelectedSpan(null);
    setSelectedBlock(null);
    
    setDraggingImgId(img.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setImgOffset({ x: 0, y: 0 });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, img: PDFImageInfo) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentTool !== 'image_edit') return;
    
    setSelectedImage(img);
    setResizingImgId(img.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartBbox([...img.bbox]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingImgId && selectedImage) {
      const dx = (e.clientX - dragStartPos.x) / zoom;
      const dy = (e.clientY - dragStartPos.y) / zoom;
      setImgOffset({ x: dx, y: dy });
    } else if (resizingImgId && selectedImage) {
      const dx = (e.clientX - dragStartPos.x) / zoom;
      const dy = (e.clientY - dragStartPos.y) / zoom;
      
      // Update width and height on bbox: [x0, y0, x1, y1]
      // Corner resizing (bottom right)
      const newBbox = [
        resizeStartBbox[0],
        resizeStartBbox[1],
        resizeStartBbox[2] + dx,
        resizeStartBbox[3] + dy
      ];
      
      setSelectedImage({
        ...selectedImage,
        bbox: newBbox,
        width: Math.max(10, Math.round(newBbox[2] - newBbox[0])),
        height: Math.max(10, Math.round(newBbox[3] - newBbox[1]))
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingImgId && selectedImage) {
      const oldBbox = [...selectedImage.bbox];
      const newBbox = [
        oldBbox[0] + imgOffset.x,
        oldBbox[1] + imgOffset.y,
        oldBbox[2] + imgOffset.x,
        oldBbox[3] + imgOffset.y
      ];
      
      onImageMoved(selectedImage, oldBbox, newBbox);
      setDraggingImgId(null);
      setImgOffset({ x: 0, y: 0 });
    } else if (resizingImgId && selectedImage) {
      // Trigger update
      onImageMoved(selectedImage, resizeStartBbox, selectedImage.bbox);
      setResizingImgId(null);
    }
  };

  return (
    <div 
      className="flex-1 overflow-auto bg-brand-100/60 dark:bg-brand-950/20 p-8 flex justify-center items-start select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={containerRef}
        onClick={handlePageClick}
        className="relative bg-white dark:bg-brand-900 shadow-xl rounded-lg border border-brand-200/50 dark:border-brand-800 overflow-hidden transform origin-top pdf-page-container"
        style={{
          width: `${pageWidth * zoom}px`,
          height: `${pageHeight * zoom}px`,
        }}
      >
        {/* Background Rendered Image */}
        <img
          src={pageImage}
          alt={`PDF Page ${pageNum + 1}`}
          className="w-full h-full object-contain pointer-events-none select-none"
        />

        {/* INTERACTIVE EDITING LAYER */}
        <div className="absolute inset-0 z-10 overflow-hidden">
          {/* 1. TEXT SPANS OVERLAYS */}
          {layout.blocks.filter(b => b.type === 'text').map((block) => 
            block.lines?.map((line) => 
              line.spans.map((span) => {
                const isEditing = editingSpanId === span.id;
                const isSelected = selectedSpan?.id === span.id;
                const [x0, y0, x1, y1] = span.bbox;
                const width = x1 - x0;
                const height = y1 - y0;

                // Annotations styling
                let annotStyles = "";
                if (currentTool === 'annotate_highlight') {
                  annotStyles = "hover:bg-yellow-300/40";
                } else if (currentTool === 'annotate_underline') {
                  annotStyles = "hover:border-b-2 hover:border-blue-500";
                } else if (currentTool === 'annotate_strikeout') {
                  annotStyles = "hover:line-through hover:decoration-red-500 hover:decoration-2";
                }

                return (
                  <div
                    key={span.id}
                    onDoubleClick={() => handleSpanDoubleClick(span)}
                    onClick={(e) => handleSpanClick(e, span, block)}
                    className={`absolute text-span-editable leading-none whitespace-pre flex items-center ${
                      isSelected ? 'bg-blue-100/35 ring-1 ring-blue-400 dark:bg-blue-500/10' : ''
                    } ${annotStyles}`}
                    style={{
                      left: `${x0 * zoom}px`,
                      top: `${y0 * zoom}px`,
                      width: `${width * zoom}px`,
                      height: `${height * zoom}px`,
                      fontFamily: `"${span.font}", ${span.bold ? 'Arial-Bold, sans-serif' : 'Arial, sans-serif'}`,
                      fontSize: `${span.size * zoom}px`,
                      color: isEditing ? '#000000' : span.color,
                      fontWeight: span.bold ? 'bold' : 'normal',
                      fontStyle: span.italic ? 'italic' : 'normal',
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTextVal}
                        onChange={(e) => setEditingTextVal(e.target.value)}
                        onBlur={() => handleSpanEditBlur(span)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSpanEditBlur(span);
                          } else if (e.key === 'Escape') {
                            setEditingSpanId(null);
                          }
                        }}
                        className="w-full h-full bg-white dark:bg-brand-800 text-black dark:text-white border-0 outline-none focus:ring-1 focus:ring-blue-500 rounded px-0.5 select-text"
                        style={{ fontSize: `${span.size * zoom}px` }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      span.text
                    )}
                  </div>
                );
              })
            )
          )}

          {/* 2. IMAGE BLOCKS OVERLAYS */}
          {layout.images.map((img) => {
            const [x0, y0, x1, y1] = img.bbox;
            const isSelected = selectedImage?.id === img.id;
            const isDragging = draggingImgId === img.id;
            
            // Calculate screen coordinates, considering drag offset if active
            const left = (isDragging ? x0 + imgOffset.x : x0) * zoom;
            const top = (isDragging ? y0 + imgOffset.y : y0) * zoom;
            const width = (x1 - x0) * zoom;
            const height = (y1 - y0) * zoom;

            return (
              <div
                key={img.id}
                onMouseDown={(e) => handleImageMouseDown(e, img)}
                className={`absolute group cursor-move transition-all duration-100 ${
                  currentTool === 'image_edit' 
                    ? 'border-2 border-dashed border-brand-400 hover:border-brand-500' 
                    : 'pointer-events-none'
                } ${
                  isSelected ? 'border-2 border-solid !border-blue-500 shadow-md ring-2 ring-blue-500/20' : ''
                }`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                {/* Image overlay metadata */}
                {currentTool === 'image_edit' && (
                  <div className="absolute top-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none">
                    IMG ({img.width}x{img.height})
                  </div>
                )}

                {/* Resize Handle (Bottom-Right Corner) */}
                {currentTool === 'image_edit' && isSelected && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, img)}
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-500 border border-white rounded-full cursor-se-resize shadow-sm hover:scale-125 transform translate-x-1 translate-y-1 transition-transform z-30"
                  />
                )}
              </div>
            );
          })}

          {/* 3. FLOATING INSERT TEXT DIALOG */}
          {newTextPos && (
            <div
              className="absolute bg-white dark:bg-brand-900 border border-brand-300 dark:border-brand-700 shadow-xl p-2 rounded-lg z-30 flex items-center space-x-2 animate-fade-in"
              style={{
                left: `${newTextPos.x * zoom}px`,
                top: `${newTextPos.y * zoom}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={newTextInputRef}
                type="text"
                value={newTextVal}
                placeholder="Type here..."
                onChange={(e) => setNewTextVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTextSubmit();
                  else if (e.key === 'Escape') setNewTextPos(null);
                }}
                className="px-2 py-1 border border-brand-200 dark:border-brand-700 dark:bg-brand-800 dark:text-white text-xs rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
              />
              <button
                onClick={handleAddTextSubmit}
                className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-2 py-1 rounded-md transition-colors"
              >
                Insert
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
