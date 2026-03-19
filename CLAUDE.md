# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Claude UI is an Electron desktop app that wraps the Claude Code CLI with a GUI. It provides a real terminal (via node-pty + xterm.js), a sidebar showing session history from `~/.claude/projects/`, and one-click session resumption.

## Commands

```bash
npm install
npm run rebuild-pty      # Required after npm install — rebuilds node-pty native module for Electron
npm run dev              # Development: starts Vite (port 5173) + Electron concurrently with hot reload
npm run build            # Production build: compiles Electron TS + Vite renderer
npm run start            # Build and launch production app
```

There are no test commands — this project has no test suite.

## Architecture

The app has two processes that communicate over Electron IPC:

**Electron main process** (`electron/`):
- `main.ts` — Creates the BrowserWindow, manages PTY lifecycle, handles all IPC
- `preload.ts` — Security bridge; exposes `window.electronAPI` to the renderer via `contextBridge`
- `history.ts` — Reads and watches `~/.claude/projects/**/*.jsonl` (JSONL session files) using chokidar; polls every 3s
- `types.ts` — Shared interfaces (`Session`, `Project`, `ChatMessage`, `ElectronAPI`)

Compiles to `dist-electron/` (CommonJS, ES2020).

**React renderer** (`src/`):
- `App.tsx` — Root component; owns terminal state, sidebar width, active session, and session-resume logic
- `components/TerminalPanel.tsx` — xterm.js terminal wrapper; communicates with PTY over IPC
- `components/Sidebar.tsx` — Session history browser with search and project grouping
- `components/SessionViewer.tsx` — Modal for reading past session conversations
- `types.ts` / `electron.d.ts` — Frontend type declarations including `window.electronAPI`

Compiles to `dist-renderer/` via Vite.

**IPC channels:**
- Renderer → Main: `pty:create`, `pty:write`, `pty:resize`, `history:load`
- Main → Renderer: `pty:data`, `pty:exit`, `history:update`

## Key implementation details

- **Session resumption:** After a session is clicked, `App.tsx` increments a `key` on `TerminalPanel` to force-remount xterm.js, then sets an `autoCommand` (`claude --resume <id>`). `TerminalPanel` detects the shell prompt via a 200ms quiet period before sending the command (3s fallback).
- **History parsing:** JSONL files at `~/.claude/projects/<projectdir>/<sessionid>.jsonl`. System-injected XML tags (e.g. `<command-name>`, `<system-reminder>`) are stripped from messages before display.
- **Native module:** `node-pty` must be rebuilt for Electron's Node version after `npm install`. Always run `npm run rebuild-pty`.
- **TypeScript configs:** Three tsconfig files — `tsconfig.app.json` (renderer, ESNext), `tsconfig.electron.json` (main, CommonJS), `tsconfig.node.json` (Vite tooling).
