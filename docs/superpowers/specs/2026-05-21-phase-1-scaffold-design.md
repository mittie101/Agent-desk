# AgentDesk Phase 1 Scaffold Design

## Scope

Phase 1 creates the minimum runnable AgentDesk shell required by `codex.md`: Electron opens, Vue renders, and an Express backend answers `GET /health` on `127.0.0.1:9403`.

This phase does not implement database migrations, agent logic, OpenAI calls, persistence, WebSockets, tool execution, or approval flows.

## Architecture Decisions

- Electron owns process startup and launches the local backend before opening the renderer.
- The backend is a small Express app exported as `createServer()` and `startServer()` so tests can validate binding and routes without launching Electron.
- The renderer is a Vite Vue 3 + TypeScript app with a static Phase 1 shell.
- The preload script exposes only a frozen metadata object through `contextBridge`; it exposes no Node, filesystem, secret, OpenAI, or backend capability.
- The backend host is hard-coded to `127.0.0.1`; `0.0.0.0` is not accepted.

## Security Rules

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- No `child_process.exec`
- No OpenAI client usage
- No renderer access to API keys or decrypted secrets

## Failure Handling

- Backend startup failures are logged and abort app startup.
- The Express server exposes a deterministic health payload.
- Electron waits for the backend before loading the renderer.
- Window-state persistence guards against corrupt state and off-screen bounds.

## Validation Requirements

- Automated tests confirm `/health` returns `200`.
- Automated tests confirm the backend binds only to `127.0.0.1`.
- Automated tests confirm BrowserWindow security preferences are present.
- Static search confirms no `child_process.exec`, no OpenAI call sites, and no `0.0.0.0` bind.
- Production build must complete.

