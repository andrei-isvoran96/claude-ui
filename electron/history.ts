import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Project, Session, ChatMessage } from './types'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

function dirNameToFallbackPath(dirName: string): string {
  // Naive decode — only used when no session has a cwd field.
  // Replaces leading '-' with '/' and subsequent '-' with '/'.
  // NOTE: this is lossy for paths containing dashes in directory names.
  return '/' + dirName.replace(/^-/, '').replace(/-/g, '/')
}

// Tags injected by the Claude Code harness that are not real user messages
const SYSTEM_TAG_PREFIXES = [
  'local-command-caveat',
  'command-name',
  'command-message',
  'command-args',
  'local-command-stdout',
  'system-reminder',
  'user-prompt-submit-hook',
]

function isSystemMessage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('<')) return false
  // If the content is entirely XML-like tags with no plain text outside them, it's a system message
  const withoutTags = trimmed.replace(/<[^>]+>[^<]*<\/[^>]+>/g, '').replace(/<[^>]+\/>/g, '').trim()
  if (withoutTags.length === 0) return true
  // Check for known system tag prefixes at the start
  return SYSTEM_TAG_PREFIXES.some(prefix => trimmed.startsWith(`<${prefix}`))
}

function stripSystemTags(text: string): string {
  // Remove any remaining XML-style system tags and their content
  let result = text
  for (const prefix of SYSTEM_TAG_PREFIXES) {
    result = result.replace(new RegExp(`<${prefix}[^>]*>[\\s\\S]*?<\\/${prefix}>`, 'g'), '')
  }
  return result.trim()
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((c: unknown) => {
        if (typeof c === 'object' && c !== null) {
          const obj = c as Record<string, unknown>
          return obj.type === 'text' && typeof obj.text === 'string'
        }
        return false
      })
      .map((c: unknown) => {
        const obj = c as Record<string, unknown>
        return obj.text as string
      })
      .join('')
  }
  return ''
}

function parseJsonl(filePath: string): Session | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const lines = raw.trim().split('\n').filter(Boolean)

    const messages: ChatMessage[] = []
    let firstTimestamp = ''
    let cwd = ''
    let gitBranch: string | undefined
    let sessionId = path.basename(filePath, '.jsonl')

    for (const line of lines) {
      let record: Record<string, unknown>
      try {
        record = JSON.parse(line)
      } catch {
        continue
      }

      const type = record.type as string
      if (type !== 'user' && type !== 'assistant') continue

      if (!firstTimestamp && record.timestamp) {
        firstTimestamp = record.timestamp as string
      }
      if (!cwd && record.cwd) cwd = record.cwd as string
      if (!gitBranch && record.gitBranch) gitBranch = record.gitBranch as string
      if (record.sessionId) sessionId = record.sessionId as string

      const msgRecord = record.message as Record<string, unknown> | undefined
      if (!msgRecord) continue

      const role = msgRecord.role as string
      if (role !== 'user' && role !== 'assistant') continue

      const rawText = extractTextContent(msgRecord.content)
      if (!rawText.trim()) continue
      if (isSystemMessage(rawText)) continue

      const text = stripSystemTags(rawText)
      if (!text.trim()) continue

      messages.push({
        role: role as 'user' | 'assistant',
        content: text,
        timestamp: (record.timestamp as string) || '',
      })
    }

    if (messages.length === 0) return null

    const firstUserMsg = messages.find(m => m.role === 'user')
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 80).replace(/\n/g, ' ')
      : 'Untitled session'

    return {
      id: sessionId,
      title,
      timestamp: firstTimestamp,
      cwd,
      gitBranch,
      messages,
    }
  } catch {
    return null
  }
}

export function loadHistory(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
  })

  const projects: Project[] = []

  for (const dirName of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dirName)

    const jsonlFiles = fs
      .readdirSync(dirPath)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(dirPath, f))

    const sessions: Session[] = jsonlFiles
      .map(parseJsonl)
      .filter((s): s is Session => s !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    if (sessions.length > 0) {
      // Prefer the actual cwd recorded in sessions — it's exact and handles
      // directory names that contain dashes (which dirNameToFallbackPath mangles).
      const projectPath = sessions.find(s => s.cwd)?.cwd || dirNameToFallbackPath(dirName)
      const projectName = projectPath.split('/').filter(Boolean).pop() || dirName
      projects.push({ path: projectPath, name: projectName, sessions })
    }
  }

  // Sort projects by most recent session
  projects.sort((a, b) => {
    const aTime = new Date(a.sessions[0]?.timestamp || 0).getTime()
    const bTime = new Date(b.sessions[0]?.timestamp || 0).getTime()
    return bTime - aTime
  })

  return projects
}

export function watchHistory(onChange: () => void): () => void {
  // Use polling since chokidar v5 removed fs.watch wrapper for simplicity
  let lastCheck = Date.now()
  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(PROJECTS_DIR)) return
      // Check the top-level dir and all project subdirectories for changes
      const dirsToCheck = [PROJECTS_DIR]
      try {
        for (const entry of fs.readdirSync(PROJECTS_DIR)) {
          const sub = path.join(PROJECTS_DIR, entry)
          if (fs.statSync(sub).isDirectory()) dirsToCheck.push(sub)
        }
      } catch { /* ignore */ }

      const changed = dirsToCheck.some(dir => {
        try { return fs.statSync(dir).mtimeMs > lastCheck } catch { return false }
      })
      if (changed) {
        lastCheck = Date.now()
        onChange()
      }
    } catch {
      // ignore
    }
  }, 3000)

  return () => clearInterval(interval)
}
