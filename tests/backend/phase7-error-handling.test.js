import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createServer } = require('../../backend/server');
const { createPhase6Runtime } = require('../../backend/phase6/runtime');
const { compactContextWithOpenAI } = require('../../backend/phase6/context-compactor');

const tempRoots = [];

function tempWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'agentdesk-phase7-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Phase 7 route and runtime error handling', () => {
  test('async route failures return structured visible errors without crashing', async () => {
    const runtime = {
      webSocketManager: { attach: vi.fn() },
      sendChat: async () => {
        throw new Error('worker exploded');
      },
      getErrors: () => ({ ok: true, errors: [] })
    };
    const app = createServer({ runtime });

    await request(app)
      .post('/send_chat')
      .send({ message: 'boom' })
      .expect(500)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: false,
          code: 'RUNTIME_EXCEPTION',
          message: 'worker exploded'
        });
      });
  });

  test('empty chat input and missing OpenAI key produce visible errors and no hang', async () => {
    const runtime = createPhase6Runtime({ workspaceRoot: tempWorkspace() });
    const app = createServer({ runtime });

    await request(app)
      .post('/send_chat')
      .send({ message: '   ' })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: false, code: 'MESSAGE_REQUIRED' });
      });

    await request(app)
      .post('/send_chat')
      .send({ message: 'Try real OpenAI without a key.' })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: false, code: 'OPENAI_KEY_MISSING' });
      });

    const errors = await request(app).get('/errors').expect(200);
    expect(errors.body.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['MESSAGE_REQUIRED', 'OPENAI_KEY_MISSING']));
  });

  test('worker crash is contained and agent can be re-commanded', async () => {
    const workspaceRoot = tempWorkspace();
    let crash = true;
    const openAIService = {
      streamText: async () => ({ ok: true, text: 'stream ok', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
      createText: async () => {
        if (crash) {
          crash = false;
          throw new Error('worker crash');
        }
        return {
          ok: true,
          text: JSON.stringify({ action: 'write_file', path: 'hello.txt', content: 'hello world' }),
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
        };
      }
    };
    const runtime = createPhase6Runtime({ openAIService, workspaceRoot });

    await expect(runtime.sendChat({ message: 'first' })).resolves.toMatchObject({ ok: false, code: 'WORKER_CRASH' });
    expect(runtime.getAgents().agents[0].status).toBe('idle');

    await expect(runtime.sendChat({ message: 'second' })).resolves.toMatchObject({ ok: true });
    expect(runtime.getApprovals().approvals.some((approval) => approval.status === 'pending')).toBe(true);
  });

  test('approval timeout, path escape, protected env write, and budgets are visible failures', async () => {
    const workspaceRoot = tempWorkspace();
    const openAIService = {
      streamText: async () => ({ ok: true, text: 'stream ok', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } }),
      createText: async ({ input }) => {
        const userMessage = Array.isArray(input) ? (input[0]?.content ?? '') : String(input ?? '');
        return {
          ok: true,
          text: userMessage.includes('env')
            ? JSON.stringify({ action: 'write_file', path: '.env', content: 'SECRET=x' })
            : JSON.stringify({ action: 'write_file', path: '..\\escape.txt', content: 'bad' }),
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 }
        };
      }
    };
    const runtime = createPhase6Runtime({ openAIService, workspaceRoot, maxTotalTokens: 100 });

    const escapeRun = await runtime.sendChat({ message: 'path escape' });
    const escapeApproval = runtime.approve(escapeRun.approval.id, { typedConfirmation: 'I understand this critical action' });
    expect(escapeApproval).toMatchObject({ ok: false, code: 'PATH_TRAVERSAL' });

    const envRun = await runtime.sendChat({ message: 'env write' });
    const envApproval = runtime.approve(envRun.approval.id, { typedConfirmation: 'I understand this critical action' });
    expect(envApproval).toMatchObject({ ok: false, code: 'PROTECTED_ENV_WRITE' });

    const timeoutRun = await runtime.sendChat({ message: 'path escape' });
    expect(runtime.expireApprovals({ nowMs: Date.now() + 31 * 60 * 1000 })).toMatchObject({ expiredCount: 1 });
    expect(runtime.approve(timeoutRun.approval.id, { typedConfirmation: 'I understand this critical action' })).toMatchObject({
      ok: false,
      code: 'APPROVAL_EXPIRED'
    });

    const budgetRuntime = createPhase6Runtime({ openAIService, workspaceRoot: tempWorkspace(), maxTotalTokens: 5 });
    await expect(budgetRuntime.sendChat({ message: 'budget' })).resolves.toMatchObject({
      ok: false,
      code: 'TOKEN_BUDGET_EXCEEDED'
    });
  });

  test('compaction failure falls back to recent messages with visible warning', async () => {
    const result = await compactContextWithOpenAI({
      openAIService: {
        createText: async () => ({ ok: false, code: 'OPENAI_SERVER_ERROR', message: 'server failed' })
      },
      messages: ['a', 'b', 'c'],
      maxMessages: 1
    });

    expect(result).toMatchObject({
      ok: true,
      compacted: false,
      fallback: true,
      warning: 'Context compaction failed; using recent messages only.'
    });
    expect(result.messages).toEqual(['c']);
  });
});
