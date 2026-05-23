const fs = require('node:fs');
const { okResult } = require('./result');
const { atomicWriteUtf8, resolveToolPath } = require('./file-tool-common');

function writeFileTool({ virtualFs, relativePath, content, overwrite = false } = {}) {
  const resolved = resolveToolPath(virtualFs, relativePath);
  if (!resolved.ok) {
    return { tool: 'write_file', ...resolved };
  }
  if (typeof content !== 'string') {
    return { ok: false, tool: 'write_file', code: 'CONTENT_REQUIRED', message: 'String content is required' };
  }

  let backup = null;
  if (fs.existsSync(resolved.path)) {
    const stat = fs.statSync(resolved.path);
    if (!stat.isFile()) {
      return { ok: false, tool: 'write_file', code: 'NOT_A_FILE', message: 'Path is not a file' };
    }
    if (!overwrite) {
      return { ok: false, tool: 'write_file', code: 'OVERWRITE_CONFLICT', message: 'File already exists' };
    }
    if (virtualFs.backups && typeof virtualFs.backups.backupFile === 'function') {
      const backupResult = virtualFs.backups.backupFile(resolved.path);
      if (!backupResult.ok) {
        return { tool: 'write_file', ...backupResult };
      }
      backup = backupResult;
    }
  }

  atomicWriteUtf8(resolved.path, content);
  return okResult({
    tool: 'write_file',
    path: resolved.relativePath,
    bytesWritten: Buffer.byteLength(content, 'utf8'),
    backup
  });
}

module.exports = {
  writeFileTool
};
