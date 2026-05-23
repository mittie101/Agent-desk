const fs = require('node:fs');
const { okResult } = require('./result');
const { resolveToolPath } = require('./file-tool-common');

function readFileTool({ virtualFs, relativePath } = {}) {
  const resolved = resolveToolPath(virtualFs, relativePath);
  if (!resolved.ok) {
    return { tool: 'read_file', ...resolved };
  }
  if (!fs.existsSync(resolved.path)) {
    return { ok: false, tool: 'read_file', code: 'FILE_NOT_FOUND', message: 'File does not exist' };
  }
  const stat = fs.statSync(resolved.path);
  if (!stat.isFile()) {
    return { ok: false, tool: 'read_file', code: 'NOT_A_FILE', message: 'Path is not a file' };
  }
  return okResult({
    tool: 'read_file',
    path: resolved.relativePath,
    content: fs.readFileSync(resolved.path, 'utf8')
  });
}

module.exports = {
  readFileTool
};
