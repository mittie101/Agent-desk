import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  criticalConfirmationPhrase,
  phase4Panels,
  phase4SeedState
} from '../../frontend/src/phase4Seed';

describe('Phase 4 static UI contract', () => {
  test('declares every required static panel', () => {
    expect(phase4Panels.map((panel) => panel.id)).toEqual([
      'app-header',
      'agent-list',
      'event-stream',
      'orchestrator-chat',
      'settings-modal',
      'snapshot-manager',
      'approval-card',
      'critical-confirmation-card'
    ]);
  });

  test('contains seed agent, seed events, seed chat, badges, and empty states', () => {
    expect(phase4SeedState.agents.map((agent) => agent.name)).toContain('alice');
    expect(phase4SeedState.events.length).toBeGreaterThanOrEqual(3);
    expect(phase4SeedState.chat.map((message) => message.content).join(' ')).toContain('Created alice');
    expect(phase4SeedState.permissionBadges).toContain('read');
    expect(phase4SeedState.statusBadges).toContain('idle');
    expect(phase4SeedState.emptyStates.snapshots).toMatch(/No snapshots/i);
  });

  test('defines settings, snapshots, approval, critical confirmation, and raw payload content', () => {
    expect(phase4SeedState.settingsModal.sections).toContain('Runtime safety');
    expect(phase4SeedState.snapshots.availableActions).toContain('Create static snapshot');
    expect(phase4SeedState.approval.title).toMatch(/Protected path/i);
    expect(criticalConfirmationPhrase).toBe('I understand this critical action');
    expect(phase4SeedState.events.some((event) => event.rawPayloadJson.includes('"phase":4'))).toBe(true);
  });

  test('App.vue renders the required shell markers without live dependencies', () => {
    const appSource = readFileSync(path.join(process.cwd(), 'frontend', 'src', 'App.vue'), 'utf8');

    for (const panel of phase4Panels) {
      expect(appSource).toContain(`data-panel="${panel.id}"`);
    }
    expect(appSource).toContain('<details');
    expect(appSource).not.toMatch(/fetch\(|XMLHttpRequest|new OpenAI|OPENAI_API_KEY/);
  });

  test('index declares a local favicon to prevent browser 404 noise', () => {
    const indexSource = readFileSync(path.join(process.cwd(), 'frontend', 'index.html'), 'utf8');

    expect(indexSource).toContain('rel="icon"');
    expect(indexSource).toContain('/favicon.svg');
  });
});
