import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TerminalPanel from './components/TerminalPanel'
import type { Session } from './types'
import './App.css'

interface PanelState {
  id: string
  termKey: string
  cwd?: string
  autoCommand?: string
  label?: string
  labelSub?: string
  sessionId?: string
}

function makeId() {
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULT_PANEL: PanelState = { id: 'main', termKey: 'default' }

export default function App() {
  const [tabs, setTabs] = useState<PanelState[]>([DEFAULT_PANEL])
  const [activeTabId, setActiveTabId] = useState('main')
  const [splitPanel, setSplitPanel] = useState<PanelState | null>(null)
  // Track which tabs have been mounted at least once (to avoid mounting hidden tabs)
  const [mountedTabIds, setMountedTabIds] = useState<Set<string>>(new Set(['main']))
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  const activateTab = (id: string) => {
    setActiveTabId(id)
    setMountedTabIds(prev => new Set([...prev, id]))
  }

  // Update the active tab in-place (for resume/new session in current tab)
  const updateActiveTab = (updates: Partial<PanelState>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t))
  }

  const handleResumeSession = (session: Session) => {
    updateActiveTab({
      termKey: `resume-${session.id}-${Date.now()}`,
      cwd: session.cwd,
      autoCommand: `claude --resume ${session.id}`,
      label: session.title,
      labelSub: session.gitBranch ?? session.cwd,
      sessionId: session.id,
    })
  }

  const handleNewSession = (projectPath: string, projectName: string) => {
    updateActiveTab({
      termKey: `new-${projectPath}-${Date.now()}`,
      cwd: projectPath,
      autoCommand: 'claude',
      label: `New session — ${projectName}`,
      labelSub: projectPath,
      sessionId: undefined,
    })
  }

  const handleOpenInTab = (session: Session) => {
    const id = makeId()
    const panel: PanelState = {
      id,
      termKey: `tab-resume-${session.id}-${Date.now()}`,
      cwd: session.cwd,
      autoCommand: `claude --resume ${session.id}`,
      label: session.title,
      labelSub: session.gitBranch ?? session.cwd,
      sessionId: session.id,
    }
    setTabs(prev => [...prev, panel])
    setMountedTabIds(prev => new Set([...prev, id]))
    setActiveTabId(id)
  }

  const handleOpenInSplit = (session: Session) => {
    setSplitPanel({
      id: makeId(),
      termKey: `split-resume-${session.id}-${Date.now()}`,
      cwd: session.cwd,
      autoCommand: `claude --resume ${session.id}`,
      label: session.title,
      labelSub: session.gitBranch ?? session.cwd,
      sessionId: session.id,
    })
  }

  const handleClearActiveTab = () => {
    updateActiveTab({
      termKey: `clear-${Date.now()}`,
      cwd: undefined,
      autoCommand: undefined,
      label: undefined,
      labelSub: undefined,
      sessionId: undefined,
    })
  }

  const handleAddTab = () => {
    const id = makeId()
    setTabs(prev => [...prev, { id, termKey: `new-tab-${Date.now()}` }])
    setMountedTabIds(prev => new Set([...prev, id]))
    setActiveTabId(id)
  }

  const handleCloseTab = (id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        const freshId = makeId()
        const fresh: PanelState = { id: freshId, termKey: `clear-${Date.now()}` }
        setMountedTabIds(new Set([freshId]))
        setActiveTabId(freshId)
        return [fresh]
      }
      if (id === activeTabId) {
        const newActive = next[next.length - 1]
        setMountedTabIds(mp => new Set([...mp, newActive.id]))
        setActiveTabId(newActive.id)
      }
      return next
    })
    setMountedTabIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
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

  const activeSessionId = activeTab?.sessionId

  return (
    <div className={`app ${isResizing ? 'resizing' : ''}`}>
      <div className="titlebar" />

      <div className="layout">
        <div className="sidebar-wrapper" style={{ width: sidebarWidth }}>
          <Sidebar
            onOpenSession={handleResumeSession}
            onNewSession={handleNewSession}
            onOpenSessionInTab={handleOpenInTab}
            onOpenSessionInSplit={handleOpenInSplit}
            activeSessionId={activeSessionId}
          />
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown} />

        <div className="main-area">
          {/* Tab bar */}
          <div className="tab-bar">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`tab${tab.id === activeTabId ? ' tab--active' : ''}`}
                onClick={() => activateTab(tab.id)}
                title={tab.label ?? 'New Session'}
              >
                <span className="tab-label">{tab.label ?? 'New Session'}</span>
                {tabs.length > 1 && (
                  <button
                    className="tab-close"
                    onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }}
                    title="Close tab"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="tab-add" onClick={handleAddTab} title="New tab">+</button>
          </div>

          {/* Terminal area — primary + optional split pane */}
          <div className="terminal-area">
            <div className={`terminal-pane${splitPanel ? ' terminal-pane--half' : ''}`}>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className="terminal-pane-content"
                  style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
                >
                  {tab.label && (
                    <div className="session-bar">
                      <span className="session-bar-title">{tab.label}</span>
                      <span className="session-bar-cwd">{tab.labelSub}</span>
                      <button className="session-bar-clear" onClick={handleClearActiveTab} title="Close">
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="terminal-wrapper">
                    {mountedTabIds.has(tab.id) && (
                      <TerminalPanel
                        key={tab.termKey}
                        launchCwd={tab.cwd}
                        autoCommand={tab.autoCommand}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {splitPanel && (
              <>
                <div className="split-divider" />
                <div className="terminal-pane terminal-pane--half">
                  <div className="terminal-pane-content" style={{ display: 'flex' }}>
                    <div className="session-bar">
                      <span className="session-bar-title">{splitPanel.label ?? 'New Session'}</span>
                      <span className="session-bar-cwd">{splitPanel.labelSub}</span>
                      <button
                        className="session-bar-clear"
                        onClick={() => setSplitPanel(null)}
                        title="Close split"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="terminal-wrapper">
                      <TerminalPanel
                        key={splitPanel.termKey}
                        launchCwd={splitPanel.cwd}
                        autoCommand={splitPanel.autoCommand}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
