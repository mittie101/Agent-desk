import { describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');
const { bashExecTool, MAX_OUTPUT_BYTES } = require('../../backend/core/bash-exec');
const { createCostTracker } = require('../../backend/core/cost-tracker');
const { createBudgetEnforcer } = require('../../backend/core/budget-enforcer');
const { compactContext } = require('../../backend/core/context-compactor');

describe('Phase 3 execution, budget, and context modules', () => {
  test('bash_exec rejects blocked commands before spawning', async () => {
    const spawnSpy = vi.spyOn(childProcess, 'spawn');

    await expect(bashExecTool({ command: 'rm -rf C:\\' })).resolves.toMatchObject({
      ok: false,
      tool: 'bash_exec',
      code: 'COMMAND_BLOCKED'
    });
    expect(spawnSpy).not.toHaveBeenCalled();

    spawnSpy.mockRestore();
  });

  test('bash_exec uses spawn and caps output at 1MB', async () => {
    const fakeProcess = new EventEmitter();
    fakeProcess.stdout = new EventEmitter();
    fakeProcess.stderr = new EventEmitter();
    fakeProcess.kill = vi.fn();

    const spawnSpy = vi.spyOn(childProcess, 'spawn').mockReturnValue(fakeProcess);
    const execution = bashExecTool({ command: 'node --version' });
    fakeProcess.stdout.emit('data', Buffer.alloc(MAX_OUTPUT_BYTES + 100, 'a'));
    fakeProcess.emit('close', 0);

    await expect(execution).resolves.toMatchObject({
      ok: true,
      tool: 'bash_exec',
      exitCode: 0,
      outputTruncated: true
    });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(spawnSpy.mock.calls[0][0]).toBe(globalThis.process.platform === 'win32' ? 'cmd.exe' : 'bash');

    spawnSpy.mockRestore();
  });

  test('cost tracker and budget enforcer are deterministic', () => {
    const tracker = createCostTracker();
    tracker.record({ inputTokens: 100, outputTokens: 50, inputTokenCost: 0.01, outputTokenCost: 0.03 });
    tracker.record({ inputTokens: 25, outputTokens: 25, inputTokenCost: 0.01, outputTokenCost: 0.03 });

    expect(tracker.getTotals()).toEqual({
      inputTokens: 125,
      outputTokens: 75,
      estimatedCost: 0.0035
    });

    const budget = createBudgetEnforcer({ maxEstimatedCost: 0.003 });
    expect(budget.check(tracker.getTotals())).toMatchObject({ ok: false, code: 'BUDGET_EXCEEDED' });
  });

  test('context compactor stub returns explicit non-AI structured output', () => {
    expect(compactContext({ messages: ['a', 'b'], maxMessages: 1 })).toEqual({
      ok: true,
      tool: 'context_compactor',
      compacted: true,
      messages: ['b']
    });
  });
});
