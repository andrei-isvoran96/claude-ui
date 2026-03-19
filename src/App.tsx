import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TerminalPanel from './components/TerminalPanel'
import type { Session } from './types'
import './App.css'

interface TerminalState {
  key: string
  cwd?: string
  autoCommand?: string
  label?: string        // shown in the session bar
  labelSub?: string     // secondary info (cwd or branch)
}

export default function App() {
  const [terminal, setTerminal] = useState<TerminalState>({ key: 'default' })
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()

  const handleResumeSession = (session: Session) => {
    setActiveSessionId(session.id)
    setTerminal({
      key: `resume-${session.id}`,
      cwd: session.cwd,
      autoCommand: `claude --resume ${session.id}`,
      label: session.title,
      labelSub: session.gitBranch ?? session.cwd,
    })
  }

  const handleNewSession = (projectPath: string, projectName: string) => {
    setActiveSessionId(undefined)
    setTerminal({
      key: `new-${projectPath}-${Date.now()}`,
      cwd: projectPath,
      autoCommand: 'claude',
      label: `New session — ${projectName}`,
      labelSub: projectPath,
    })
  }

  const handleClearSession = () => {
    setActiveSessionId(undefined)
    setTerminal({ key: `clear-${Date.now()}` })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      const newWidth = Math.max(200, Math.min(500, startWidth + delta))
      setSidebarWidth(newWidth)
    }

    const onUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const hasBar = !!terminal.label

  return (
    <div className={`app ${isResizing ? 'resizing' : ''}`}>
      <div className="titlebar" />

      <div className="layout">
        <div className="sidebar-wrapper" style={{ width: sidebarWidth }}>
          <Sidebar
            onOpenSession={handleResumeSession}
            onNewSession={handleNewSession}
            activeSessionId={activeSessionId}
          />
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown} />

        <div className="main-area">
          {hasBar && (
            <div className="session-bar">
              <span className="session-bar-title">{terminal.label}</span>
              <span className="session-bar-cwd">{terminal.labelSub}</span>
              <button className="session-bar-clear" onClick={handleClearSession} title="Close">
                ✕
              </button>
            </div>
          )}
          <div className="terminal-wrapper">
            <TerminalPanel
              key={terminal.key}
              launchCwd={terminal.cwd}
              autoCommand={terminal.autoCommand}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
