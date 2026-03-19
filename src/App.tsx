import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TerminalPanel from './components/TerminalPanel'
import type { Session } from './types'
import './App.css'

export default function App() {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  // terminalKey changes to force TerminalPanel remount on session resume
  const [terminalKey, setTerminalKey] = useState('default')
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)

  const handleResumeSession = (session: Session) => {
    setActiveSession(session)
    setTerminalKey(`session-${session.id}`)
  }

  const handleClearSession = () => {
    setActiveSession(null)
    setTerminalKey('default')
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

  return (
    <div className={`app ${isResizing ? 'resizing' : ''}`}>
      <div className="titlebar" />

      <div className="layout">
        <div className="sidebar-wrapper" style={{ width: sidebarWidth }}>
          <Sidebar onOpenSession={handleResumeSession} activeSessionId={activeSession?.id} />
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown} />

        <div className="main-area">
          {activeSession && (
            <div className="session-bar">
              <span className="session-bar-title">{activeSession.title}</span>
              {activeSession.gitBranch && (
                <span className="branch-badge">{activeSession.gitBranch}</span>
              )}
              <span className="session-bar-cwd">{activeSession.cwd}</span>
              <button className="session-bar-clear" onClick={handleClearSession} title="New terminal">
                ✕
              </button>
            </div>
          )}
          <div className="terminal-wrapper">
            <TerminalPanel
              key={terminalKey}
              launchCwd={activeSession?.cwd}
              resumeSessionId={activeSession?.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
