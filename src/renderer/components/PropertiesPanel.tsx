import { useState, useEffect } from 'react';
import { 
  Type, Image as ImageIcon, AlertCircle, RotateCcw, RotateCw, 
  Trash2, PlusCircle, Copy, Cpu, Check, AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react';
import type { EditTool, PDFBlock, PDFSpan, PDFImageInfo } from '../../types';

interface PropertiesPanelProps {
  currentTool: EditTool;
  selectedSpan: PDFSpan | null;
  selectedBlock: PDFBlock | null;
  selectedImage: PDFImageInfo | null;
  pageNum: number;
  availableFonts: string[];
  onUpdateSpanText: (spanId: string, newText: string) => void;
  onUpdateBlockText: (
    blockId: string, 
    newText: string, 
    fontName?: string, 
    fontSize?: number, 
    colorHex?: string, 
    align?: number
  ) => void;
  onDeleteSelectedText: () => void;
  onDeleteSelectedImage: () => void;
  onReplaceSelectedImage: (file: File) => void;
  onPageAction: (action: 'insert' | 'delete' | 'rotate' | 'duplicate', angle?: number) => void;
  onRunOCR: (scope: 'page' | 'doc') => void;
  ocrAvailable: boolean;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  currentTool: _currentTool,
  selectedSpan,
  selectedBlock,
  selectedImage,
  pageNum,
  availableFonts,
  onUpdateSpanText,
  onUpdateBlockText,
  onDeleteSelectedText,
  onDeleteSelectedImage,
  onReplaceSelectedImage,
  onPageAction,
  onRunOCR,
  ocrAvailable
}) => {
  // Local state for edits
  const [textVal, setTextVal] = useState('');
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [fontSize, setFontSize] = useState(12);
  const [colorHex, setColorHex] = useState('#000000');
  const [align, setAlign] = useState(0); // 0=left, 1=center, 2=right, 3=justify

  // Sync state when selection changes
  useEffect(() => {
    if (selectedSpan) {
      setTextVal(selectedSpan.text);
      setFontFamily(selectedSpan.font);
      setFontSize(Math.round(selectedSpan.size));
      setColorHex(selectedSpan.color);
    } else if (selectedBlock && selectedBlock.lines) {
      // Reassemble block text
      const fullText = selectedBlock.lines
        .map(line => line.spans.map(s => s.text).join(''))
        .join('\n');
      setTextVal(fullText);
      
      // Determine fonts from first span
      const firstSpan = selectedBlock.lines[0]?.spans[0];
      if (firstSpan) {
        setFontFamily(firstSpan.font);
        setFontSize(Math.round(firstSpan.size));
        setColorHex(firstSpan.color);
      }
    }
  }, [selectedSpan, selectedBlock]);

  const handleApplyTextEdits = () => {
    if (selectedSpan) {
      onUpdateSpanText(selectedSpan.id, textVal);
    } else if (selectedBlock) {
      onUpdateBlockText(selectedBlock.id, textVal, fontFamily, fontSize, colorHex, align);
    }
  };

  const handleImageReplaceClick = async () => {
    if (!selectedImage) return;
    try {
      if (!window.electron) {
        // Standard browser fallback
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            onReplaceSelectedImage(file);
          }
        };
        input.click();
        return;
      }
      
      const filePath = await window.electron.selectImageDialog();
      if (!filePath) return;
      
      // Load file bytes via Electron main process and convert to File object to upload
      const fileData = await window.electron.readImageFile(filePath);
      if (!fileData) return;
      
      const response = await fetch(`data:${fileData.mime};base64,${fileData.base64}`);
      const blob = await response.blob();
      const file = new File([blob], 'replacement_image', { type: fileData.mime });
      
      onReplaceSelectedImage(file);
    } catch (err) {
      console.error("Failed to select image", err);
    }
  };

  const cleanFontName = (name: string) => {
    return name.replace(/^[A-Z]{6}\+/, '');
  };

  return (
    <aside className="glass-panel w-72 flex flex-col h-full border-l overflow-y-auto p-4 select-none">
      {/* Title */}
      <h2 className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-4">
        Properties Panel
      </h2>

      {/* TEXT PROPERTIES */}
      {(selectedSpan || selectedBlock) && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2 text-brand-700 dark:text-brand-350 border-b border-brand-200/20 pb-2">
            <Type className="w-4 h-4" />
            <span className="text-sm font-semibold">Text Properties</span>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase">Text Content</label>
            {selectedSpan ? (
              <input
                type="text"
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            ) : (
              <textarea
                value={textVal}
                rows={4}
                onChange={(e) => setTextVal(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none resize-none"
              />
            )}
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase">Font Family</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              {availableFonts.map((font) => (
                <option key={font} value={font}>
                  {cleanFontName(font)}
                </option>
              ))}
              <option value="Helvetica">Helvetica (Standard)</option>
              <option value="Times-Roman">Times New Roman (Standard)</option>
              <option value="Courier">Courier (Standard)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-brand-500 uppercase">Font Size</label>
              <input
                type="number"
                value={fontSize}
                min={4}
                max={144}
                onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                className="w-full px-2.5 py-1.5 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-brand-500 uppercase">Color</label>
              <div className="flex items-center space-x-1">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-8 h-8 rounded-lg overflow-hidden cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-full px-1.5 py-1.5 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-xs font-semibold text-brand-900 dark:text-brand-50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {selectedBlock && (
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-bold text-brand-500 uppercase">Alignment</label>
              <div className="flex bg-brand-100/50 dark:bg-brand-900 p-0.5 rounded-lg border border-brand-200/20">
                <button
                  onClick={() => setAlign(0)}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors ${
                    align === 0 ? 'bg-white shadow dark:bg-brand-800 text-brand-900 dark:text-white' : 'text-brand-500 hover:text-brand-700'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setAlign(1)}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors ${
                    align === 1 ? 'bg-white shadow dark:bg-brand-800 text-brand-900 dark:text-white' : 'text-brand-500 hover:text-brand-700'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setAlign(2)}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors ${
                    align === 2 ? 'bg-white shadow dark:bg-brand-800 text-brand-900 dark:text-white' : 'text-brand-500 hover:text-brand-700'
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setAlign(3)}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-colors ${
                    align === 3 ? 'bg-white shadow dark:bg-brand-800 text-brand-900 dark:text-white' : 'text-brand-500 hover:text-brand-700'
                  }`}
                  title="Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleApplyTextEdits}
              className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Edits</span>
            </button>
            <button
              onClick={onDeleteSelectedText}
              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200/20"
              title="Delete Text Object"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* IMAGE PROPERTIES */}
      {selectedImage && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2 text-brand-700 dark:text-brand-350 border-b border-brand-200/20 pb-2">
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">Image Properties</span>
          </div>

          <div className="text-xs space-y-2 text-brand-700 dark:text-brand-300">
            <div className="flex justify-between">
              <span className="font-semibold">Format:</span>
              <span className="uppercase">{selectedImage.ext}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Width:</span>
              <span>{selectedImage.width} px</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Height:</span>
              <span>{selectedImage.height} px</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Object XREF:</span>
              <span className="font-mono">{selectedImage.xref}</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2 pt-2 border-t border-brand-200/20">
            <button
              onClick={handleImageReplaceClick}
              className="w-full py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-850 dark:hover:bg-brand-850 dark:text-brand-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Replace Image File
            </button>
            <button
              onClick={onDeleteSelectedImage}
              className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors border border-red-200/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Image</span>
            </button>
          </div>
        </div>
      )}

      {/* PAGE PROPERTIES (DEFAULT STATE) */}
      {!selectedSpan && !selectedBlock && !selectedImage && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2 text-brand-700 dark:text-brand-350 border-b border-brand-200/20 pb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Page {pageNum + 1} Actions</span>
          </div>

          {/* Quick Page Ops */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onPageAction('rotate', 270)} // Relative rotate left
              className="py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-colors"
              title="Rotate Counter-Clockwise"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate L</span>
            </button>
            <button
              onClick={() => onPageAction('rotate', 90)} // Relative rotate right
              className="py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-colors"
              title="Rotate Clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate R</span>
            </button>
          </div>

          <div className="flex flex-col space-y-2 pt-2 border-t border-brand-200/20">
            <button
              onClick={() => onPageAction('insert')}
              className="w-full py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Insert Blank Page</span>
            </button>
            <button
              onClick={() => onPageAction('duplicate')}
              className="w-full py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Page</span>
            </button>
            <button
              onClick={() => onPageAction('delete')}
              className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors border border-red-200/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Page</span>
            </button>
          </div>

          {/* OCR Panel */}
          <div className="flex flex-col space-y-2 pt-4 border-t border-brand-200/20">
            <h3 className="text-xs font-semibold text-brand-600 dark:text-brand-450 flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>Document Recognition (OCR)</span>
            </h3>
            <p className="text-[11px] text-brand-500 leading-relaxed">
              If this is a scanned document, you can perform OCR to convert scanned image text into editable text strings.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onRunOCR('page')}
                disabled={!ocrAvailable}
                className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors border border-emerald-200/20"
              >
                OCR Current Page
              </button>
              <button
                onClick={() => onRunOCR('doc')}
                disabled={!ocrAvailable}
                className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors border border-emerald-200/20"
              >
                OCR Full PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
