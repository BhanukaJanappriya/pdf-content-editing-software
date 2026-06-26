import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to the React frontend
contextBridge.exposeInMainWorld('electron', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultName?: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  selectImageDialog: () => ipcRenderer.invoke('dialog:selectImage'),
  readImageFile: (filePath: string) => ipcRenderer.invoke('fs:readImage', filePath),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
})
