import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  eventIcon,
  formatCost,
  formatTokens,
  permissionClass,
  severityClass,
  statusClass
} from '../../frontend/src/phase9Ui';

describe('Phase 9 UI polish contracts', () => {
  test('formats live cost and token totals for compact scanning', () => {
    expect(formatTokens(15320)).toBe('15.3k');
    expect(formatTokens(42)).toBe('42');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(1.234)).toBe('$1.23');
  });

  test('maps event icons, statuses, permissions, and severities to stable classes', () => {
    expect(eventIcon('error')).toBe('!');
    expect(statusClass('running')).toBe('status-running');
    expect(permissionClass('unrestricted')).toBe('permission-unrestricted');
    expect(severityClass('critical')).toBe('severity-critical');
  });

  test('App.vue exposes Phase 9 polish affordances', () => {
    const appSource = readFileSync(path.join(process.cwd(), 'frontend', 'src', 'App.vue'), 'utf8');

    expect(appSource).toContain('data-panel="first-run-onboarding"');
    expect(appSource).toContain('data-panel="unrestricted-warning"');
    expect(appSource).toContain('data-panel="openai-ready-toast"');
    expect(appSource).toContain('state.health = nextState.health');
    expect(appSource).toContain('data-action="event-filter"');
    expect(appSource).toContain('data-badge="agent-queue"');
    expect(appSource).toContain('@keydown.enter.exact.prevent');
    expect(appSource).toContain('event.ctrlKey && event.key ===');
    expect(appSource).toContain('critical-shake');
  });
});
