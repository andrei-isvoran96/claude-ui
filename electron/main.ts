import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as path from 'path'
import * as os from 'os'
import { loadHistory, watchHistory } from './history'

const isDev = process.env.NODE_ENV !== 'production'

let mainWindow: BrowserWindow | null = null
let ptyProcess: import('node-pty').IPty | null = null
// Monotonic counter — each pty:create increments this. Callbacks from old PTY
// processes capture their own generation and discard events if it no longer matches.
let ptyGeneration = 0

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
    if (ptyProcess) {
      ptyProcess.kill()
      ptyProcess = null
    }
  })
}

// PTY handlers
ipcMain.handle('pty:create', async (_event, { cols, rows, cwd }: { cols: number; rows: number; cwd?: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require('node-pty')

  // Increment generation BEFORE killing old PTY so its callbacks immediately
  // see a stale generation and discard any final data/exit events.
  const myGeneration = ++ptyGeneration

  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }

  const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh')
  const workingDir = cwd && require('fs').existsSync(cwd) ? cwd : os.homedir()

  ptyProcess = pty.spawn(shell, [], {
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

  ptyProcess!.onData((data: string) => {
    if (ptyGeneration !== myGeneration) return  // stale PTY, discard
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:data', data)
    }
  })

  ptyProcess!.onExit(({ exitCode }: { exitCode: number }) => {
    if (ptyGeneration !== myGeneration) return  // stale PTY, discard
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty:exit', { exitCode })
    }
    ptyProcess = null
  })

  return { success: true, cwd: workingDir }
})

ipcMain.on('pty:write', (_event, data: string) => {
  if (ptyProcess) {
    ptyProcess.write(data)
  }
})

ipcMain.on('pty:resize', (_event, { cols, rows }: { cols: number; rows: number }) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows)
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
