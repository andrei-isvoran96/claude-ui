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
