const fs = require('node:fs');
const { okResult } = require('./result');
const { atomicWriteUtf8, resolveToolPath } = require('./file-tool-common');

function editFileTool({ virtualFs, relativePath, search, replace } = {}) {
  const resolved = resolveToolPath(virtualFs, relativePath);
  if (!resolved.ok) {
    return { tool: 'edit_file', ...resolved };
  }
  if (typeof search !== 'string' || search.length === 0 || typeof replace !== 'string') {
    return { ok: false, tool: 'edit_file', code: 'INVALID_EDIT', message: 'Search and replace strings are required' };
  }
  if (!fs.existsSync(resolved.path)) {
    return { ok: false, tool: 'edit_file', code: 'FILE_NOT_FOUND', message: 'File does not exist' };
  }
  const stat = fs.statSync(resolved.path);
  if (!stat.isFile()) {
    return { ok: false, tool: 'edit_file', code: 'NOT_A_FILE', message: 'Path is not a file' };
  }

  const original = fs.readFileSync(resolved.path, 'utf8');
  if (!original.includes(search)) {
    return { ok: false, tool: 'edit_file', code: 'SEARCH_NOT_FOUND', message: 'Search text was not found' };
  }

  let backup = null;
  if (virtualFs.backups && typeof virtualFs.backups.backupFile === 'function') {
    const backupResult = virtualFs.backups.backupFile(resolved.path);
    if (!backupResult.ok) {
      return { tool: 'edit_file', ...backupResult };
    }
    backup = backupResult;
  }

  const updated = original.replace(search, replace);
  atomicWriteUtf8(resolved.path, updated);
  return okResult({
    tool: 'edit_file',
    path: resolved.relativePath,
    replacements: 1,
    backup
  });
}

module.exports = {
  editFileTool
};
