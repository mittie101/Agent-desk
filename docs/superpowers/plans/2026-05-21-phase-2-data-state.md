# AgentDesk Phase 2 Data & State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the SQLite schema, migrations, typed query functions, startup recovery, seed data, and frontend store shape required for Phase 2.

**Architecture:** `backend/database.js` is the single backend data boundary for Phase 2. SQL migrations define durable structure, and a schema-aligned TypeScript store defines the renderer state contract without live API wiring.

**Tech Stack:** Node.js, better-sqlite3, SQLite WAL, TypeScript, Vitest.

---

### Task 1: Database Tests

**Files:**
- Create: `tests/backend/database.test.js`

- [ ] Write failing tests for migration idempotency, required tables, WAL/foreign-key pragmas, seed data, startup recovery, and typed query functions.
- [ ] Run `npm test tests/backend/database.test.js` and confirm it fails because `backend/database.js` and migrations are missing.

### Task 2: SQLite Migrations

**Files:**
- Create: `backend/migrations/001_initial.sql`
- Create: `backend/migrations/002_audit_timeline.sql`
- Create: `backend/migrations/003_snapshots.sql`
- Create: `backend/migrations/004_file_backups.sql`

- [ ] Define all Phase 2 tables with explicit columns and foreign keys.
- [ ] Keep migrations idempotent through migration tracking in code, not by reapplying SQL blindly.

### Task 3: Database Module

**Files:**
- Create: `backend/database.js`

- [ ] Implement `openDatabase({ databasePath })`.
- [ ] Apply WAL and foreign-key pragmas.
- [ ] Run migrations in lexical order once.
- [ ] Seed one orchestrator, one agent named `alice`, three log rows, and two chat rows.
- [ ] Run startup recovery for running agents and runs.
- [ ] Expose typed query functions for every Phase 2 table.
- [ ] Run database tests and confirm they pass.

### Task 4: Frontend Store Shape

**Files:**
- Create: `frontend/src/stores/orchestratorStore.ts`
- Create: `tests/frontend/orchestratorStore.test.ts`

- [ ] Write failing tests that assert the store contains schema-aligned arrays for every Phase 2 table.
- [ ] Implement TypeScript interfaces and default state.
- [ ] Run frontend store tests and confirm they pass.

### Task 5: Phase 2 Verification

**Files:**
- Verify all created and modified files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit`.
- [ ] Confirm `/health` still returns `200`.
- [ ] Search for forbidden `child_process.exec`.
- [ ] Search for forbidden backend bind `0.0.0.0`.
- [ ] Search for premature OpenAI call sites.
- [ ] Launch Electron briefly and confirm no early crash.
- [ ] Stop after Phase 2 and report exit criteria.

