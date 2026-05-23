# AgentDesk Phase 2 Data & State Design

## Scope

Phase 2 creates the SQLite persistence foundation and renderer store shape required by `codex.md`.

This phase does not implement OpenAI calls, agent execution, WebSockets, approvals, VirtualFS, snapshots restore logic, or real UI data loading. It only establishes durable schema, migrations, typed database access, startup recovery, deterministic seed data, and a TypeScript frontend state contract that matches the schema.

## Architecture Decisions

- `backend/database.js` owns SQLite connection creation, migration execution, seed insertion, startup recovery, and typed query functions.
- Migrations live in `backend/migrations/` and are applied in lexical order inside a transaction.
- Migration state is tracked in a private `_migrations` table so each migration runs once.
- SQLite is configured with `journal_mode = WAL` and `foreign_keys = ON` on every opened database.
- Tests use temporary database files under the OS temp directory, not the production `.agentdesk` directory.
- The Phase 2 renderer store is a schema-aligned TypeScript module with static seed-shaped defaults; live API wiring waits for later phases.

## Data Model

The schema includes these required tables:

- `orchestrator_agents`
- `agents`
- `agent_logs`
- `orchestrator_chat`
- `system_logs`
- `execution_runs`
- `execution_steps`
- `approval_events`
- `snapshots`
- `file_backups`

Rows use text UUIDs, ISO timestamp strings, explicit status fields, and JSON payload fields stored as text where appropriate.

## Recovery Rules

Startup recovery is deterministic:

- `agents.status = 'running'` becomes `idle`.
- `execution_runs.status = 'running'` becomes `interrupted`.

No other statuses are rewritten.

## Validation Requirements

- Migrations run once and are idempotent.
- All required tables exist after initialization.
- WAL and foreign-key pragmas are enabled.
- Seed data contains one orchestrator, one test agent called `alice`, three agent log rows, and two orchestrator chat messages.
- Typed query functions return data from all Phase 2 tables.
- Frontend store shape exposes schema-aligned collections for every Phase 2 table.
- Phase 1 golden checks still pass.

