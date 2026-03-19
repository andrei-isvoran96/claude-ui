import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface Props {
  launchCwd?: string
  autoCommand?: string
  onReady?: () => void
}

export default function TerminalPanel({ launchCwd, autoCommand, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const initPty = useCallback(async (
    term: Terminal,
    fitAddon: FitAddon,
    cwd?: string,
    command?: string,
  ) => {
    fitAddon.fit()
    const { cols, rows } = term

    const { ptyId } = await window.electronAPI.pty.create(cols, rows, cwd)
    ptyIdRef.current = ptyId

    if (command) {
      // Wait for the shell to settle (no PTY output for 200ms) before sending the command.
      // This avoids the race condition where the command is sent before zsh finishes sourcing .zshrc.
      let quietTimer: ReturnType<typeof setTimeout> | null = null
      let sent = false

      const sendCommand = () => {
        if (sent) return
        sent = true
        window.electronAPI.pty.write(ptyId, `${command}\n`)
      }

      // Fallback: send after 3s regardless
      const fallback = setTimeout(sendCommand, 3000)

      window.electronAPI.pty.onData(ptyId, (data) => {
        term.write(data)
        if (sent) return
        if (quietTimer) clearTimeout(quietTimer)
        quietTimer = setTimeout(() => {
          clearTimeout(fallback)
          sendCommand()
        }, 200)
      })

      window.electronAPI.pty.onExit(ptyId, ({ exitCode }) => {
        clearTimeout(fallback)
        if (quietTimer) clearTimeout(quietTimer)
        term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`)
      })
    } else {
      window.electronAPI.pty.onData(ptyId, (data) => {
        term.write(data)
      })

      window.electronAPI.pty.onExit(ptyId, ({ exitCode }) => {
        term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`)
      })
    }

    term.onData((data) => {
      window.electronAPI.pty.write(ptyId, data)
    })

    term.onResize(({ cols, rows }) => {
      window.electronAPI.pty.resize(ptyId, cols, rows)
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

    initPty(term, fitAddon, launchCwd, autoCommand).then(() => {
      onReady?.()
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      const ptyId = ptyIdRef.current
      if (ptyId) {
        window.electronAPI.pty.removeListeners(ptyId)
        window.electronAPI.pty.kill(ptyId)
        ptyIdRef.current = null
      }
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
