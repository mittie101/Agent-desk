const { errorResult, okResult } = require('./result');

const BLOCKED_PATTERNS = Object.freeze([
  /\brm\s+(-[a-z]*[rf][a-z]*|\/s|\/q|--recursive|--force)/i,
  /\bremove-item\b/i,
  /\brd\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bdel\s+(\/[fsq]\s*)+/i,
  /\bformat\s+[a-z]:/i,
  /\bdiskpart\b/i,
  /\bbcdedit\b/i,
  /\breg\s+delete\b/i,
  /\btakeown\b/i,
  /\bicacls\b.*\s\/grant\b/i
]);

function normalizeCommand(command) {
  if (typeof command !== 'string') {
    return '';
  }
  return command.trim();
}

function validateCommand(command) {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return errorResult('COMMAND_EMPTY', 'Command is required');
  }
  if (normalized.length > 8192) {
    return errorResult('COMMAND_TOO_LONG', 'Command exceeds maximum length');
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return errorResult('COMMAND_BLOCKED', 'Command is blocked by policy', { command: normalized });
    }
  }

  return okResult({ command: normalized });
}

module.exports = {
  BLOCKED_PATTERNS,
  validateCommand
};
