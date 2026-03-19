import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface Props {
  launchCwd?: string
  resumeSessionId?: string
  onReady?: () => void
}

export default function TerminalPanel({ launchCwd, resumeSessionId, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initializedRef = useRef(false)

  const initPty = useCallback(async (
    term: Terminal,
    fitAddon: FitAddon,
    cwd?: string,
    resumeId?: string,
  ) => {
    fitAddon.fit()
    const { cols, rows } = term

    await window.electronAPI.pty.create(cols, rows, cwd)

    if (resumeId) {
      // Wait for the shell to settle (no PTY output for 200ms) before sending the resume command.
      // This avoids the race condition where the command is sent before zsh finishes sourcing .zshrc.
      let quietTimer: ReturnType<typeof setTimeout> | null = null
      let sent = false

      const sendResume = () => {
        if (sent) return
        sent = true
        window.electronAPI.pty.write(`claude --resume ${resumeId}\n`)
      }

      // Fallback: send after 3s regardless
      const fallback = setTimeout(sendResume, 3000)

      window.electronAPI.pty.onData((data) => {
        term.write(data)
        if (sent) return
        // Reset quiet timer on every chunk of output
        if (quietTimer) clearTimeout(quietTimer)
        quietTimer = setTimeout(() => {
          clearTimeout(fallback)
          sendResume()
        }, 200)
      })

      window.electronAPI.pty.onExit(({ exitCode }) => {
        clearTimeout(fallback)
        if (quietTimer) clearTimeout(quietTimer)
        term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`)
      })
    } else {
      window.electronAPI.pty.onData((data) => {
        term.write(data)
      })

      window.electronAPI.pty.onExit(({ exitCode }) => {
        term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`)
      })
    }

    term.onData((data) => {
      window.electronAPI.pty.write(data)
    })

    term.onResize(({ cols, rows }) => {
      window.electronAPI.pty.resize(cols, rows)
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#0d0d0d',
        foreground: '#e8e8e8',
        cursor: '#cc785c',
        cursorAccent: '#0d0d0d',
        black: '#1a1a1a',
        red: '#cc3333',
        green: '#4ec9b0',
        yellow: '#d4a027',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4fc1ff',
        white: '#d4d4d4',
        brightBlack: '#555555',
        brightRed: '#f44747',
        brightGreen: '#6dc6b0',
        brightYellow: '#dcdcaa',
        brightBlue: '#9cdcfe',
        brightMagenta: '#d7ba7d',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
        selectionBackground: '#264f78',
      },
      allowProposedApi: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    initPty(term, fitAddon, launchCwd, resumeSessionId).then(() => {
      onReady?.()
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      window.electronAPI.pty.removeListeners()
      term.dispose()
      initializedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0d0d0d',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    />
  )
}
