const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const REQUIRED_TABLES = Object.freeze([
  'orchestrator_agents',
  'agents',
  'agent_logs',
  'orchestrator_chat',
  'system_logs',
  'execution_runs',
  'execution_steps',
  'approval_events',
  'snapshots',
  'file_backups',
  'app_settings'
]);

const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');

function nowIso() {
  return new Date().toISOString();
}

function ensureDatabaseDirectory(databasePath) {
  const directory = path.dirname(databasePath);
  fs.mkdirSync(directory, { recursive: true });
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
    .sort();
}

function applyPragmas(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function runMigrations(db) {
  ensureMigrationTable(db);

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations ORDER BY filename').all().map((row) => row.filename)
  );
  const insertMigration = db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)');

  for (const fileName of listMigrationFiles()) {
    if (applied.has(fileName)) {
      continue;
    }

    const migrationSql = fs.readFileSync(path.join(MIGRATIONS_DIRECTORY, fileName), 'utf8');
    const runOne = db.transaction(() => {
      db.exec(migrationSql);
      insertMigration.run(fileName, nowIso());
    });
    runOne();
  }
}

function runStartupRecovery(db) {
  const timestamp = nowIso();
  db.prepare("UPDATE agents SET status = 'idle', updated_at = ? WHERE status IN ('running', 'error')").run(timestamp);
  db.prepare("UPDATE execution_runs SET status = 'interrupted', updated_at = ? WHERE status = 'running'").run(timestamp);
}

