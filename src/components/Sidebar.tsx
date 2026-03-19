import { useState, useEffect } from 'react'
import type { Project, Session } from '../types'

interface Props {
  onOpenSession: (session: Session) => void
  onNewSession: (projectPath: string, projectName: string) => void
  activeSessionId?: string
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

function ProjectGroup({
  project,
  onOpenSession,
  onNewSession,
  activeSessionId,
}: {
  project: Project
  onOpenSession: (s: Session) => void
  onNewSession: (path: string, name: string) => void
  activeSessionId?: string
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

export default function Sidebar({ onOpenSession, onNewSession, activeSessionId }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.electronAPI.history.load().then((data) => {
      setProjects(data)
      setLoading(false)
    })

    window.electronAPI.history.onUpdate((data) => {
      setProjects(data)
    })
  }, [])

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
              activeSessionId={activeSessionId}
            />
          ))
        )}
      </div>
    </div>
  )
}
