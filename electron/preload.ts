import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pty: {
    create: (cols: number, rows: number, cwd?: string): Promise<{ ptyId: string; cwd: string }> =>
      ipcRenderer.invoke('pty:create', { cols, rows, cwd }),
    write: (ptyId: string, data: string) => ipcRenderer.send('pty:write', { ptyId, data }),
    resize: (ptyId: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { ptyId, cols, rows }),
    onData: (ptyId: string, cb: (data: string) => void) => {
      ipcRenderer.on(`pty:data:${ptyId}`, (_event, data) => cb(data))
    },
    onExit: (ptyId: string, cb: (info: { exitCode: number }) => void) => {
      ipcRenderer.on(`pty:exit:${ptyId}`, (_event, info) => cb(info))
    },
    removeListeners: (ptyId: string) => {
      ipcRenderer.removeAllListeners(`pty:data:${ptyId}`)
      ipcRenderer.removeAllListeners(`pty:exit:${ptyId}`)
    },
    kill: (ptyId: string) => ipcRenderer.send('pty:kill', ptyId),
  },
  history: {
    load: (): Promise<import('./types').Project[]> =>
      ipcRenderer.invoke('history:load'),
    onUpdate: (cb: (projects: import('./types').Project[]) => void) => {
      ipcRenderer.on('history:update', (_event, projects) => cb(projects))
    },
  },
})
