# AgentDesk Phase 7 Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure known runtime, API, approval, filesystem, budget, and UI failures produce visible structured errors without hangs or crashes.

**Architecture:** The Express boundary wraps sync and async runtime calls, converts thrown exceptions into structured JSON, and records non-secret error state. The Phase 6 runtime records visible error events, exposes `/errors`, guards budget/path/approval failure modes, and keeps agents re-commandable after recoverable failures.

**Tech Stack:** Express, Phase 6 runtime, Phase 3 safety tools, Vitest, Supertest.

---

### Task 1: Route Error Boundary Tests

**Files:**
- Create: `tests/backend/phase7-error-handling.test.js`
- Modify: `backend/server.js`

- [ ] Write failing tests for async runtime rejection, worker crash, empty chat input, and visible `/errors`.
- [ ] Implement async route wrapper and structured 500 responses.

### Task 2: Runtime Failure Guards

**Files:**
- Modify: `backend/phase6/runtime.js`
- Modify: `backend/phase6/context-compactor.js`

- [ ] Write failing tests for missing API key, invalid key, 5xx, loop cap, token/runtime budget exceeded, approval timeout, path escape, protected `.env` write, missing working directory, and compaction fallback.
- [ ] Implement visible events and recovery-safe agent state transitions.

### Task 3: Renderer Visibility

**Files:**
- Modify: `frontend/src/phase5Api.ts`
- Modify: `frontend/src/App.vue`

- [ ] Include backend errors in renderer state.
- [ ] Render a persistent visible error panel without exposing secrets.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run phase7:check`.
- [ ] Electron smoke test and cleanup.
