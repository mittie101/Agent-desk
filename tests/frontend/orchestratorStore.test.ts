import { describe, expect, test } from 'vitest';
import {
  createDefaultOrchestratorState,
  phase2CollectionKeys
} from '../../frontend/src/stores/orchestratorStore';

describe('orchestrator store shape', () => {
  test('exposes schema-aligned collections for every Phase 2 table', () => {
    const state = createDefaultOrchestratorState();

    expect(phase2CollectionKeys).toEqual([
      'orchestratorAgents',
      'agents',
      'agentLogs',
      'orchestratorChat',
      'systemLogs',
      'executionRuns',
      'executionSteps',
      'approvalEvents',
      'snapshots',
      'fileBackups'
    ]);

    for (const key of phase2CollectionKeys) {
      expect(Array.isArray(state[key])).toBe(true);
    }
  });

  test('defaults to seeded Phase 2 frontend state', () => {
    const state = createDefaultOrchestratorState();

    expect(state.orchestratorAgents).toHaveLength(1);
    expect(state.agents.map((agent) => agent.name)).toEqual(['alice']);
    expect(state.agentLogs).toHaveLength(3);
    expect(state.orchestratorChat).toHaveLength(2);
  });
});

