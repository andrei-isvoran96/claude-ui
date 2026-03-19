export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Session {
  id: string
  title: string
  timestamp: string
  cwd: string
  gitBranch?: string
  messages: ChatMessage[]
}

export interface Project {
  path: string
  name: string
  sessions: Session[]
}

export interface ElectronAPI {
  pty: {
    create: (cols: number, rows: number, cwd?: string) => Promise<{ ptyId: string; cwd: string }>
    write: (ptyId: string, data: string) => void
    resize: (ptyId: string, cols: number, rows: number) => void
    onData: (ptyId: string, cb: (data: string) => void) => void
    onExit: (ptyId: string, cb: (info: { exitCode: number }) => void) => void
    removeListeners: (ptyId: string) => void
    kill: (ptyId: string) => void
  }
  history: {
    load: () => Promise<Project[]>
    onUpdate: (cb: (projects: Project[]) => void) => void
  }
}
