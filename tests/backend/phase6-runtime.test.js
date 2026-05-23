import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPhase6Runtime } = require('../../backend/phase6/runtime');

const tempRoots = [];

function createWorkspaceRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'agentdesk-phase6-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Phase 6 real-runtime approval flow with injected OpenAI service', () => {
  test('creates approval from real worker plan and writes approved hello.txt through VirtualFS', async () => {
    const workspaceRoot = createWorkspaceRoot();
    const calls = [];
    const openAIService = {
      streamText: async () => {
        calls.push('stream');
        return {
          ok: true,
          text: 'I will ask alice to create hello.txt.',
          usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 }
        };
      },
      createText: async (request) => {
        calls.push('create');
        expect(request.instructions.toLowerCase()).toContain('json');
        return {
          ok: true,
          text: JSON.stringify({
            action: 'write_file',
            path: 'hello.txt',
            content: 'hello world'
          }),
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 }
        };
      }
    };
    const runtime = createPhase6Runtime({ openAIService, workspaceRoot });

    const send = await runtime.sendChat({ message: 'Tell alice to create hello.txt with hello world.' });

    expect(send).toMatchObject({
      ok: true,
      approval: { status: 'pending', actionType: 'write_file', path: 'hello.txt' }
    });
    expect(runtime.getAgents().agents[0]).toMatchObject({ name: 'alice', status: 'running' });

    const approved = runtime.approve(send.approval.id, {
      typedConfirmation: 'I understand this critical action'
    });

    expect(approved).toMatchObject({ ok: true, agent: { status: 'idle' } });
    expect(readFileSync(path.join(workspaceRoot, 'hello.txt'), 'utf8')).toBe('hello world');
    expect(runtime.getCost().cost.totalTokens).toBe(50);
    expect(runtime.getEvents().events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        'OpenAI orchestrator response streamed.',
        'Subagent proposed write_file.',
        'Approved write_file executed.',
        'Agent run completed.'
      ])
    );
    expect(calls).toEqual(['stream', 'create']);
  });

  test('worker stops at max 20 iterations and records an error event instead of crashing', async () => {
    const workspaceRoot = createWorkspaceRoot();
    const openAIService = {
      streamText: async () => ({ ok: true, text: 'loop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
      createText: async () => ({
        ok: true,
        text: JSON.stringify({ action: 'continue' }),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      })
    };
    const runtime = createPhase6Runtime({ openAIService, workspaceRoot });

    const result = await runtime.sendChat({ message: 'loop forever' });

    expect(result).toMatchObject({ ok: false, code: 'MAX_ITERATIONS_REACHED' });
    expect(runtime.getEvents().events.map((event) => event.message)).toContain('Subagent stopped after 20 iterations.');
    expect(runtime.getAgents().agents[0]).toMatchObject({ status: 'error' });
  });
});
