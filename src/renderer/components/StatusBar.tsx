import React, { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface StatusBarProps {
  filePath: string;
  statusText: string;
  isApiConnected: boolean;
  currentPage: number;
  pageCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  statusText,
  isApiConnected,
  currentPage,
  pageCount
}) => {
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    if (window.electron && window.electron.getAppVersion) {
      window.electron.getAppVersion().then(v => setAppVersion(v)).catch(() => {});
    }
  }, []);

  return (
    <footer className="glass-panel w-full h-8 px-4 border-t flex items-center justify-between text-xs text-brand-650 dark:text-brand-400 select-none z-30">
      {/* File Path & Page Indicator */}
      <div className="flex items-center space-x-3.5 truncate max-w-lg">
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isApiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-semibold">{isApiConnected ? 'Connected' : 'Offline'}</span>
        </div>
        {filePath && (
          <span className="truncate opacity-80" title={filePath}>
            {filePath}
          </span>
        )}
        {pageCount > 0 && (
          <span className="font-semibold bg-brand-100 dark:bg-brand-800 px-2 py-0.5 rounded text-brand-800 dark:text-brand-300">
            Page {currentPage + 1} of {pageCount}
          </span>
        )}
      </div>

      {/* Center Status Msg */}
      <div className="font-semibold text-brand-800 dark:text-brand-200">
        {statusText}
      </div>

      {/* Right Side Info */}
      <div className="flex items-center space-x-4">
        {/* Short key guidelines */}
        <div className="flex items-center space-x-1 opacity-70 cursor-help" title="Double click text to edit. Drag images to move.">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Editor Tips</span>
        </div>
        <div className="h-4 w-px bg-brand-200 dark:bg-brand-800" />
        <span className="font-mono">v{appVersion}</span>
      </div>
    </footer>
  );
};