function seedDatabase(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM orchestrator_agents').get().count;
  if (count > 0) {
    return;
  }

  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO orchestrator_agents (id, name, model, status, system_prompt, created_at, updated_at)
    VALUES (@id, @name, @model, @status, @system_prompt, @created_at, @updated_at)
  `).run({
    id: 'orchestrator-default',
    name: 'orchestrator',
    model: 'gpt-4o',
    status: 'idle',
    system_prompt: 'AgentDesk orchestrator seed record for Phase 2.',
    created_at: timestamp,
    updated_at: timestamp
  });

  db.prepare(`
    INSERT INTO agents (
      id, orchestrator_agent_id, name, role, status, model, workspace_path, created_at, updated_at
    )
    VALUES (
      @id, @orchestrator_agent_id, @name, @role, @status, @model, @workspace_path, @created_at, @updated_at
    )
  `).run({
    id: 'agent-alice',
    orchestrator_agent_id: 'orchestrator-default',
    name: 'alice',
    role: 'test agent',
    status: 'idle',
    model: 'gpt-4o-mini',
    workspace_path: null,
    created_at: timestamp,
    updated_at: timestamp
  });

  const insertLog = db.prepare(`
    INSERT INTO agent_logs (id, agent_id, level, message, payload_json, created_at)
    VALUES (@id, @agent_id, @level, @message, @payload_json, @created_at)
  `);
  for (const row of [
    ['agent-log-1', 'info', 'Agent alice created.'],
    ['agent-log-2', 'info', 'Agent alice waiting for instruction.'],
    ['agent-log-3', 'debug', 'Phase 2 seed log.']
  ]) {
    insertLog.run({
      id: row[0],
      agent_id: 'agent-alice',
      level: row[1],
      message: row[2],
      payload_json: '{}',
      created_at: timestamp
    });
  }

  const insertChat = db.prepare(`
    INSERT INTO orchestrator_chat (id, role, content, payload_json, created_at)
    VALUES (@id, @role, @content, @payload_json, @created_at)
  `);
  insertChat.run({
    id: 'chat-seed-1',
    role: 'user',
    content: 'Create a test agent called alice.',
    payload_json: '{}',
    created_at: timestamp
  });
  insertChat.run({
    id: 'chat-seed-2',
    role: 'assistant',
    content: 'Created alice as the Phase 2 seed agent.',
    payload_json: '{}',
    created_at: timestamp
  });
}

function attachQueries(db) {
  db.listMigrations = () => db.prepare('SELECT filename FROM _migrations ORDER BY filename').all().map((row) => row.filename);
  db.listOrchestratorAgents = () => db.prepare('SELECT * FROM orchestrator_agents ORDER BY created_at, id').all();
  db.listAgents = () => db.prepare('SELECT * FROM agents ORDER BY created_at, id').all();
  db.getAgent = (id) => db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  db.listAgentLogs = () => db.prepare('SELECT * FROM agent_logs ORDER BY created_at, id').all();
  db.listOrchestratorChat = () => db.prepare('SELECT * FROM orchestrator_chat ORDER BY created_at, id').all();
  db.listSystemLogs = () => db.prepare('SELECT * FROM system_logs ORDER BY created_at, id').all();
  db.listRecentSystemLogs = (limit = 100) =>
    db
      .prepare('SELECT * FROM (SELECT rowid, * FROM system_logs ORDER BY rowid DESC LIMIT ?) ORDER BY rowid ASC')
      .all(limit);
  db.listExecutionRuns = () => db.prepare('SELECT * FROM execution_runs ORDER BY created_at, id').all();
  db.getExecutionRun = (id) => db.prepare('SELECT * FROM execution_runs WHERE id = ?').get(id);
  db.listExecutionSteps = () => db.prepare('SELECT * FROM execution_steps ORDER BY created_at, id').all();
  db.listApprovalEvents = () => db.prepare('SELECT * FROM approval_events ORDER BY created_at, id').all();
  db.listSnapshots = () => db.prepare('SELECT * FROM snapshots ORDER BY created_at, id').all();
  db.listFileBackups = () => db.prepare('SELECT * FROM file_backups ORDER BY created_at, id').all();
  db.listAppSettings = () => db.prepare('SELECT * FROM app_settings ORDER BY key').all();
  db.runStartupRecovery = () => runStartupRecovery(db);

  db.createAgent = (agent) => {
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO agents (
        id, orchestrator_agent_id, name, role, status, model, workspace_path, created_at, updated_at
      )
      VALUES (
        @id, @orchestrator_agent_id, @name, @role, @status, @model, @workspace_path, @created_at, @updated_at
      )
    `).run({
      id: agent.id,
      orchestrator_agent_id: agent.orchestratorAgentId,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      model: agent.model || 'gpt-4o-mini',
      workspace_path: agent.workspacePath || null,
      created_at: timestamp,
      updated_at: timestamp
    });
  };

  db.createExecutionRun = (run) => {
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO execution_runs (
        id, agent_id, status, user_instruction, started_at, completed_at, created_at, updated_at
      )
      VALUES (
        @id, @agent_id, @status, @user_instruction, @started_at, @completed_at, @created_at, @updated_at
      )
    `).run({
      id: run.id,
      agent_id: run.agentId,
      status: run.status,
      user_instruction: run.userInstruction,
      started_at: run.startedAt || null,
      completed_at: run.completedAt || null,
      created_at: timestamp,
      updated_at: timestamp
    });
  };

  db.upsertAgent = (agent) => {
    const timestamp = agent.updatedAt || nowIso();
    db.prepare(`
      INSERT INTO agents (
        id, orchestrator_agent_id, name, role, status, model, workspace_path, created_at, updated_at
      )
      VALUES (
        @id, @orchestrator_agent_id, @name, @role, @status, @model, @workspace_path, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        status = excluded.status,
        model = excluded.model,
        workspace_path = excluded.workspace_path,
        updated_at = excluded.updated_at
    `).run({
      id: agent.id,
      orchestrator_agent_id: agent.orchestratorAgentId || agent.orchestrator_agent_id || 'orchestrator-default',
      name: agent.name,
      role: agent.role || '',
      status: agent.status,
      model: agent.model || 'gpt-4o-mini',
      workspace_path: agent.workspaceRoot || agent.workspacePath || agent.workspace_path || null,
      created_at: agent.createdAt || timestamp,
      updated_at: timestamp
    });
  };

  db.updateAgentStatusByName = (name, status) => {
    db.prepare('UPDATE agents SET status = ?, updated_at = ? WHERE name = ?').run(status, nowIso(), name);
  };

  db.insertChatMessage = (message) => {
    db.prepare(`
      INSERT OR IGNORE INTO orchestrator_chat (id, role, content, payload_json, created_at)
      VALUES (@id, @role, @content, @payload_json, @created_at)
    `).run({
      id: message.id,
      role: message.role,
      content: message.content,
      payload_json: JSON.stringify(message.payload || {}),
      created_at: message.createdAt || nowIso()
    });
  };

  db.insertSystemLog = (event) => {
    db.prepare(`
      INSERT OR IGNORE INTO system_logs (id, level, source, message, payload_json, created_at)
      VALUES (@id, @level, @source, @message, @payload_json, @created_at)
    `).run({
      id: event.id,
      level: event.level,
      source: event.source,
      message: event.message,
      payload_json: JSON.stringify(event.payload || {}),
      created_at: event.createdAt || nowIso()
    });
  };

  db.saveAppSetting = (key, value) => {
    db.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), nowIso());
  };

  db.saveSnapshot = (snapshot) => {
    db.prepare(`
      INSERT INTO snapshots (id, name, workspace_path, manifest_json, file_count, byte_count, created_at)
      VALUES (@id, @name, @workspace_path, @manifest_json, @file_count, @byte_count, @created_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        manifest_json = excluded.manifest_json,
        file_count = excluded.file_count,
        byte_count = excluded.byte_count
    `).run({
      id: snapshot.id,
      name: snapshot.name,
      workspace_path: snapshot.workspacePath,
      manifest_json: JSON.stringify(snapshot.manifest || {}),
      file_count: snapshot.fileCount,
      byte_count: snapshot.byteCount,
      created_at: snapshot.createdAt || nowIso()
    });
  };

  return db;
}

function openDatabase({ databasePath } = {}) {
  if (!databasePath || typeof databasePath !== 'string') {
    throw new Error('databasePath is required');
  }

  ensureDatabaseDirectory(databasePath);
  const db = new Database(databasePath);

  applyPragmas(db);
  runMigrations(db);
  seedDatabase(db);
  runStartupRecovery(db);

  return attachQueries(db);
}

module.exports = {
  REQUIRED_TABLES,
  openDatabase
};
