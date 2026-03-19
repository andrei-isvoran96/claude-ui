import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as path from 'path'
import * as os from 'os'
import { loadHistory, watchHistory } from './history'

const isDev = process.env.NODE_ENV !== 'production'

let mainWindow: BrowserWindow | null = null
const ptyMap = new Map<string, import('node-pty').IPty>()
let ptyCounter = 0

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    for (const p of ptyMap.values()) {
      try { p.kill() } catch {}
    }
    ptyMap.clear()
  })
}

// PTY handlers
ipcMain.handle('pty:create', async (_event, { cols, rows, cwd }: { cols: number; rows: number; cwd?: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require('node-pty')

  const ptyId = `pty-${++ptyCounter}`
  const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh')
  const workingDir = cwd && require('fs').existsSync(cwd) ? cwd : os.homedir()

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: workingDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  })

  ptyMap.set(ptyId, ptyProcess)

  ptyProcess.onData((data: string) => {
    if (!ptyMap.has(ptyId)) return
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`pty:data:${ptyId}`, data)
    }
  })

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`pty:exit:${ptyId}`, { exitCode })
    }
    ptyMap.delete(ptyId)
  })

  return { ptyId, cwd: workingDir }
})

ipcMain.on('pty:write', (_event, { ptyId, data }: { ptyId: string; data: string }) => {
  ptyMap.get(ptyId)?.write(data)
})

ipcMain.on('pty:resize', (_event, { ptyId, cols, rows }: { ptyId: string; cols: number; rows: number }) => {
  ptyMap.get(ptyId)?.resize(cols, rows)
})

ipcMain.on('pty:kill', (_event, ptyId: string) => {
  const p = ptyMap.get(ptyId)
  if (p) {
    ptyMap.delete(ptyId)
    try { p.kill() } catch {}
  }
})

// History handlers
ipcMain.handle('history:load', async () => {
  return loadHistory()
})

// Watch for history changes and push updates
let stopWatching: (() => void) | null = null

app.whenReady().then(() => {
  createWindow()

  stopWatching = watchHistory(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('history:update', loadHistory())
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (stopWatching) stopWatching()
  if (process.platform !== 'darwin') app.quit()
})

// Open external links in browser
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
