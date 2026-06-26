/// <reference types="vite/client" />

interface Window {
  electron: {
    openFileDialog: () => Promise<string | null>;
    saveFileDialog: (defaultName?: string) => Promise<string | null>;
    selectImageDialog: () => Promise<string | null>;
    readImageFile: (filePath: string) => Promise<{ mime: string; base64: string } | null>;
    getAppVersion: () => Promise<string>;
  };
}
