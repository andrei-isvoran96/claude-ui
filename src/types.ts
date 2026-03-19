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
    create: (cols: number, rows: number, cwd?: string) => Promise<{ success: boolean; cwd: string }>
    write: (data: string) => void
    resize: (cols: number, rows: number) => void
    onData: (cb: (data: string) => void) => void
    onExit: (cb: (info: { exitCode: number }) => void) => void
    removeListeners: () => void
  }
  history: {
    load: () => Promise<Project[]>
    onUpdate: (cb: (projects: Project[]) => void) => void
  }
}

