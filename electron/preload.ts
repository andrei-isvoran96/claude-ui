import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pty: {
    create: (cols: number, rows: number, cwd?: string) =>
      ipcRenderer.invoke('pty:create', { cols, rows, cwd }),
    write: (data: string) => ipcRenderer.send('pty:write', data),
    resize: (cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { cols, rows }),
    onData: (cb: (data: string) => void) => {
      ipcRenderer.on('pty:data', (_event, data) => cb(data))
    },
    onExit: (cb: (info: { exitCode: number }) => void) => {
      ipcRenderer.on('pty:exit', (_event, info) => cb(info))
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('pty:data')
      ipcRenderer.removeAllListeners('pty:exit')
    },
  },
  history: {
    load: (): Promise<import('./types').Project[]> =>
      ipcRenderer.invoke('history:load'),
    onUpdate: (cb: (projects: import('./types').Project[]) => void) => {
      ipcRenderer.on('history:update', (_event, projects) => cb(projects))
    },
  },
})
