import type { Session } from '../types'

interface Props {
  session: Session
  onClose: () => void
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  return (
    <div className={`message message-${role}`}>
      <div className="message-role">{role === 'user' ? 'You' : 'Claude'}</div>
      <div className="message-content">{content}</div>
    </div>
  )
}

export default function SessionViewer({ session, onClose }: Props) {
  return (
    <div className="session-viewer">
      <div className="session-viewer-header">
        <div className="session-viewer-meta">
          <span className="session-viewer-title">{session.title}</span>
          {session.gitBranch && (
            <span className="branch-badge">{session.gitBranch}</span>
          )}
          <span className="session-viewer-cwd">{session.cwd}</span>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="session-viewer-messages">
        {session.messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
      </div>
    </div>
  )
}
