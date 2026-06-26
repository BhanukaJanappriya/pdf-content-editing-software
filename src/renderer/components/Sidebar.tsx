import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Info, Trash2, Copy, RotateCw, Replace as ReplaceIcon
} from 'lucide-react';
import type { PDFMetadata } from '../../types';
import { api } from '../../api';

interface SidebarProps {
  docId: string;
  pageCount: number;
  currentPage: number;
  onPageSelect: (pageIndex: number) => void;
  metadata: PDFMetadata;
  onPageDelete: (pageIndex: number) => void;
  onPageDuplicate: (pageIndex: number) => void;
  onPageRotate: (pageIndex: number, angle: number) => void;
  onSearchQuery: (query: string, options: SearchOptions) => void;
  onReplaceText: (search: string, replace: string, options: SearchOptions, replaceAll: boolean) => void;
}

export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  docId,
  pageCount,
  currentPage,
  onPageSelect,
  metadata,
  onPageDelete,
  onPageDuplicate,
  onPageRotate,
  onSearchQuery,
  onReplaceText
}) => {
  const [activeTab, setActiveTab] = useState<'thumbnails' | 'search' | 'info'>('thumbnails');
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  
  // Search inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  // Lazy render thumbnails for active tabs
  useEffect(() => {
    if (activeTab !== 'thumbnails' || !docId) return;

    const loadThumbnails = async () => {
      // Lazy load only a few thumbnails around the current page first
      const range = Array.from({ length: Math.min(pageCount, 12) }, (_, i) => i);
      
      for (const i of range) {
        if (thumbnailUrls[i]) continue;
        try {
          // Render thumbnails at low DPI (e.g., 40 DPI) for high performance
          const res = await api.getPageImage(docId, i, 40);
          setThumbnailUrls(prev => ({ ...prev, [i]: res.image }));
        } catch (e) {
          console.error(`Failed to load thumbnail for page ${i}`, e);
        }
      }
    };

    loadThumbnails();
  }, [activeTab, docId, pageCount]);

  // Load thumbnail when a page becomes active/visible
  useEffect(() => {
    if (activeTab !== 'thumbnails' || !docId) return;
    if (thumbnailUrls[currentPage]) return;
    
    const loadSingle = async () => {
      try {
        const res = await api.getPageImage(docId, currentPage, 40);
        setThumbnailUrls(prev => ({ ...prev, [currentPage]: res.image }));
      } catch (e) {
        console.error(e);
      }
    };
    loadSingle();
  }, [currentPage, activeTab, docId]);

  const handleSearch = () => {
    onSearchQuery(searchQuery, { matchCase, wholeWord, useRegex });
  };

  const handleReplace = (replaceAll: boolean) => {
    if (!searchQuery) return;
    onReplaceText(searchQuery, replaceQuery, { matchCase, wholeWord, useRegex }, replaceAll);
  };

  return (
    <aside className="glass-panel w-72 flex flex-col h-full border-r select-none">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-brand-200/20 bg-brand-100/30 dark:bg-brand-900/40 p-1.5 space-x-1">
        <button
          onClick={() => setActiveTab('thumbnails')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'thumbnails'
              ? 'bg-white text-brand-900 shadow-sm dark:bg-brand-800 dark:text-brand-50'
              : 'text-brand-600 hover:bg-brand-100/50 dark:text-brand-400 dark:hover:bg-brand-800/40'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Pages</span>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'search'
              ? 'bg-white text-brand-900 shadow-sm dark:bg-brand-800 dark:text-brand-50'
              : 'text-brand-600 hover:bg-brand-100/50 dark:text-brand-400 dark:hover:bg-brand-800/40'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'info'
              ? 'bg-white text-brand-900 shadow-sm dark:bg-brand-800 dark:text-brand-50'
              : 'text-brand-600 hover:bg-brand-100/50 dark:text-brand-400 dark:hover:bg-brand-800/40'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Info</span>
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* THUMBNAILS TAB */}
        {activeTab === 'thumbnails' && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: pageCount }).map((_, idx) => {
              const active = currentPage === idx;
              return (
                <div 
                  key={idx} 
                  className="flex flex-col items-center"
                >
                  <div
                    onClick={() => onPageSelect(idx)}
                    className={`relative w-full aspect-[1/1.4] bg-white dark:bg-brand-900 rounded-lg shadow-sm border overflow-hidden cursor-pointer group transition-all duration-200 ${
                      active 
                        ? 'ring-2 ring-brand-500 border-transparent shadow-md' 
                        : 'border-brand-200 hover:border-brand-400 dark:border-brand-850 dark:hover:border-brand-700'
                    }`}
                  >
                    {thumbnailUrls[idx] ? (
                      <img 
                        src={thumbnailUrls[idx]} 
                        alt={`Page ${idx + 1}`} 
                        className="w-full h-full object-contain p-1"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-brand-400">
                        Loading...
                      </div>
                    )}
                    
                    {/* Thumbnail quick actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-2 transition-opacity duration-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); onPageRotate(idx, 90); }}
                        className="p-1 bg-white hover:bg-brand-100 text-brand-800 rounded shadow"
                        title="Rotate Page 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPageDuplicate(idx); }}
                        className="p-1 bg-white hover:bg-brand-100 text-brand-800 rounded shadow"
                        title="Duplicate Page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPageDelete(idx); }}
                        disabled={pageCount <= 1}
                        className="p-1 bg-white hover:bg-red-50 text-red-600 rounded shadow disabled:opacity-40"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-xs font-semibold mt-1 text-brand-600 dark:text-brand-400">
                    Page {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase tracking-wider">Search Text</label>
              <input
                type="text"
                placeholder="Find text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-brand-500 uppercase tracking-wider">Replace With</label>
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-brand-200 dark:bg-brand-800 dark:border-brand-700 rounded-lg text-sm text-brand-900 dark:text-brand-50 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Options */}
            <div className="flex flex-col space-y-2 py-1">
              <label className="flex items-center space-x-2 text-xs font-medium text-brand-700 dark:text-brand-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={(e) => setMatchCase(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-0 focus:ring-offset-0 border-brand-300"
                />
                <span>Match Case</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-medium text-brand-700 dark:text-brand-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wholeWord}
                  onChange={(e) => setWholeWord(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-0 focus:ring-offset-0 border-brand-300"
                />
                <span>Whole Word</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-medium text-brand-700 dark:text-brand-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-0 focus:ring-offset-0 border-brand-300"
                />
                <span>Regular Expressions</span>
              </label>
            </div>

            <div className="flex flex-col space-y-2 pt-2 border-t border-brand-200/20">
              <button
                onClick={handleSearch}
                className="w-full py-2 bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Find Next</span>
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReplace(false)}
                  className="py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <ReplaceIcon className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
                <button
                  onClick={() => handleReplace(true)}
                  className="py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <ReplaceIcon className="w-3.5 h-3.5" />
                  <span>Replace All</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="flex flex-col space-y-3.5 text-xs">
            <div className="border-b border-brand-200/20 pb-2">
              <span className="font-semibold text-brand-500">Document ID</span>
              <p className="font-mono break-all mt-0.5 text-brand-800 dark:text-brand-200">{docId || 'None'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Title</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.title || 'Untitled'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Author</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.author || 'Unknown'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Subject</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.subject || 'None'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Keywords</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.keywords || 'None'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Creator</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.creator || 'None'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Producer</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.producer || 'None'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Created Date</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.creationDate || 'Unknown'}</p>
            </div>
            <div>
              <span className="font-semibold text-brand-500">Modified Date</span>
              <p className="mt-0.5 text-brand-800 dark:text-brand-200">{metadata.modDate || 'Unknown'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
