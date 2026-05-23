# AgentDesk Phase 3 Core Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the non-AI backend core logic required by Phase 3 using hardcoded inputs and no UI dependency.

**Architecture:** Phase 3 modules live under `backend/core/` and expose small CommonJS APIs with structured results. Filesystem tools are forced through `VirtualFS`, which combines workspace mapping, safe path checks, command validation, output caps, and backup hooks before any mutation.

**Tech Stack:** Node.js CommonJS, Vitest, Windows-safe path validation, `child_process.spawn`, `fs`/`path` standard libraries.

---

### Task 1: Security and Policy Primitives

**Files:**
- Create: `backend/core/result.js`
- Create: `backend/core/token-auth.js`
- Create: `backend/core/command-validator.js`
- Create: `backend/core/severity-classifier.js`
- Create: `backend/core/permission-policy.js`
- Test: `tests/backend/phase3-security.test.js`

- [ ] Write failing tests for token validation, blocked commands, clean commands, severity classification, and permission decisions.
- [ ] Implement structured result helpers and security primitives.
- [ ] Run `npm test -- tests/backend/phase3-security.test.js`.

### Task 2: VirtualFS Path Boundary

**Files:**
- Create: `backend/core/safe-path.js`
- Create: `backend/core/mount-manager.js`
- Create: `backend/core/workspace-map.js`
- Test: `tests/backend/phase3-paths.test.js`

- [ ] Write failing tests for traversal rejection, UNC rejection, drive switch rejection, symlink escape rejection, and protected path classification.
- [ ] Implement canonical workspace resolution and mount validation.
- [ ] Run `npm test -- tests/backend/phase3-paths.test.js`.

### Task 3: Filesystem Tools

**Files:**
- Create: `backend/core/backup-service.js`
- Create: `backend/core/read-file.js`
- Create: `backend/core/write-file.js`
- Create: `backend/core/edit-file.js`
- Create: `backend/core/list-dir.js`
- Test: `tests/backend/phase3-files.test.js`

- [ ] Write failing tests for structured tool results, UTF-8 handling, atomic writes, overwrite conflict handling, backup creation, and VirtualFS enforcement.
- [ ] Implement read/write/edit/list tools using `VirtualFS` only.
- [ ] Run `npm test -- tests/backend/phase3-files.test.js`.

### Task 4: Execution, Budgets, and Context

**Files:**
- Create: `backend/core/bash-exec.js`
- Create: `backend/core/cost-tracker.js`
- Create: `backend/core/budget-enforcer.js`
- Create: `backend/core/context-compactor.js`
- Test: `tests/backend/phase3-execution.test.js`

- [ ] Write failing tests that `bash_exec` uses `spawn`, rejects blocked commands, caps output at 1MB, and returns structured results.
- [ ] Write failing tests for deterministic cost totals, budget denial, and context compactor stub behavior.
- [ ] Implement process execution and accounting modules without OpenAI calls.
- [ ] Run `npm test -- tests/backend/phase3-execution.test.js`.

### Task 5: Phase 3 Exit Verification

**Files:**
- Modify: `package.json`

- [ ] Add `phase3:check` script that runs tests and build.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run phase3:check`.
- [ ] Confirm there are no OpenAI calls in Phase 3 modules and no direct filesystem access outside VirtualFS-backed tools.
