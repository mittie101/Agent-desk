import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  openDatabase,
  REQUIRED_TABLES
} = require('../../backend/database');

const tempRoots = [];

function createTempDatabasePath() {
  const directory = mkdtempSync(path.join(tmpdir(), 'agentdesk-db-'));
  tempRoots.push(directory);
  return path.join(directory, 'agentdesk.db');
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('database initialization', () => {
  test('creates every required Phase 2 table and applies migrations once', () => {
    const databasePath = createTempDatabasePath();
    const first = openDatabase({ databasePath });
    first.close();

    const second = openDatabase({ databasePath });
    const tableNames = second
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    const migrations = second.listMigrations();

    for (const tableName of REQUIRED_TABLES) {
      expect(tableNames).toContain(tableName);
    }
    expect(migrations).toEqual([
      '001_initial.sql',
      '002_audit_timeline.sql',
      '003_snapshots.sql',
      '004_file_backups.sql',
      '005_app_settings.sql'
    ]);

    second.close();
  });

  test('enables WAL journal mode and foreign key enforcement', () => {
    const db = openDatabase({ databasePath: createTempDatabasePath() });

    expect(db.pragma('journal_mode', { simple: true }).toLowerCase()).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    db.close();
  });

  test('seeds one orchestrator, alice, three logs, and two chat messages', () => {
    const db = openDatabase({ databasePath: createTempDatabasePath() });

    expect(db.listOrchestratorAgents()).toHaveLength(1);
    expect(db.listAgents().map((agent) => agent.name)).toEqual(['alice']);
    expect(db.listAgentLogs()).toHaveLength(3);
    expect(db.listOrchestratorChat()).toHaveLength(2);

    db.close();
  });

  test('startup recovery resets running agents and running execution runs only', () => {
    const db = openDatabase({ databasePath: createTempDatabasePath() });
    const alice = db.listAgents()[0];

    db.createAgent({
      id: 'agent-running',
      orchestratorAgentId: alice.orchestrator_agent_id,
      name: 'running-agent',
      role: 'tester',
      status: 'running'
    });
    db.createExecutionRun({
      id: 'run-running',
      agentId: alice.id,
      status: 'running',
      userInstruction: 'hold state'
    });
    db.createExecutionRun({
      id: 'run-complete',
      agentId: alice.id,
      status: 'completed',
      userInstruction: 'done'
    });

    db.runStartupRecovery();

    expect(db.getAgent('agent-running').status).toBe('idle');
    expect(db.getExecutionRun('run-running').status).toBe('interrupted');
    expect(db.getExecutionRun('run-complete').status).toBe('completed');

    db.close();
  });

  test('typed query functions return every Phase 2 collection', () => {
    const db = openDatabase({ databasePath: createTempDatabasePath() });

    expect(Array.isArray(db.listOrchestratorAgents())).toBe(true);
    expect(Array.isArray(db.listAgents())).toBe(true);
    expect(Array.isArray(db.listAgentLogs())).toBe(true);
    expect(Array.isArray(db.listOrchestratorChat())).toBe(true);
    expect(Array.isArray(db.listSystemLogs())).toBe(true);
    expect(Array.isArray(db.listRecentSystemLogs(100))).toBe(true);
    expect(Array.isArray(db.listExecutionRuns())).toBe(true);
    expect(Array.isArray(db.listExecutionSteps())).toBe(true);
    expect(Array.isArray(db.listApprovalEvents())).toBe(true);
    expect(Array.isArray(db.listSnapshots())).toBe(true);
    expect(Array.isArray(db.listFileBackups())).toBe(true);
    expect(Array.isArray(db.listAppSettings())).toBe(true);

    db.close();
  });
});
