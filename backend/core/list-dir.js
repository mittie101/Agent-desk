const fs = require('node:fs');
const { okResult } = require('./result');
const { resolveToolPath } = require('./file-tool-common');

function listDirTool({ virtualFs, relativePath = '.' } = {}) {
  const resolved = resolveToolPath(virtualFs, relativePath);
  if (!resolved.ok) {
    return { tool: 'list_dir', ...resolved };
  }
  if (!fs.existsSync(resolved.path)) {
    return { ok: false, tool: 'list_dir', code: 'DIRECTORY_NOT_FOUND', message: 'Directory does not exist' };
  }
  const stat = fs.statSync(resolved.path);
  if (!stat.isDirectory()) {
    return { ok: false, tool: 'list_dir', code: 'NOT_A_DIRECTORY', message: 'Path is not a directory' };
  }

  const entries = fs
    .readdirSync(resolved.path, { withFileTypes: true })
    .filter((entry) => entry.name !== '.agentdesk-backups')
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return okResult({
    tool: 'list_dir',
    path: resolved.relativePath,
    entries
  });
}

module.exports = {
  listDirTool
};
