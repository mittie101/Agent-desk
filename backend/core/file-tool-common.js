const fs = require('node:fs');
const path = require('node:path');
const { errorResult } = require('./result');

function resolveToolPath(virtualFs, relativePath) {
  if (!virtualFs || !virtualFs.resolver || typeof virtualFs.resolver.resolve !== 'function') {
    return errorResult('VIRTUAL_FS_REQUIRED', 'A VirtualFS resolver is required');
  }
  return virtualFs.resolver.resolve(relativePath);
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function atomicWriteUtf8(filePath, content) {
  ensureParentDirectory(filePath);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(tempPath, filePath);
}

module.exports = {
  atomicWriteUtf8,
  ensureParentDirectory,
  resolveToolPath
};
