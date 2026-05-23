# AgentDesk Phase 5 Stubbed End-to-End Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete interactive app flow with fake AI, approvals, agent status updates, settings persistence, and no OpenAI dependency.

**Architecture:** A deterministic in-memory Phase 5 runtime owns chat, agents, events, approvals, snapshots, and settings. Express routes expose the required API surface, a WebSocket manager broadcasts state changes, and the Vue renderer uses strict client-side calls to the local loopback backend.

**Tech Stack:** Express, `ws`, Vue 3, TypeScript, Vitest, Supertest.

---

### Task 1: Backend Stub Flow Tests

**Files:**
- Create: `tests/backend/phase5-flow.test.js`

- [ ] Write failing tests for `POST /send_chat`, `GET /agents`, `GET /events`, `GET /chat_history`, `POST /approve/:approvalId`, `POST /deny/:approvalId`, `POST /interrupt/:agentName`, `GET /snapshots`, and settings save/reload.
- [ ] Run the focused test and confirm it fails before implementation.

### Task 2: Runtime Services

**Files:**
- Create: `backend/phase5/runtime.js`
- Create: `backend/phase5/websocket-manager.js`
- Create: `backend/phase5/approval-manager.js`
- Create: `backend/phase5/orchestrator-service.js`
- Create: `backend/phase5/agent-manager.js`
- Create: `backend/phase5/mock-worker.js`

- [ ] Implement deterministic fake AI flow: send chat, stream text event, start agent, create write-file approval, resolve approval, emit mock tool result, close run.
- [ ] Ensure all methods return structured results and never call OpenAI.

### Task 3: Routes and Server Integration

**Files:**
- Modify: `backend/server.js`

- [ ] Mount required Phase 5 routes with strict request validation.
- [ ] Attach the WebSocket manager during `startServer`.
- [ ] Keep `/health` deterministic and update phase metadata.

### Task 4: Renderer Interactive Flow

**Files:**
- Create: `frontend/src/phase5Api.ts`
- Modify: `frontend/src/App.vue`

- [ ] Load agents/events/chat/snapshots/settings from the backend.
- [ ] Add chat submit, approve, deny, interrupt, critical typed confirmation, and settings save/reload controls.
- [ ] Preserve the Phase 4 three-column layout and no-overflow behavior.

### Task 5: Phase 5 Verification

**Files:**
- Modify: `package.json`

- [ ] Add `phase5:check`.
- [ ] Run `npm test`, `npm run build`, `npm run phase5:check`.
- [ ] Browser-test the full fake flow and verify approval card resolves, agent status updates, settings reloads, no console errors.
- [ ] Electron smoke-test and stop after Phase 5.
