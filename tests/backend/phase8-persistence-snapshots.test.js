import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../backend/database');
const { createServer } = require('../../backend/server');
const { createPhase6Runtime } = require('../../backend/phase6/runtime');

const tempRoots = [];
const openDbs = [];

function tempRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function openTempDatabase(root) {
  const db = openDatabase({ databasePath: path.join(root, 'agentdesk.db') });
  openDbs.push(db);
  return db;
}

afterEach(() => {
  while (openDbs.length > 0) {
    try {
      openDbs.pop().close();
    } catch {
      // Test cleanup must not mask the original assertion failure.
    }
  }
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Phase 8 persistence and snapshots', () => {
  test('restores chat, agents, last 100 events, settings, and resets running state after restart', () => {
    const root = tempRoot('agentdesk-phase8-db-');
    const workspaceRoot = path.join(root, 'workspace');
    const firstDb = openTempDatabase(root);
    const first = createPhase6Runtime({ database: firstDb, workspaceRoot });

    first.saveSettings({ model: 'gpt-5.4', maxBudget: 7.25, requireTypedConfirmation: false });
    for (let index = 0; index < 105; index += 1) {
      first.emitEventForTest('info', 'phase8-test', `event-${index}`, { index });
    }
    first.persistChatForTest({ role: 'user', content: 'persist me across restart' });
    first.setAgentStatusForTest('alice', 'running');
    firstDb.close();

    const secondDb = openTempDatabase(root);
    const second = createPhase6Runtime({ database: secondDb, workspaceRoot });

    expect(second.getChatHistory().chat.some((message) => message.content === 'persist me across restart')).toBe(true);
    expect(second.getAgents().agents.find((agent) => agent.name === 'alice')?.status).toBe('idle');
    expect(second.getEvents().events).toHaveLength(100);
    expect(second.getEvents().events[0].message).toBe('event-6');
    expect(second.getSettings().settings).toMatchObject({
      model: 'gpt-5.4',
      maxBudget: 7.25,
      requireTypedConfirmation: false
    });

    secondDb.close();
  });

  test('creates snapshot, previews diff count, restores captured files only, and keeps extra files', () => {
    const root = tempRoot('agentdesk-phase8-snapshot-');
    const workspaceRoot = path.join(root, 'workspace');
    const db = openTempDatabase(root);
    const runtime = createPhase6Runtime({ database: db, workspaceRoot });

    writeFileSync(path.join(workspaceRoot, 'kept.txt'), 'original', 'utf8');
    writeFileSync(path.join(workspaceRoot, 'nested.txt'), 'captured', 'utf8');

    const created = runtime.createSnapshot({ name: 'before-change' });
    expect(created).toMatchObject({ ok: true });
    expect(created.snapshot.fileCount).toBe(2);

    writeFileSync(path.join(workspaceRoot, 'kept.txt'), 'modified', 'utf8');
    writeFileSync(path.join(workspaceRoot, 'extra.txt'), 'must stay', 'utf8');

    const preview = runtime.previewSnapshotRestore(created.snapshot.id);
    expect(preview).toMatchObject({ ok: true, diffCount: 1 });

    const denied = runtime.restoreSnapshot(created.snapshot.id, { typedConfirmation: 'wrong' });
    expect(denied).toMatchObject({ ok: false, code: 'SNAPSHOT_CONFIRMATION_REQUIRED' });

    const restored = runtime.restoreSnapshot(created.snapshot.id, {
      typedConfirmation: 'I understand this critical action'
    });
    expect(restored).toMatchObject({ ok: true, diffCount: 1 });
    expect(readFileSync(path.join(workspaceRoot, 'kept.txt'), 'utf8')).toBe('original');
    expect(readFileSync(path.join(workspaceRoot, 'extra.txt'), 'utf8')).toBe('must stay');
    expect(existsSync(path.join(workspaceRoot, 'nested.txt'))).toBe(true);

    db.close();
  });

  test('snapshot routes expose create, diff, and guarded restore contracts', async () => {
    const root = tempRoot('agentdesk-phase8-routes-');
    const workspaceRoot = path.join(root, 'workspace');
    const db = openTempDatabase(root);
    const runtime = createPhase6Runtime({ database: db, workspaceRoot });
    const app = createServer({ runtime });

    writeFileSync(path.join(workspaceRoot, 'route.txt'), 'v1', 'utf8');
    const created = await request(app)
      .post('/snapshots')
      .send({ name: 'route-snapshot' })
      .expect(201);

    writeFileSync(path.join(workspaceRoot, 'route.txt'), 'v2', 'utf8');
    await request(app)
      .get(`/snapshots/${created.body.snapshot.id}/diff`)
      .expect(200)
      .expect((response) => {
        expect(response.body.diffCount).toBe(1);
      });

    await request(app)
      .post(`/snapshots/${created.body.snapshot.id}/restore`)
      .send({ typedConfirmation: 'I understand this critical action' })
      .expect(200)
      .expect((response) => {
        expect(response.body.diffCount).toBe(1);
      });

    expect(readFileSync(path.join(workspaceRoot, 'route.txt'), 'utf8')).toBe('v1');
    db.close();
  });
});
