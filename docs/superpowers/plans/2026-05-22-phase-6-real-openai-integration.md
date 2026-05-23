# AgentDesk Phase 6 Real OpenAI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 5 fake AI path with backend-only OpenAI Responses API calls while preserving approval and VirtualFS safety.

**Architecture:** `backend/phase6/openai-service.js` is the only OpenAI SDK boundary. A Phase 6 runtime composes a real streaming orchestrator, non-streaming subagent worker loop, approval pipeline, VirtualFS write execution, cost accounting, and structured error events.

**Tech Stack:** OpenAI JavaScript SDK Responses API, Express, Vitest, Supertest, Phase 3 VirtualFS tools.

---

### Task 1: OpenAI Service Tests

**Files:**
- Create: `tests/backend/phase6-openai-service.test.js`
- Create: `backend/phase6/openai-service.js`

- [ ] Write failing tests for checkpoint events before every call, streaming deltas, usage extraction, 429 retry delays of 5s/10s/20s, 401 invalid-key events, and 5xx surfaced errors.
- [ ] Implement the OpenAI service with injectable client and sleeper.

### Task 2: Phase 6 Runtime Flow Tests

**Files:**
- Create: `tests/backend/phase6-runtime.test.js`
- Create: `backend/phase6/runtime.js`
- Create: `backend/phase6/orchestrator-service.js`
- Create: `backend/phase6/subagent-worker.js`
- Create: `backend/phase6/agent-manager.js`
- Create: `backend/phase6/context-compactor.js`

- [ ] Write failing tests for “tell alice to create hello.txt with hello world”, approval creation, approval execution, file creation on disk, trace events, cost increment, max 20 iterations, and no worker crash.
- [ ] Implement the runtime using injected OpenAI service responses and Phase 3 file tools.

### Task 3: Server and Renderer Integration

**Files:**
- Modify: `backend/server.js`
- Modify: `frontend/src/phase5Api.ts`
- Modify: `frontend/src/App.vue`
- Modify: `package.json`

- [ ] Make Phase 6 runtime the default server runtime.
- [ ] Expose cost and OpenAI error state through existing state endpoints.
- [ ] Add `phase6:check`.
- [ ] Keep API keys backend-only and never expose them through preload or renderer responses.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run phase6:check`.
- [ ] If `OPENAI_API_KEY` is present, run the real flow against a temporary workspace; otherwise report real API verification as not run due missing key.
- [ ] Electron smoke test and process cleanup.
