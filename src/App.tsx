import { useState, useEffect } from 'react'
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

// Only the fields worth persisting across restarts
interface PersistedTab {
  id: string
  cwd?: string
  sessionId?: string
  label?: string
  labelSub?: string
}

interface PersistedState {
  tabs: PersistedTab[]
  activeTabId: string
  splitPanel: PersistedTab | null
}

const STORAGE_KEY = 'claude-ui-tabs'

function makeId() {
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function panelFromPersisted(p: PersistedTab): PanelState {
  const autoCommand = p.sessionId
    ? `claude --resume ${p.sessionId}`
    : p.cwd ? 'claude' : undefined
  return {
    id: p.id,
    termKey: `restore-${p.id}-${Date.now()}`,
    cwd: p.cwd,
    autoCommand,
    label: p.label,
    labelSub: p.labelSub,
    sessionId: p.sessionId,
  }
}

function loadInitialState(): { tabs: PanelState[]; activeTabId: string; splitPanel: PanelState | null; mountedIds: Set<string> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved: PersistedState = JSON.parse(raw)
      if (saved.tabs?.length) {
        const tabs = saved.tabs.map(panelFromPersisted)
        const activeTabId = tabs.find(t => t.id === saved.activeTabId) ? saved.activeTabId : tabs[0].id
        const splitPanel = saved.splitPanel ? panelFromPersisted(saved.splitPanel) : null
        return { tabs, activeTabId, splitPanel, mountedIds: new Set([activeTabId]) }
      }
    }
  } catch {}
  const id = 'main'
  return { tabs: [{ id, termKey: 'default' }], activeTabId: id, splitPanel: null, mountedIds: new Set([id]) }
}

const initial = loadInitialState()

export default function App() {
  const [tabs, setTabs] = useState<PanelState[]>(initial.tabs)
  const [activeTabId, setActiveTabId] = useState(initial.activeTabId)
  const [splitPanel, setSplitPanel] = useState<PanelState | null>(initial.splitPanel)
  // Track which tabs have been mounted at least once (to avoid mounting hidden tabs)
  const [mountedTabIds, setMountedTabIds] = useState<Set<string>>(initial.mountedIds)

  // Persist tabs state whenever it changes
  useEffect(() => {
    const state: PersistedState = {
      tabs: tabs.map(t => ({ id: t.id, cwd: t.cwd, sessionId: t.sessionId, label: t.label, labelSub: t.labelSub })),
      activeTabId,
      splitPanel: splitPanel ? { id: splitPanel.id, cwd: splitPanel.cwd, sessionId: splitPanel.sessionId, label: splitPanel.label, labelSub: splitPanel.labelSub } : null,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [tabs, activeTabId, splitPanel])
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

  const handleNewSessionInTab = (projectPath: string, projectName: string) => {
    const id = makeId()
    const panel: PanelState = {
      id,
      termKey: `new-tab-${Date.now()}`,
      cwd: projectPath,
      autoCommand: 'claude',
      label: `New session — ${projectName}`,
      labelSub: projectPath,
    }
    setTabs(prev => [...prev, panel])
    setMountedTabIds(prev => new Set([...prev, id]))
    setActiveTabId(id)
  }

  const handleNewSessionInSplit = (projectPath: string, projectName: string) => {
    setSplitPanel({
      id: makeId(),
      termKey: `split-new-${Date.now()}`,
      cwd: projectPath,
      autoCommand: 'claude',
      label: `New session — ${projectName}`,
      labelSub: projectPath,
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

  const handleOpenSplitBlank = () => {
    setSplitPanel({ id: makeId(), termKey: `split-blank-${Date.now()}` })
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
            onNewSessionInTab={handleNewSessionInTab}
            onNewSessionInSplit={handleNewSessionInSplit}
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
