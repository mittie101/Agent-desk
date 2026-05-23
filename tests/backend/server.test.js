import { afterEach, describe, expect, test } from 'vitest';
import request from 'supertest';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createServer, resolveListenOptions } = require('../../backend/server');

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('backend server', () => {
  test('GET /health returns a deterministic ok payload', async () => {
    const app = createServer();

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: 'agentdesk-backend',
      phase: 9,
      openaiConfigured: false
    });
  });

  test('GET /health reports OpenAI configuration without exposing the key', async () => {
    process.env.OPENAI_API_KEY = 'test-secret';
    const app = createServer();

    const response = await request(app).get('/health').expect(200);

    expect(response.body.openaiConfigured).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('test-secret');
  });

  test('listen options bind only to 127.0.0.1:9403 by default', () => {
    expect(resolveListenOptions()).toEqual({
      host: '127.0.0.1',
      port: 9403
    });
  });

  test('listen options reject non-loopback host overrides', () => {
    expect(() => resolveListenOptions({ host: '0.0.0.0' })).toThrow(/loopback/i);
  });

  test('CORS allows only known renderer origins', async () => {
    const app = createServer();

    const allowed = await request(app).get('/health').set('Origin', 'null').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('null');

    const denied = await request(app).get('/health').set('Origin', 'https://example.com').expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
