# AgentDesk Phase 1 Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Electron/Vue/Express scaffold for AgentDesk.

**Architecture:** Electron starts an Express server bound to `127.0.0.1:9403`, then loads the Vite-built Vue renderer. Tests validate the health route, loopback binding, and Electron security settings before any production code is considered complete.

**Tech Stack:** Electron, Vue 3, TypeScript, Vite, Express, Vitest, Supertest, Node.js.

---

### Task 1: Project Manifest and Tests

**Files:**
- Create: `package.json`
- Create: `tests/backend/server.test.js`
- Create: `tests/electron/security.test.js`

- [ ] Write failing tests for backend health and loopback binding.
- [ ] Write failing tests for Electron BrowserWindow security preferences.
- [ ] Run tests and confirm they fail because files/modules are missing.

### Task 2: Backend Scaffold

**Files:**
- Create: `backend/server.js`

- [ ] Implement `createServer()` with `GET /health`.
- [ ] Implement `startServer()` with a fixed `127.0.0.1:9403` default.
- [ ] Run backend tests and confirm they pass.

### Task 3: Electron Scaffold

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `electron/window-state.js`

- [ ] Implement secure BrowserWindow options.
- [ ] Expose only non-secret app metadata from preload.
- [ ] Add defensive window-state persistence.
- [ ] Run Electron security tests and confirm they pass.

### Task 4: Vue Renderer Scaffold

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/env.d.ts`

- [ ] Implement a minimal static Phase 1 shell.
- [ ] Configure Vite `base: './'`.
- [ ] Run production build and confirm it passes.

### Task 5: Golden Checks

**Files:**
- Verify all created files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Search for forbidden `child_process.exec`.
- [ ] Search for forbidden backend bind `0.0.0.0`.
- [ ] Search for premature OpenAI call sites.
- [ ] Launch Electron long enough to confirm startup does not crash.
- [ ] Stop after Phase 1 and report exit criteria.

