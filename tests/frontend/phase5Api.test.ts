import { describe, expect, test, vi } from 'vitest';
import {
  createSnapshot,
  criticalConfirmationPhrase,
  createPhase5InitialState,
  normalizePhase5State,
  previewSnapshotRestore,
  restoreSnapshot
} from '../../frontend/src/phase5Api';

describe('Phase 5 renderer state helpers', () => {
  test('normalizes backend payloads for the interactive fake flow', () => {
    const state = normalizePhase5State({
      agents: [{ name: 'alice', status: 'running' }],
      events: [{ id: 'evt', message: 'Mock tool result emitted.' }],
      chat: [{ id: 'chat', role: 'assistant', content: 'Created alice' }],
      approvals: [{ id: 'approval-1', status: 'pending', severity: 'critical' }],
      snapshots: [],
      settings: { model: 'stub-model', maxBudget: 1, requireTypedConfirmation: true },
      errors: [{ code: 'OPENAI_KEY_MISSING', message: 'Missing key' }],
      health: { openaiConfigured: true }
    });

    expect(state.agents[0].status).toBe('running');
    expect(state.pendingApproval?.id).toBe('approval-1');
    expect(state.settings.model).toBe('stub-model');
    expect(state.errors[0].code).toBe('OPENAI_KEY_MISSING');
    expect(state.health.openaiConfigured).toBe(true);
    expect(criticalConfirmationPhrase).toBe('I understand this critical action');
  });

  test('initial state preserves Phase 4 seed visibility before backend load', () => {
    const state = createPhase5InitialState();

    expect(state.agents.map((agent) => agent.name)).toContain('alice');
    expect(state.chat.some((message) => message.content.includes('Created alice'))).toBe(true);
    expect(state.snapshots).toEqual([]);
  });

  test('snapshot API helpers call guarded Phase 8 endpoints', async () => {
    const calls: Array<{ path: string; method?: string; body?: string }> = [];
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      calls.push({
        path: url.replace('http://127.0.0.1:9403', ''),
        method: options.method,
        body: String(options.body || '')
      });
      return {
        ok: true,
        json: async () => ({ ok: true, snapshot: { id: 'snapshot-1' }, diffCount: 2 })
      };
    });

    await createSnapshot('manual');
    await previewSnapshotRestore('snapshot-1');
    await restoreSnapshot('snapshot-1', criticalConfirmationPhrase);

    expect(calls).toEqual([
      { path: '/snapshots', method: 'POST', body: JSON.stringify({ name: 'manual' }) },
      { path: '/snapshots/snapshot-1/diff', method: undefined, body: '' },
      {
        path: '/snapshots/snapshot-1/restore',
        method: 'POST',
        body: JSON.stringify({ typedConfirmation: criticalConfirmationPhrase })
      }
    ]);
  });
});
