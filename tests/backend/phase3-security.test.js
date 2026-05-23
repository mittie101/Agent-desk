import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTokenAuthenticator } = require('../../backend/core/token-auth');
const { validateCommand } = require('../../backend/core/command-validator');
const { classifyPathSeverity, classifyCommandSeverity } = require('../../backend/core/severity-classifier');
const { evaluatePermission } = require('../../backend/core/permission-policy');

describe('Phase 3 security primitives', () => {
  test('token authentication accepts valid tokens and rejects missing or wrong tokens', () => {
    const authenticator = createTokenAuthenticator({ token: 'phase3-secret' });

    expect(authenticator.verify('phase3-secret')).toMatchObject({ ok: true });
    expect(authenticator.verify()).toMatchObject({ ok: false, code: 'TOKEN_MISSING' });
    expect(authenticator.verify('wrong')).toMatchObject({ ok: false, code: 'TOKEN_INVALID' });
  });

  test('command validator rejects blocked commands and accepts clean commands', () => {
    expect(validateCommand('git status --short')).toMatchObject({ ok: true });
    expect(validateCommand('rm -rf C:\\Users\\hamil')).toMatchObject({ ok: false, code: 'COMMAND_BLOCKED' });
    expect(validateCommand('powershell Remove-Item -Recurse C:\\temp')).toMatchObject({
      ok: false,
      code: 'COMMAND_BLOCKED'
    });
  });

  test('severity classifier marks protected paths and destructive commands as critical', () => {
    expect(classifyPathSeverity('C:\\Windows\\System32\\drivers\\etc\\hosts')).toBe('critical');
    expect(classifyPathSeverity('workspace\\notes.txt')).toBe('low');
    expect(classifyCommandSeverity('format C:')).toBe('critical');
  });

  test('permission policy denies critical actions unless explicitly approved', () => {
    expect(evaluatePermission({ severity: 'critical', approved: false })).toMatchObject({
      ok: false,
      code: 'APPROVAL_REQUIRED'
    });
    expect(evaluatePermission({ severity: 'critical', approved: true })).toMatchObject({ ok: true });
    expect(evaluatePermission({ severity: 'low', approved: false })).toMatchObject({ ok: true });
  });
});
