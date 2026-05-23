# AgentDesk Phase 4 Static UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the full AgentDesk UI shell with static seed data and no live backend or OpenAI dependency.

**Architecture:** The renderer stays a Vue 3 single-screen operational workspace. `phase4Seed.ts` owns deterministic UI seed data, and `App.vue` renders all required panels, cards, badges, empty states, expandable raw payloads, and static modal surfaces.

**Tech Stack:** Vue 3, TypeScript seed data module, Vitest source/contract tests, Vite production build.

---

### Task 1: Static UI Contract Tests

**Files:**
- Create: `frontend/src/phase4Seed.ts`
- Create: `tests/frontend/phase4StaticUi.test.ts`

- [ ] Write failing tests for required panel IDs, seed agent/event/chat data, permission/status badges, settings modal, snapshot modal, approval card, critical typed confirmation card, and raw payload disclosure.
- [ ] Run `npm test -- tests/frontend/phase4StaticUi.test.ts` and confirm failure before implementation.

### Task 2: Static Seed Model

**Files:**
- Create: `frontend/src/phase4Seed.ts`

- [ ] Implement deterministic seed data for agents, events, chat, approvals, snapshots, settings, and UI panel IDs.
- [ ] Run `npm test -- tests/frontend/phase4StaticUi.test.ts`.

### Task 3: Vue Shell

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] Replace the Phase 1 placeholder with a three-column static shell.
- [ ] Render all Phase 4 panels from `phase4Seed.ts`.
- [ ] Ensure 1280x800 and 1440x900 fit without body overflow.
- [ ] Run `npm test -- tests/frontend/phase4StaticUi.test.ts`.

### Task 4: Phase 4 Verification

**Files:**
- Modify: `package.json`

- [ ] Add `phase4:check` script.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Launch Electron and confirm no console/runtime errors.
- [ ] Stop after Phase 4 and report exit criteria.
