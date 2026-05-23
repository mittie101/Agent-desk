# CODEX.md — AgentDesk Build File

## Build Status
Production Build Spec v1.4 — Codex Build Locked

## Project
AgentDesk

## One-liner
A standalone Windows Electron desktop app that orchestrates multiple OpenAI-powered local execution agents through a real-time chat UI, with VirtualFS sandboxing, severity-gated approvals, SQLite persistence, immutable audit logging, worker isolation, budget limits, and workspace snapshot recovery.

---

# 0. Codex Build Rules

These rules are mandatory.

## Do Not Skip Phases

Build strictly in this order:

1. Scaffold
2. Data & State
3. Core Logic
4. Static UI
5. Stubbed End-to-End Flow
6. Real OpenAI Integration
7. Error Handling
8. Persistence & Snapshots
9. Polish
10. Distribution

Do not jump ahead.

---

## No Real OpenAI Calls Before Phase 6

Before Phase 6:

- no OpenAI SDK calls
- no real agent loops
- no real model responses
- no API billing risk

Use stubs only.

---

## No Tool Pipeline Bypass

Every agent tool call must pass through:

```text
Worker
→ tool_request
→ VirtualFS
→ permission-policy
→ safe-path
→ command-validator
→ severity-classifier
→ approval-manager
→ budget-enforcer
→ tool execution
→ structured result
→ execution_step log
→ WebSocket event
→ worker receives result

No tool may call fs, spawn, or database functions directly.

No child_process.exec

Never use:

child_process.exec

Use only:

child_process.spawn
Workers Never Touch SQLite

Workers cannot import:

better-sqlite3
electron
database.js

Workers communicate only with postMessage.

API Key Never Reaches Renderer

The renderer must never receive:

plaintext API key
decrypted API key
safeStorage output
encryption material
OpenAI client instance

All OpenAI calls happen in the main/backend process only.

Every Phase Must Pass Its Exit Criteria

At the end of each phase, Codex must stop and report:

PHASE COMPLETE: Phase X
Exit criteria passed:
- ...
Known issues:
- ...
Files changed:
- ...

Do not continue automatically into the next phase.

Golden Test After Every Phase

After every phase, run this regression check:

Open app
→ no console errors
→ no broken migrations
→ no stuck workers
→ no renderer access to secrets
→ no backend exposed beyond 127.0.0.1
→ no direct fs access outside VirtualFS
→ no use of child_process.exec
1. Product Goal

Build a working Electron desktop app where the user can:

open the app
enter an OpenAI API key
create an agent through orchestrator chat
command the agent to write a file
approve the write action
see the file appear on disk
view the execution trace in EventStream
close and reopen the app
see chat, agents, events, and settings persisted
2. Core Architecture
Stack
Layer	Choice
Desktop shell	Electron
Frontend	Vue 3 + TypeScript
Backend	Express inside Electron main process
AI provider	OpenAI Chat Completions
Orchestrator model	gpt-4o
Agent model	gpt-4o-mini
Database	SQLite via better-sqlite3
Realtime	ws WebSocket
Worker isolation	worker_threads
Shell execution	child_process.spawn only
Secret storage	electron.safeStorage
Non-secret settings	electron-store
Packaging	electron-builder + NSIS
3. Required File Structure
agentdesk/
├── package.json
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── window-state.js
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_audit_timeline.sql
│   │   ├── 003_snapshots.sql
│   │   └── 004_file_backups.sql
│   ├── virtual-fs/
│   │   ├── mount-manager.js
│   │   ├── safe-path.js
│   │   └── workspace-map.js
│   ├── security/
│   │   ├── token-auth.js
│   │   ├── command-validator.js
│   │   ├── severity-classifier.js
│   │   └── permission-policy.js
│   ├── tools/
│   │   ├── bash-exec.js
│   │   ├── read-file.js
│   │   ├── write-file.js
│   │   ├── edit-file.js
│   │   └── list-dir.js
│   ├── workers/
│   │   └── subagent-worker.js
│   ├── services/
│   │   ├── openai-service.js
│   │   ├── cost-tracker.js
│   │   ├── context-compactor.js
│   │   ├── backup-service.js
│   │   └── snapshot-service.js
│   ├── approval-manager.js
│   ├── agent-manager.js
│   ├── orchestrator-service.js
│   ├── websocket-manager.js
│   ├── budget-enforcer.js
│   └── prompts/
│       └── orchestrator-system-prompt.js
├── frontend/
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   │   ├── AppHeader.vue
│   │   │   ├── AgentList.vue
│   │   │   ├── EventStream.vue
│   │   │   ├── OrchestratorChat.vue
│   │   │   └── SnapshotManager.vue
│   │   ├── stores/
│   │   │   └── orchestratorStore.ts
│   │   └── services/
│   │       ├── api.ts
│   │       └── chatService.ts
│   └── vite.config.ts
├── build/
│   └── icon.ico
└── .agentdesk/
    ├── agentdesk.db
    ├── backups/
    ├── snapshots/
    └── logs/
4. Security Rules
Electron Window

Use:

contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
allowRunningInsecureContent: false
Backend Binding

Express must bind only to:

127.0.0.1:9403

Never:

0.0.0.0
Session Token

On app start:

crypto.randomBytes(32).toString('hex')

Use token for:

every HTTP request via X-Session-Token
WebSocket connection via query param

Reject invalid token with 403.

5. Permission Modes

Default mode: edit

Mode	read_file/list_dir	write_file/edit_file	bash_exec
safe	allowed	blocked	blocked
edit	allowed	approval by severity	blocked
execute	allowed	approval by severity	approval by severity
unrestricted	allowed	mostly auto	mostly auto, critical still typed-confirm

Unrestricted mode must show a permanent red warning banner.

6. Approval Severity
Severity	Examples	Behaviour
low	read file, list dir, create new file	auto
medium	overwrite source file, edit function body	confirm
high	bash command, install package, git commit	strong confirm
critical	delete, git push, reset hard, overwrite .env, edit .git/	typed confirmation

Critical actions require the user to type:

DELETE
PUSH
RESET
OVERWRITE

depending on action type.

7. Protected Paths

Default protected paths:

node_modules/
.git/
.env
.env.*
package-lock.json
yarn.lock
pnpm-lock.yaml
bun.lockb
*.pem
*.key
*.p12
*.pfx

Protected writes are critical.

8. Structured Tool Result Contract

Every tool returns exactly:

{
  "success": true,
  "stdout": "",
  "stderr": "",
  "duration_ms": 0,
  "files_changed": [],
  "warnings": [],
  "dry_run": false,
  "error": null
}

No arbitrary return shapes.

9. Build Phases
Phase 1 — Scaffold

Goal: Electron opens, Vue loads, Express health route works.

Tasks:

initialise npm project
install Electron, Vue, Vite, Express, ws, better-sqlite3, openai, electron-store, uuid, gpt-tokenizer, iconv-lite, jschardet
create Electron main/preload/window-state files
create Express server stub
create /health
configure Vue build with base: './'
bind backend to 127.0.0.1:9403
confirm BrowserWindow security settings

Exit criteria:

Electron window opens.
Vue renders.
GET /health returns 200.
No console errors.
Golden Test passes.

Stop after Phase 1.

Phase 2 — Data & State

Goal: SQLite schema and frontend store shape exist before logic.

Create migrations:

001_initial.sql
002_audit_timeline.sql
003_snapshots.sql
004_file_backups.sql

Tables:

orchestrator_agents
agents
agent_logs
orchestrator_chat
system_logs
execution_runs
execution_steps
approval_events
snapshots
file_backups

Database rules:

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

Startup recovery:

UPDATE agents SET status='idle' WHERE status='running';
UPDATE execution_runs SET status='interrupted' WHERE status='running';

Add typed query functions for all tables.

Add seed data:

one orchestrator
one test agent called alice
three log rows
two chat messages

Exit criteria:

All tables exist.
Migrations run once.
Seed data visible.
Frontend store shape matches schema.
Golden Test passes.

Stop after Phase 2.

Phase 3 — Core Logic Without UI

Goal: all non-AI backend logic works with hardcoded inputs.

Implement:

token-auth.js
command-validator.js
severity-classifier.js
permission-policy.js
safe-path.js
mount-manager.js
workspace-map.js
bash-exec.js
read-file.js
write-file.js
edit-file.js
list-dir.js
cost-tracker.js
backup-service.js
context-compactor.js stub
budget-enforcer.js

Mandatory tests by console/manual scripts:

token valid/missing/wrong
blocked commands rejected
clean commands accepted
path traversal rejected
UNC paths rejected
drive switch rejected
symlink escape rejected or stubbed with TODO
protected path classified critical
every tool returns structured result
bash_exec uses spawn, never exec
output capped at 1MB
UTF-8 handling applied

Exit criteria:

All core modules return expected outputs.
No OpenAI calls.
No UI dependency.
No direct fs access outside VirtualFS.
Golden Test passes.

Stop after Phase 3.

Phase 4 — Static UI Shell

Goal: full UI renders with static seed data.

Build:

AppHeader
AgentList
EventStream
OrchestratorChat
Settings Modal
Snapshot Manager
Approval Card
Critical Typed Confirmation Card

UI requirements:

3-column layout
dark theme
no overflow at 1280×800 or 1440×900
expandable raw payload in EventStream
permission badges
status badges
empty states

Exit criteria:

All panels render.
Seed agent visible.
Seed events visible.
Seed chat visible.
Settings modal renders.
Snapshot modal renders.
No console errors.
Golden Test passes.

Stop after Phase 4.

Phase 5 — Stubbed End-to-End Flow

Goal: complete interactive app flow with fake AI.

Implement:

WebSocket manager
approval manager
stub orchestrator service
stub agent manager
mock worker execution
routes:
POST /send_chat
GET /agents
GET /events
GET /chat_history
POST /approve/:approvalId
POST /deny/:approvalId
POST /interrupt/:agentName
GET /snapshots

Stub flow:

User sends chat
→ mock orchestrator streams text
→ mock agent run starts
→ mock write_file approval appears
→ user approves
→ mock tool result appears
→ run closes

Exit criteria:

Full flow works without OpenAI.
Approval card resolves.
Critical typed confirmation works.
Agent status updates.
Settings save/reload works.
Golden Test passes.

Stop after Phase 5.

Phase 6 — Real OpenAI Integration

Goal: replace stubs with real OpenAI calls.

Implement:

openai-service.js
orchestrator-service.js real streaming
subagent-worker.js real loop
agent-manager.js real worker lifecycle
context-compactor.js real summarisation

Rules:

orchestrator streams
agents do non-streaming loop
checkpoint before every OpenAI call
max 20 iterations
retry 429 with 5s, 10s, 20s
401 emits invalid key event
5xx surfaces error
all tool calls still pass pipeline

Real test:

Create agent alice.
Tell alice to create hello.txt with hello world.
Approval card appears.
Approve.
File appears on disk.
EventStream shows trace.
Cost updates.

Exit criteria:

Real orchestrator response works.
Real agent writes approved file.
Cost counter increments.
No worker crash.
Golden Test passes.

Stop after Phase 6.

Phase 7 — Error Handling

Goal: every known failure mode is handled without crash.

Manually test:

missing API key
invalid API key
429 retry
5xx error
network offline
worker crash
loop cap
token budget exceeded
runtime budget exceeded
approval timeout
path escape attempt
protected .env write
hard-blocked command
safeStorage decrypt failure
missing working directory
SQLite write failure
empty chat input
compaction failure fallback

Exit criteria:

Every failure gives a visible UI message.
No hang.
No crash.
Agent can recover or be re-commanded.
Golden Test passes.

Stop after Phase 7.

Phase 8 — Persistence & Snapshots

Goal: app survives restart and snapshots work.

Implement startup sequence:

open DB
→ run migrations
→ idle reset
→ load last session
→ mount workspaces
→ start Express
→ load frontend

Implement:

chat history restore
agents restore
last 100 events restore
settings restore
window state restore
snapshot create
snapshot restore
snapshot manager UI wiring

Snapshot restore rule:

restore captured files only
do not wipe extra files
require confirmation before restore
show diff count before restore

Exit criteria:

Close and reopen app.
Chat history visible.
Agents visible.
Events visible.
Settings retained.
Snapshot create/restore works.
Golden Test passes.

Stop after Phase 8.

Phase 9 — Polish

Goal: app feels complete.

Add:

event icons
status badge colours
live cost formatting
permission mode colours
unrestricted mode warning banner
approval severity colours
critical input shake
EventStream filters
agent queue badge
Enter to send / Shift+Enter newline
Ctrl+, opens Settings
first-run onboarding
empty states

Exit criteria:

No rough UI.
No confusing empty state.
No broken layout.
Golden Test passes.

Stop after Phase 9.

Phase 10 — Distribution

Goal: produce Windows installer.

Tasks:

configure electron-builder
NSIS installer
portable build
appId
productName
icon
better-sqlite3 native rebuild
verify packaged app
verify safeStorage in packaged app
verify DB path under user data
verify frontend dist included

Exit criteria:

npm run dist succeeds.
Installer launches app.
Portable launches app.
App can create agent and write approved file.
Golden Test passes.

Stop after Phase 10.

10. Final Acceptance Test

The project is complete only when this works:

Fresh install
→ launch AgentDesk
→ Settings opens
→ enter OpenAI key
→ choose working directory
→ save
→ ask: Create an agent called alice for Python development
→ ask: Tell alice to create hello.txt with hello world
→ approval card appears
→ approve
→ hello.txt appears on disk
→ EventStream shows full trace
→ cost updates
→ close app
→ reopen app
→ alice still visible
→ chat history still visible
→ EventStream still visible
→ file still exists
→ snapshot can be created
→ snapshot can be restored
11. Absolute Non-Negotiables

Codex must never:

use child_process.exec
let workers access SQLite
expose API key to renderer
bind backend to 0.0.0.0
call OpenAI before Phase 6
skip approval pipeline
skip VirtualFS
skip structured tool result schema
skip phase exit criteria
continue to next phase without reporting completion
12. Build Complete Definition

AgentDesk v1 is build-complete when:

all 10 phases pass
final acceptance test passes
no direct fs access exists outside VirtualFS
no exec usage exists
API key is main-process only
worker crash does not freeze app
approval flow works
protected paths are enforced
budget limits are enforced
state survives restart
packaged Windows build runs successfully