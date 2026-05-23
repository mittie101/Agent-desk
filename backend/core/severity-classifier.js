const path = require('node:path');
const { BLOCKED_PATTERNS } = require('./command-validator');

const CRITICAL_PATH_PATTERNS = Object.freeze([
  /(^|\\)windows(\\|$)/i,
  /(^|\\)program files(\\|$)/i,
  /(^|\\)program files \(x86\)(\\|$)/i,
  /(^|\\)users\\[^\\]+\\appdata(\\|$)/i,
  /(^|\\)system32(\\|$)/i,
  /(^|\\)boot(\\|$)/i
]);

function toWindowsishPath(inputPath) {
  return String(inputPath || '').replace(/\//g, '\\');
}

function classifyPathSeverity(inputPath) {
  const normalized = path.win32.normalize(toWindowsishPath(inputPath)).toLowerCase();
  if (CRITICAL_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'critical';
  }
  return 'low';
}

function classifyCommandSeverity(command) {
  const text = String(command || '');
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'critical';
  }
  return 'low';
}

module.exports = {
  classifyCommandSeverity,
  classifyPathSeverity
};
