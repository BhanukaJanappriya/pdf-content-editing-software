import React from 'react';
import { 
  FolderOpen, Save, Undo2, Redo2, MousePointer, Type, PlusSquare, Eraser, 
  Image as ImageIcon, Highlighter, Underline, Strikethrough, Layers, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, Cpu, Moon, Sun, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { EditTool } from '../../types';

interface ToolbarProps {
  currentTool: EditTool;
  setTool: (tool: EditTool) => void;
  pageNum: number;
  pageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageChange: (num: number) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: (fitMode: 'width' | 'page' | number) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onTriggerOCR: () => void;
  ocrAvailable: boolean;
  hasDocument: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  pageNum,
  pageCount,
  onPrevPage,
  onNextPage,
  onPageChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  darkMode,
  setDarkMode,
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onTriggerOCR,
  ocrAvailable,
  hasDocument
}) => {

  const tools: { id: EditTool; icon: React.ReactNode; label: string; description: string }[] = [
    { id: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select', description: 'Select & view objects' },
    { id: 'edit_text', icon: <Type className="w-4 h-4" />, label: 'Edit Text', description: 'Edit existing layout-preserved text' },
    { id: 'add_text', icon: <PlusSquare className="w-4 h-4" />, label: 'Add Text', description: 'Click anywhere to insert new text' },
    { id: 'erase_text', icon: <Eraser className="w-4 h-4" />, label: 'Erase', description: 'Cleanly delete text streams' },
    { id: 'image_edit', icon: <ImageIcon className="w-4 h-4" />, label: 'Image', description: 'Resize, move or replace images' },
    { id: 'annotate_highlight', icon: <Highlighter className="w-4 h-4 text-yellow-500" />, label: 'Highlight', description: 'Markup page sections' },
    { id: 'annotate_underline', icon: <Underline className="w-4 h-4 text-blue-500" />, label: 'Underline', description: 'Underline text lines' },
    { id: 'annotate_strikeout', icon: <Strikethrough className="w-4 h-4 text-red-500" />, label: 'Strikeout', description: 'Strikeout deleted words' },
    { id: 'page_manage', icon: <Layers className="w-4 h-4" />, label: 'Pages', description: 'Organize page order, insert or delete' },
  ];

  return (
    <header className="glass-panel sticky top-0 z-40 flex items-center justify-between w-full px-4 py-2 border-b select-none">
      {/* File Controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenFile}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-100 transition-colors"
          title="Open PDF File"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open</span>
        </button>
        <button
          onClick={onSaveFile}
          disabled={!hasDocument}
          className="p-2 rounded-lg hover:bg-brand-100 text-brand-700 dark:text-brand-200 dark:hover:bg-brand-800 disabled:opacity-40 transition-colors"
          title="Save (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={onSaveFileAs}
          disabled={!hasDocument}
          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-brand-100 text-brand-700 dark:text-brand-200 dark:hover:bg-brand-800 disabled:opacity-40 transition-colors"
          title="Save As"
        >
          <span>Save As</span>
        </button>
        
        <div className="h-6 w-px bg-brand-200 dark:bg-brand-800" />
        
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-lg hover:bg-brand-100 text-brand-700 dark:text-brand-200 dark:hover:bg-brand-800 disabled:opacity-40 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-lg hover:bg-brand-100 text-brand-700 dark:text-brand-200 dark:hover:bg-brand-800 disabled:opacity-40 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Editing Toolbar Tools */}
      <div className="flex items-center bg-brand-100/55 dark:bg-brand-900/60 p-1 rounded-xl border border-brand-200/20">
        {tools.map((t) => {
          const active = currentTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => hasDocument && setTool(t.id)}
              disabled={!hasDocument}
              className={`p-2 rounded-lg relative group transition-all duration-150 ${
                active 
                  ? 'bg-brand-500 text-white shadow-sm dark:bg-brand-600' 
                  : 'hover:bg-brand-200/50 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800/50'
              } disabled:opacity-30`}
              title={`${t.label}: ${t.description}`}
            >
              {t.icon}
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black/85 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* View & Navigation Controls */}
      <div className="flex items-center space-x-3">
        {/* Navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onPrevPage}
            disabled={!hasDocument || pageNum <= 0}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center space-x-1 text-sm font-medium text-brand-700 dark:text-brand-300">
            <input
              type="text"
              value={hasDocument ? pageNum + 1 : ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= pageCount) {
                  onPageChange(val - 1);
                }
              }}
              disabled={!hasDocument}
              className="w-10 px-1 py-0.5 text-center bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded text-brand-900 dark:text-brand-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span>/ {hasDocument ? pageCount : 0}</span>
          </div>
          <button
            onClick={onNextPage}
            disabled={!hasDocument || pageNum >= pageCount - 1}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="h-6 w-px bg-brand-200 dark:bg-brand-800" />

        {/* Zoom */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onZoomOut}
            disabled={!hasDocument}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 w-12 text-center">
            {hasDocument ? `${Math.round(zoom * 100)}%` : '100%'}
          </span>
          <button
            onClick={onZoomIn}
            disabled={!hasDocument}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => onZoomReset('width')}
            disabled={!hasDocument}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Fit to Width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomReset('page')}
            disabled={!hasDocument}
            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors"
            title="Fit to Page"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-6 w-px bg-brand-200 dark:bg-brand-800" />

        {/* Advanced & Mode controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onTriggerOCR}
            disabled={!hasDocument || !ocrAvailable}
            className={`p-2 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 disabled:opacity-30 transition-colors ${
              ocrAvailable ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
            title="Run OCR Document Analysis"
          >
            <Cpu className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-brand-100 text-brand-600 dark:text-brand-400 dark:hover:bg-brand-800 transition-colors"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-4.5 h-4.5 text-yellow-400" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
