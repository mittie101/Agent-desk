import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadEnvFile } = require('../../backend/env-loader');

const tempRoots = [];

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'agentdesk-env-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AGENTDESK_OPENAI_MODEL;
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('backend .env loader', () => {
  test('loads backend-only OpenAI settings from a project .env file', () => {
    const root = tempRoot();
    writeFileSync(
      path.join(root, '.env'),
      'OPENAI_API_KEY="test-key"\nAGENTDESK_OPENAI_MODEL=gpt-5.4\n# comment\n',
      'utf8'
    );

    const loaded = loadEnvFile({ envPath: path.join(root, '.env'), targetEnv: process.env });

    expect(loaded).toEqual({
      loaded: true,
      keys: ['OPENAI_API_KEY', 'AGENTDESK_OPENAI_MODEL']
    });
    expect(process.env.OPENAI_API_KEY).toBe('test-key');
    expect(process.env.AGENTDESK_OPENAI_MODEL).toBe('gpt-5.4');
  });

  test('does not overwrite an already-set environment key', () => {
    const root = tempRoot();
    process.env.OPENAI_API_KEY = 'from-shell';
    writeFileSync(path.join(root, '.env'), 'OPENAI_API_KEY=from-file\n', 'utf8');

    loadEnvFile({ envPath: path.join(root, '.env'), targetEnv: process.env });

    expect(process.env.OPENAI_API_KEY).toBe('from-shell');
  });
});
