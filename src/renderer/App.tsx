import { useState, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import type { SearchOptions } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { PDFViewer } from './components/PDFViewer';
import { StatusBar } from './components/StatusBar';
import { api } from '../api';
import type { PDFPageLayout, PDFBlock, PDFSpan, PDFImageInfo, PDFMetadata, EditTool } from '../types';

export default function App() {
  const [filePath, setFilePath] = useState('');
  const [docId, setDocId] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  const [currentTool, setTool] = useState<EditTool>('select');
  
  // Doc layout and image
  const [layout, setLayout] = useState<PDFPageLayout | null>(null);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<PDFMetadata>({});
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  
  // Selection
  const [selectedSpan, setSelectedSpan] = useState<PDFSpan | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<PDFBlock | null>(null);
  const [selectedImage, setSelectedImage] = useState<PDFImageInfo | null>(null);
  
  // Undo/Redo tracking
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // OCR & Status
  const [ocrAvailable, setOcrAvailable] = useState(false);
  const [statusText, setStatusText] = useState('System ready');
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check API health
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/document/0/ocr/check', { method: 'POST' }).catch(() => null);
        if (res) {
          setIsApiConnected(true);
          const data = await res.json();
          setOcrAvailable(data.available);
        } else {
          setIsApiConnected(false);
        }
      } catch {
        setIsApiConnected(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 5000);
    return () => clearInterval(interval);
  }, []);

  // Theme support
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Load page whenever document or page index changes
  useEffect(() => {
    if (docId) {
      loadPageData(docId, currentPage);
    }
  }, [docId, currentPage]);

  // Handle Zoom shortcuts & keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docId, canUndo, canRedo, filePath]);

  const loadPageData = async (activeDocId: string, pageNum: number) => {
    setIsLoading(true);
    setStatusText(`Loading Page ${pageNum + 1}...`);
    try {
      // 1. Fetch Page image (150 DPI for standard display quality)
      const imageRes = await api.getPageImage(activeDocId, pageNum, 150);
      setPageImage(imageRes.image);

      // 2. Fetch page layout (bbox/fonts)
      const layoutRes = await api.getPageLayout(activeDocId, pageNum);
      setLayout(layoutRes);

      // Clear selections on page flip
      setSelectedSpan(null);
      setSelectedBlock(null);
      setSelectedImage(null);

      // Query history status
      const historyRes = await fetch(`http://127.0.0.1:8000/document/${encodeURIComponent(activeDocId)}/history/status`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setCanUndo(historyData.can_undo);
        setCanRedo(historyData.can_redo);
      }

      setStatusText(`Page ${pageNum + 1} loaded`);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to load page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setIsLoading(true);
    setStatusText('Uploading PDF Document to backend...');
    try {
      const loadRes = await api.uploadDocument(file);
      setFilePath(file.name);
      setDocId(loadRes.doc_id);
      setPageCount(loadRes.page_count);
      setMetadata(loadRes.metadata || {});
      setCurrentPage(0);

      // Fetch and inject custom CSS fonts
      const fontsRes = await api.getFontsCSS(loadRes.doc_id);
      let styleNode = document.getElementById('pdf-dynamic-fonts');
      if (!styleNode) {
        styleNode = document.createElement('style');
        styleNode.id = 'pdf-dynamic-fonts';
        document.head.appendChild(styleNode);
      }
      styleNode.innerHTML = fontsRes.css;
      setAvailableFonts(fontsRes.fonts);

      setStatusText(`Document loaded successfully: ${loadRes.doc_id}`);
    } catch (err) {
      console.error(err);
      setStatusText('Error loading PDF document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFile = async (specificPath?: string) => {
    if (!window.electron) {
      // Browser fallback: trigger hidden input element click
      const input = document.getElementById('pdf-file-input');
      if (input) {
        input.click();
      } else {
        setStatusText('Upload input helper not found.');
      }
      return;
    }
    try {
      let selectedPath = specificPath;
      if (!selectedPath) {
        setStatusText('Selecting PDF file...');
        selectedPath = await window.electron.openFileDialog() || undefined;
      }
      if (!selectedPath) {
        setStatusText('Open cancelled');
        return;
      }
      setIsLoading(true);
      setStatusText('Loading PDF Document...');
      
      const loadRes = await api.loadDocument(selectedPath);
      setFilePath(selectedPath);
      setDocId(loadRes.doc_id);
      setPageCount(loadRes.page_count);
      setMetadata(loadRes.metadata || {});
      setCurrentPage(0);

      // 1. Fetch and inject custom CSS fonts
      const fontsRes = await api.getFontsCSS(loadRes.doc_id);
      let styleNode = document.getElementById('pdf-dynamic-fonts');
      if (!styleNode) {
        styleNode = document.createElement('style');
        styleNode.id = 'pdf-dynamic-fonts';
        document.head.appendChild(styleNode);
      }
      styleNode.innerHTML = fontsRes.css;
      setAvailableFonts(fontsRes.fonts);

      setStatusText(`Document loaded successfully: ${loadRes.doc_id}`);
    } catch (err) {
      console.error(err);
      setStatusText('Error loading PDF document.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDocumentFromBrowser = async () => {
    if (!docId) return;
    setStatusText('Downloading PDF file...');
    try {
      const response = await fetch(`http://127.0.0.1:8000/document/${encodeURIComponent(docId)}/file`);
      if (!response.ok) throw new Error('Failed to retrieve file');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docId;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStatusText('Document downloaded successfully');
    } catch (err) {
      console.error(err);
      setStatusText('Download failed.');
    }
  };

  const handleSave = async () => {
    if (!docId || !filePath) return;
    if (!window.electron) {
      await downloadDocumentFromBrowser();
      return;
    }
    setStatusText('Saving changes to PDF...');
    setIsLoading(true);
    try {
      await api.saveDocument(docId, filePath);
      setStatusText('Document saved successfully!');
    } catch (err) {
      console.error(err);
      setStatusText('Failed to save document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAs = async () => {
    if (!docId || !filePath) return;
    if (!window.electron) {
      await downloadDocumentFromBrowser();
      return;
    }
    try {
      const savePath = await window.electron.saveFileDialog(docId);
      if (!savePath) return;
      
      setStatusText('Saving PDF copy...');
      setIsLoading(true);
      await api.saveDocument(docId, savePath);
      setFilePath(savePath);
      setDocId(window.electron ? savePath.split(/[\\/]/).pop() || docId : docId);
      setStatusText(`Saved as copy: ${savePath}`);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to save copy.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!docId || !canUndo) return;
    setStatusText('Undoing last action...');
    try {
      const res = await api.undo(docId);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRedo = async () => {
    if (!docId || !canRedo) return;
    setStatusText('Redoing action...');
    try {
      const res = await api.redo(docId);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  // Text modification dispatchers
  const handleUpdateSpanText = async (spanId: string, newText: string) => {
    setStatusText('Updating text span...');
    try {
      const res = await api.editSpan(docId, currentPage, spanId, newText);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to update text');
    }
  };

  const handleUpdateBlockText = async (
    blockId: string,
    newText: string,
    fontName?: string,
    fontSize?: number,
    colorHex?: string,
    alignVal?: number
  ) => {
    setStatusText('Reflowing paragraph text...');
    try {
      const res = await api.editBlock(
        docId,
        currentPage,
        blockId,
        newText,
        fontName,
        fontSize,
        colorHex,
        alignVal
      );
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to reflow text.');
    }
  };

  const handleAddText = async (x: number, y: number, text: string) => {
    setStatusText('Inserting new text span...');
    try {
      // Inherit closest span properties if selected, or use default black Helvetica
      let font = 'Helvetica';
      let size = 11;
      let color = '#000000';
      if (layout && layout.blocks.length > 0) {
        // Find nearest span to inherit styling
        const firstText = layout.blocks.find(b => b.type === 'text');
        const firstSpan = firstText?.lines?.[0]?.spans?.[0];
        if (firstSpan) {
          font = firstSpan.font;
          size = firstSpan.size;
          color = firstSpan.color;
        }
      }
      
      const res = await api.addNewText(docId, currentPage, x, y, text, font, size, color);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteText = async (bbox: number[]) => {
    setStatusText('Redacting text...');
    try {
      const res = await api.deleteText(docId, currentPage, bbox);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  // Image actions
  const handleImageMoved = async (image: PDFImageInfo, oldBbox: number[], newBbox: number[]) => {
    setStatusText('Moving image...');
    try {
      const res = await api.moveImage(docId, currentPage, oldBbox, newBbox, image.xref);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSelectedImage = async () => {
    if (!selectedImage) return;
    setStatusText('Deleting image...');
    try {
      const res = await api.deleteImage(docId, currentPage, selectedImage.bbox);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      setSelectedImage(null);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplaceSelectedImage = async (file: File) => {
    if (!selectedImage) return;
    setStatusText('Uploading replacement image...');
    try {
      const res = await api.replaceImage(docId, currentPage, selectedImage.bbox, file);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to replace image');
    }
  };

  // Page management actions
  const handlePageAction = async (action: 'insert' | 'delete' | 'rotate' | 'duplicate', angle?: number) => {
    setStatusText(`${action} page index ${currentPage}...`);
    try {
      const params: any = { page_num: currentPage };
      if (action === 'rotate' && angle !== undefined) {
        // Calculate absolute angle based on original rotation + delta angle
        const origRot = layout?.rotation || 0;
        params.angle = (origRot + angle) % 360;
      }
      
      const res = await api.managePages(docId, action, params);
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      setPageCount(res.page_count);

      // Adjust page index if page is deleted
      if (action === 'delete') {
        const nextPg = Math.max(0, currentPage - 1);
        setCurrentPage(nextPg);
      } else {
        loadPageData(docId, currentPage);
      }
    } catch (err) {
      console.error(err);
      setStatusText('Failed to modify page tree.');
    }
  };

  // OCR
  const handleRunOCR = async (scope: 'page' | 'doc') => {
    setStatusText('Running Tesseract text recognition (OCR)...');
    setIsLoading(true);
    try {
      let res;
      if (scope === 'page') {
        res = await api.ocrPage(docId, currentPage);
      } else {
        res = await api.ocrDoc(docId);
      }
      setCanUndo(res.history.can_undo);
      setCanRedo(res.history.can_redo);
      loadPageData(docId, currentPage);
      setStatusText('OCR analysis complete. Text is now fully editable!');
    } catch (err) {
      console.error(err);
      setStatusText('OCR recognition failed. Ensure languages are installed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Search & Replace execution
  const handleSearchQuery = (query: string, options: SearchOptions) => {
    if (!layout || !query) return;
    setStatusText(`Searching for "${query}"...`);
    
    // Scan current page layout spans for matches
    let found = false;
    let flags = 'g';
    if (!options.matchCase) flags += 'i';

    const regex = options.useRegex 
      ? new RegExp(query, flags) 
      : new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), flags);

    for (const block of layout.blocks) {
      if (block.type !== 'text') continue;
      for (const line of block.lines || []) {
        for (const span of line.spans) {
          const isMatch = options.wholeWord 
            ? span.text.toLowerCase().trim() === query.toLowerCase().trim()
            : regex.test(span.text);

          if (isMatch) {
            setSelectedSpan(span);
            setSelectedBlock(block);
            found = true;
            setStatusText(`Found match in page text: "${span.text}"`);
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) {
      setStatusText(`No matches found for "${query}" on this page`);
    }
  };

  const handleReplaceText = async (search: string, replace: string, options: SearchOptions, replaceAll: boolean) => {
    setStatusText('Executing search and replace...');
    setIsLoading(true);
    try {
      if (replaceAll) {
        // Implement simple client-side loop or server action
        // For our API, we can iterate block texts on this page
        if (!layout) return;
        let replaceCount = 0;
        
        for (const block of layout.blocks) {
          if (block.type !== 'text' || !block.lines) continue;
          
          const fullText = block.lines
            .map(line => line.spans.map(s => s.text).join(''))
            .join('\n');
            
          let flags = 'g';
          if (!options.matchCase) flags += 'i';
          const regex = options.useRegex 
            ? new RegExp(search, flags) 
            : new RegExp(search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), flags);

          if (regex.test(fullText)) {
            const newText = fullText.replace(regex, replace);
            await api.editBlock(docId, currentPage, block.id, newText);
            replaceCount++;
          }
        }
        
        setStatusText(`Replaced ${replaceCount} paragraphs on this page.`);
      } else {
        // Single replacement on selected block
        if (selectedBlock) {
          const fullText = selectedBlock.lines!
            .map(line => line.spans.map(s => s.text).join(''))
            .join('\n');
          const newText = fullText.replace(search, replace);
          await api.editBlock(docId, currentPage, selectedBlock.id, newText);
          setStatusText('Replaced text match.');
        } else {
          setStatusText('No text block selected for single replacement');
        }
      }
      onRefreshLayout();
    } catch (err) {
      console.error(err);
      setStatusText('Replacement operation encountered errors.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefreshLayout = () => {
    loadPageData(docId, currentPage);
  };

  return (
    <div className={`flex flex-col h-screen w-full transition-colors duration-200 ${darkMode ? 'dark' : ''}`}>
      {/* 1. TOP TOOLBAR */}
      <Toolbar
        currentTool={currentTool}
        setTool={setTool}
        pageNum={currentPage}
        pageCount={pageCount}
        onPrevPage={() => currentPage > 0 && setCurrentPage(currentPage - 1)}
        onNextPage={() => currentPage < pageCount - 1 && setCurrentPage(currentPage + 1)}
        onPageChange={setCurrentPage}
        zoom={zoom}
        onZoomIn={() => setZoom(prev => Math.min(prev + 0.1, 4.0))}
        onZoomOut={() => setZoom(prev => Math.max(prev - 0.1, 0.4))}
        onZoomReset={(fit) => {
          if (fit === 'width') setZoom(1.3);
          else if (fit === 'page') setZoom(0.8);
        }}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenFile={handleOpenFile}
        onSaveFile={handleSave}
        onSaveFileAs={handleSaveAs}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onTriggerOCR={() => handleRunOCR('page')}
        ocrAvailable={ocrAvailable}
        hasDocument={docId !== ''}
      />

      {/* 2. BODY CONTAINER (SIDEBAR - VIEWER - PANEL) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          docId={docId}
          pageCount={pageCount}
          currentPage={currentPage}
          onPageSelect={setCurrentPage}
          metadata={metadata}
          onPageDelete={() => handlePageAction('delete')}
          onPageDuplicate={() => handlePageAction('duplicate')}
          onPageRotate={(_, ang) => handlePageAction('rotate', ang)}
          onSearchQuery={handleSearchQuery}
          onReplaceText={handleReplaceText}
        />

        {/* Main PDF Canvas Viewer */}
        <PDFViewer
          docId={docId}
          pageNum={currentPage}
          zoom={zoom}
          currentTool={currentTool}
          layout={layout}
          pageImage={pageImage}
          selectedSpan={selectedSpan}
          setSelectedSpan={setSelectedSpan}
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          onRefreshLayout={onRefreshLayout}
          onImageMoved={handleImageMoved}
          onAddText={handleAddText}
          onDeleteText={handleDeleteText}
          onOpenFile={handleOpenFile}
        />

        {/* Right Properties Panel */}
        <PropertiesPanel
          currentTool={currentTool}
          selectedSpan={selectedSpan}
          selectedBlock={selectedBlock}
          selectedImage={selectedImage}
          pageNum={currentPage}
          availableFonts={availableFonts}
          onUpdateSpanText={handleUpdateSpanText}
          onUpdateBlockText={handleUpdateBlockText}
          onDeleteSelectedText={() => selectedSpan && handleDeleteText(selectedSpan.bbox)}
          onDeleteSelectedImage={handleDeleteSelectedImage}
          onReplaceSelectedImage={handleReplaceSelectedImage}
          onPageAction={(act, ang) => handlePageAction(act, ang)}
          onRunOCR={handleRunOCR}
          ocrAvailable={ocrAvailable}
        />

        {/* Full screen loading backdrop overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-brand-950/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto">
            <div className="bg-white dark:bg-brand-900 border shadow-2xl rounded-2xl p-6 flex flex-col items-center space-y-4 max-w-sm">
              <span className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin dark:border-brand-800 dark:border-t-brand-450" />
              <div className="text-center">
                <h4 className="font-semibold text-brand-900 dark:text-brand-50 text-sm">Processing Document</h4>
                <p className="text-xs text-brand-500 mt-1">Please wait while we complete the operations...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. STATUS BAR */}
      <StatusBar
        filePath={filePath}
        statusText={statusText}
        isApiConnected={isApiConnected}
        currentPage={currentPage}
        pageCount={pageCount}
      />

      {/* Hidden browser PDF upload helper */}
      <input 
        type="file" 
        id="pdf-file-input" 
        accept=".pdf" 
        className="hidden" 
        style={{ display: 'none' }} 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file);
        }}
      />
    </div>
  );
}
