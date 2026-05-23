# Phase 8 Persistence & Snapshots

## Scope

Implement the Phase 8 restart and snapshot requirements from `codex.md` without changing the established Electron security model.

## Architecture

- `startServer()` opens SQLite by default at `AGENTDESK_DB_PATH` or `.agentdesk/agentdesk.db`.
- `openDatabase()` remains the only SQLite boundary.
- Runtime state restores from SQLite during construction:
  - agents after startup recovery
  - chat history
  - last 100 system events by SQLite insertion order
  - settings from `app_settings`
  - snapshot metadata
- Snapshot filesystem operations live in `backend/phase8/snapshot-service.js`.
- Snapshot restore requires `CRITICAL_CONFIRMATION`.
- Restore copies only files captured in the snapshot manifest and never deletes extra workspace files.

## Failure Handling

- Snapshot manifest paths are rejected if absolute or escaping the workspace.
- Snapshot storage is validated under `.agentdesk-snapshots`.
- Restore validates SHA-256 before writing each file.
- Restore writes through a temp file followed by rename.
- Missing snapshots and missing confirmation return structured error results.

## Validation

- RED tests were added before implementation in `tests/backend/phase8-persistence-snapshots.test.js`.
- Frontend endpoint helper coverage was added in `tests/frontend/phase5Api.test.ts`.
- Final gate is `npm run phase8:check`.
