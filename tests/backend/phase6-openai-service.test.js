import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOpenAIService } = require('../../backend/phase6/openai-service');

function createRateLimitError() {
  const error = new Error('rate limited');
  error.status = 429;
  return error;
}

describe('Phase 6 OpenAI service', () => {
  test('emits checkpoint before streaming and accumulates streamed text and usage', async () => {
    const events = [];
    const client = {
      responses: {
        create: vi.fn(async function* () {
          yield { type: 'response.output_text.delta', delta: 'hello ' };
          yield { type: 'response.output_text.delta', delta: 'world' };
          yield {
            type: 'response.completed',
            response: { usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }
          };
        })
      }
    };
    const service = createOpenAIService({
      apiKey: 'test-key',
      client,
      onEvent: (event) => events.push(event)
    });

    const result = await service.streamText({ input: 'Say hello', model: 'gpt-test' });

    expect(result).toMatchObject({
      ok: true,
      text: 'hello world',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
    });
    expect(events[0]).toMatchObject({ type: 'openai.checkpoint', mode: 'stream' });
  });

  test('retries 429 with 5s, 10s, and 20s delays', async () => {
    const sleeps = [];
    const client = {
      responses: {
        create: vi
          .fn()
          .mockRejectedValueOnce(createRateLimitError())
          .mockRejectedValueOnce(createRateLimitError())
          .mockRejectedValueOnce(createRateLimitError())
          .mockResolvedValueOnce({
            output_text: 'done',
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
          })
      }
    };
    const service = createOpenAIService({
      apiKey: 'test-key',
      client,
      sleep: async (ms) => sleeps.push(ms)
    });

    const result = await service.createText({ input: 'retry', model: 'gpt-test' });

    expect(result.ok).toBe(true);
    expect(sleeps).toEqual([5000, 10000, 20000]);
    expect(client.responses.create).toHaveBeenCalledTimes(4);
  });

  test('maps 401 to invalid key event and surfaces 5xx errors', async () => {
    const events = [];
    const invalidKey = new Error('invalid key');
    invalidKey.status = 401;
    const serverError = new Error('server failed');
    serverError.status = 500;

    const invalidService = createOpenAIService({
      apiKey: 'bad-key',
      client: { responses: { create: vi.fn().mockRejectedValue(invalidKey) } },
      onEvent: (event) => events.push(event)
    });
    await expect(invalidService.createText({ input: 'x' })).resolves.toMatchObject({
      ok: false,
      code: 'OPENAI_INVALID_KEY'
    });
    expect(events).toContainEqual(expect.objectContaining({ type: 'openai.invalid_key' }));

    const failingService = createOpenAIService({
      apiKey: 'test-key',
      client: { responses: { create: vi.fn().mockRejectedValue(serverError) } },
      sleep: async () => {}
    });
    await expect(failingService.createText({ input: 'x' })).resolves.toMatchObject({
      ok: false,
      code: 'OPENAI_SERVER_ERROR'
    });
  });
});
