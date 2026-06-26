import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { promises as fsPromises } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let pyBackendProcess: ChildProcess | null = null

// Determine if we are running in development mode
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined

function startPythonBackend() {
  console.log("Starting Python FastAPI backend...")
  
  // Resolve path to the backend startup script
  // During dev: root/backend/app/main.py
  // In production, we'd package it, but we support dev execution path here
  const backendPath = path.join(app.getAppPath(), 'backend', 'app', 'main.py')
  
  // Spawn python backend process
  pyBackendProcess = spawn('python', [backendPath], {
    cwd: path.join(app.getAppPath(), 'backend'),
    env: { ...process.env, PYTHONPATH: path.join(app.getAppPath(), 'backend') }
  })

  pyBackendProcess.stdout?.on('data', (data) => {
    console.log(`[Python Backend]: ${data.toString().trim()}`)
  })

  pyBackendProcess.stderr?.on('data', (data) => {
    console.log(`[Python Backend Error]: ${data.toString().trim()}`)
  })

  pyBackendProcess.on('error', (err) => {
    console.error(`Failed to start Python backend: ${err.message}`)
  })

  pyBackendProcess.on('close', (code) => {
    console.log(`Python backend exited with code ${code}`)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "AcrobatEdit - Premium Layout-Preserving PDF Editor",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Modern titlebar appearance
    titleBarStyle: 'default',
    show: false, // Show once ready to avoid visual flicker
  })

  // Set window menu to null or build a custom lightweight one
  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
    // Open devtools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Ensure the Python process is killed when the app shuts down
function killPythonBackend() {
  if (pyBackendProcess) {
    console.log("Killing Python FastAPI backend...")
    pyBackendProcess.kill('SIGINT') // Send interrupt signal
    pyBackendProcess = null
  }
}

app.whenReady().then(() => {
  // Start Python FastAPI server first
  startPythonBackend()
  
  // Give the python server a brief moment to spin up before loading the UI
  setTimeout(() => {
    createWindow()
  }, 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS (standard behavior)
app.on('window-all-closed', () => {
  killPythonBackend()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  killPythonBackend()
})

// ----------------- IPC Handlers -----------------

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open PDF Document",
    properties: ['openFile'],
    filters: [
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }
    ]
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_, defaultName?: string) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save PDF Document",
    defaultPath: defaultName || "Untitled_Edited.pdf",
    filters: [
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }
    ]
  })
  
  if (result.canceled) {
    return null
  }
  return result.filePath
})

ipcMain.handle('dialog:selectImage', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Insert / Replace Image",
    properties: ['openFile'],
    filters: [
      { name: 'Images (*.png; *.jpg; *.jpeg; *.webp; *.bmp)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
    ]
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('fs:readImage', async (_, filePath: string) => {
  try {
    const data = await fsPromises.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return {
      mime,
      base64: data.toString('base64')
    }
  } catch (err) {
    console.error("IPC fs:readImage error", err)
    return null
  }
})

ipcMain.handle('app:version', () => {
  return app.getVersion()
})
