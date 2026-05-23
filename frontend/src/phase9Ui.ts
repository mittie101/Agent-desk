export function formatTokens(value: number): string {
  const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(numeric >= 10000 ? 1 : 2).replace(/\.0+$/, '')}k`;
  }
  return String(Math.round(numeric));
}

export function formatCost(value: number): string {
  const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `$${numeric.toFixed(2)}`;
}

export function eventIcon(level?: string): string {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'error') {
    return '!';
  }
  if (normalized === 'warn') {
    return '~';
  }
  if (normalized === 'debug') {
    return '#';
  }
  return 'i';
}

export function statusClass(status?: string): string {
  return `status-${String(status || 'idle').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function permissionClass(permission?: string): string {
  return `permission-${String(permission || 'standard').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function severityClass(severity?: string): string {
  return `severity-${String(severity || 'none').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
