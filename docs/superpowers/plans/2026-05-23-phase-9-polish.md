# Phase 9 Polish

## Scope

Implement the Phase 9 UI completion checklist from `codex.md` without changing the backend security boundary.

## UI Contracts

- Event stream has icons, level filters, and text search.
- Agent rows show status colours, permission colours, and pending queue count.
- Settings warning appears when typed confirmation is disabled.
- Approval severity badges have stable classes.
- Critical confirmation errors trigger a short shake animation.
- Chat supports Enter to send and Shift+Enter newline through a textarea.
- Ctrl+, focuses Settings.
- First-run onboarding can be dismissed locally.
- Empty states exist for agents, events, chat, snapshots, errors.
- Cost values use compact token and currency formatting.

## Validation

- Phase 9 helper/source tests live in `tests/frontend/phase9Polish.test.ts`.
- Final gate is `npm run phase9:check`.
