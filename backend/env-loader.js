const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_ENV_KEYS = Object.freeze(['OPENAI_API_KEY', 'AGENTDESK_OPENAI_MODEL', 'OPENAI_BASE_URL']);

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return null;
  }
  const key = trimmed.slice(0, separator).trim();
  const value = stripQuotes(trimmed.slice(separator + 1));
  return { key, value };
}

function loadEnvFile({ envPath = path.join(process.cwd(), '.env'), targetEnv = process.env } = {}) {
  if (!fs.existsSync(envPath)) {
    return { loaded: false, keys: [] };
  }

  const loadedKeys = [];
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || !ALLOWED_ENV_KEYS.includes(parsed.key)) {
      continue;
    }
    if (targetEnv[parsed.key]) {
      continue;
    }
    targetEnv[parsed.key] = parsed.value;
    loadedKeys.push(parsed.key);
  }

  return { loaded: true, keys: loadedKeys };
}

function hasOpenAIKey(env = process.env) {
  return typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.trim().length > 0;
}

module.exports = {
  ALLOWED_ENV_KEYS,
  hasOpenAIKey,
  loadEnvFile,
  parseEnvLine
};
