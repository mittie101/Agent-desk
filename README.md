# AgentDesk

A standalone Windows desktop app that lets you orchestrate multiple OpenAI-powered AI agents through a real-time chat interface — with built-in sandboxing, approval workflows, audit logging, and workspace snapshots.

---

## What it does

AgentDesk sits on your desktop and connects to OpenAI. You type instructions in a chat window; the orchestrator (GPT-4o) breaks down your request and spins up sub-agents (GPT-4o-mini) to carry out the work. Every file write, bash command, and directory change is intercepted, classified by severity, and either auto-approved or held for your confirmation before anything touches your filesystem.

### Key features

| Feature | Details |
|---|---|
| **Orchestrator chat** | Streaming GPT-4o responses in a three-column UI |
| **Agent management** | Create, interrupt, and monitor named agents (e.g. `alice`) |
| **VirtualFS sandboxing** | All tool calls are routed through a virtual filesystem — no direct `fs` access |
| **Severity-gated approvals** | Low actions auto-approve; medium needs a click; high needs confirmation; critical requires you to type `DELETE` / `PUSH` / `RESET` / `OVERWRITE` |
| **Permission modes** | `safe` → `edit` (default) → `execute` → `unrestricted` (shown with a red banner) |
| **Protected paths** | `.env`, `.git/`, `node_modules/`, lock files, certificates — always classified as critical |
| **EventStream** | Live feed of every tool call, result, approval event, and cost update with filters and search |
| **Budget limits** | Per-run token and cost caps enforced before each OpenAI call |
| **SQLite persistence** | Chat history, agents, events, and settings survive app restarts |
| **Workspace snapshots** | Create and restore point-in-time snapshots of captured files |
| **Secure API key storage** | Key stored via Electron `safeStorage` — never reaches the renderer process |

---

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron |
| Frontend | Vue 3 + TypeScript (Vite) |
| Backend | Express (inside Electron main process, bound to `127.0.0.1:9403`) |
| AI provider | OpenAI Chat Completions |
| Orchestrator model | `gpt-4o` |
| Agent model | `gpt-4o-mini` |
| Database | SQLite via `better-sqlite3` |
| Realtime | WebSocket (`ws`) |
| Worker isolation | `worker_threads` |
| Shell execution | `child_process.spawn` only |
| Packaging | `electron-builder` + NSIS |

---

## Getting started

### Prerequisites

- Windows 10/11 (x64)
- Node.js 20+
- An OpenAI API key

### Install & run in development

```bash
npm install
npm run dev       # start Vite dev server
npm start         # launch Electron window
```

### Build a Windows installer

```bash
npm run dist
```

The installer and portable `.exe` are output to `release/`.

---

## Configuration

Copy `.env.example` to `.env` and set your API key, **or** enter it directly in the Settings modal when the app launches:

```
OPENAI_API_KEY=your-openai-api-key-here
AGENTDESK_OPENAI_MODEL=gpt-4o
```

> The API key is encrypted with Electron `safeStorage` on first save and never sent to the renderer process.

---

## Usage walkthrough

1. Launch AgentDesk and open **Settings** (`Ctrl+,`)
2. Enter your OpenAI API key and choose a working directory
3. In the chat, type: `Create an agent called alice for Python development`
4. Then: `Tell alice to create hello.txt with the content "hello world"`
5. An **approval card** appears — click **Approve**
6. `hello.txt` is written to disk and the EventStream shows the full execution trace
7. Close and reopen the app — Alice, the chat, and the events are all still there

---

## Security model

- Electron window runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Express binds only to `127.0.0.1` — never `0.0.0.0`
- Every request is authenticated with a per-session token (`X-Session-Token`)
- Workers communicate exclusively via `postMessage` — no SQLite, no `electron`, no `fs`
- No tool may bypass the VirtualFS → permission-policy → severity-classifier → approval pipeline

---

## Project structure

```
agentdesk/
├── electron/          # Main process, preload, window state
├── backend/
│   ├── core/          # VirtualFS, security, tools, services
│   ├── migrations/    # SQLite schema (runs once on startup)
│   ├── phase5/        # Stubbed orchestration layer
│   ├── phase6/        # Real OpenAI integration
│   └── phase8/        # Snapshot service
├── frontend/
│   └── src/           # Vue 3 components and stores
└── tests/             # Vitest unit tests (backend + frontend)
```

---

## Running tests

```bash
npm test
```

---

## License

Private — all rights reserved.
