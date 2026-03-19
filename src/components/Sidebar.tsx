import { useState, useEffect, useRef } from 'react'
import type { Project, Session } from '../types'

interface Props {
  onOpenSession: (session: Session) => void
  onNewSession: (projectPath: string, projectName: string) => void
  onOpenSessionInTab: (session: Session) => void
  onOpenSessionInSplit: (session: Session) => void
  activeSessionId?: string
}

interface ContextMenuState {
  x: number
  y: number
  session: Session
}

function formatTime(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function ContextMenu({
  menu,
  onClose,
  onOpen,
  onOpenInTab,
  onOpenInSplit,
}: {
  menu: ContextMenuState
  onClose: () => void
  onOpen: (session: Session) => void
  onOpenInTab: (session: Session) => void
  onOpenInSplit: (session: Session) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handle = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <button className="context-menu-item" onClick={handle(() => onOpen(menu.session))}>
        Resume
      </button>
      <button className="context-menu-item" onClick={handle(() => onOpenInTab(menu.session))}>
        Open in New Tab
      </button>
      <button className="context-menu-item" onClick={handle(() => onOpenInSplit(menu.session))}>
        Open in Split Screen
      </button>
    </div>
  )
}

function ProjectGroup({
  project,
  onOpenSession,
  onNewSession,
  onOpenSessionInTab,
  onOpenSessionInSplit,
  activeSessionId,
  onContextMenu,
}: {
  project: Project
  onOpenSession: (s: Session) => void
  onNewSession: (path: string, name: string) => void
  onOpenSessionInTab: (s: Session) => void
  onOpenSessionInSplit: (s: Session) => void
  activeSessionId?: string
  onContextMenu: (e: React.MouseEvent, session: Session) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="project-group">
      <div className="project-header-row">
        <button className="project-header" onClick={() => setCollapsed(!collapsed)}>
          <span className="project-chevron">{collapsed ? '›' : '⌄'}</span>
          <span className="project-name" title={project.path}>{project.name}</span>
          <span className="session-count">{project.sessions.length}</span>
        </button>
        <button
          className="new-session-btn"
          onClick={() => onNewSession(project.path, project.name)}
          title={`New claude session in ${project.name}`}
        >
          +
        </button>
      </div>

      {!collapsed && (
        <div className="session-list">
          {project.sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item${session.id === activeSessionId ? ' session-item--active' : ''}`}
              onClick={() => onOpenSession(session)}
              onContextMenu={(e) => onContextMenu(e, session)}
              title={`Resume: ${session.cwd}`}
            >
              <span className="session-title">{session.title}</span>
              <span className="session-meta">
                {session.gitBranch && (
                  <span className="branch-badge">{session.gitBranch}</span>
                )}
                <span className="session-time">{formatTime(session.timestamp)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  onOpenSession,
  onNewSession,
  onOpenSessionInTab,
  onOpenSessionInSplit,
  activeSessionId,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    window.electronAPI.history.load().then((data) => {
      setProjects(data)
      setLoading(false)
    })

    window.electronAPI.history.onUpdate((data) => {
      setProjects(data)
    })
  }, [])

  const handleContextMenu = (e: React.MouseEvent, session: Session) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, session })
  }

  const filtered = search.trim()
    ? projects.map(p => ({
        ...p,
        sessions: p.sessions.filter(s =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(p => p.sessions.length > 0)
    : projects

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">History</span>
      </div>

      <div className="search-wrapper">
        <input
          className="search-input"
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="sidebar-empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="sidebar-empty">
            {search ? 'No results' : 'No sessions yet'}
          </div>
        ) : (
          filtered.map((project) => (
            <ProjectGroup
              key={project.path}
              project={project}
              onOpenSession={onOpenSession}
              onNewSession={onNewSession}
              onOpenSessionInTab={onOpenSessionInTab}
              onOpenSessionInSplit={onOpenSessionInSplit}
              activeSessionId={activeSessionId}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpen={onOpenSession}
          onOpenInTab={onOpenSessionInTab}
          onOpenInSplit={onOpenSessionInSplit}
        />
      )}
    </div>
  )
}
