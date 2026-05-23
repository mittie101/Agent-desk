const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { errorResult, okResult } = require('./result');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createBackupService({ backupRoot } = {}) {
  if (!backupRoot || typeof backupRoot !== 'string') {
    throw new Error('backupRoot is required');
  }
  const root = path.resolve(backupRoot);
  fs.mkdirSync(root, { recursive: true });

  return {
    backupFile(originalPath) {
      if (!fs.existsSync(originalPath)) {
        return errorResult('BACKUP_SOURCE_MISSING', 'Cannot back up a missing file');
      }
      const stat = fs.statSync(originalPath);
      if (!stat.isFile()) {
        return errorResult('BACKUP_SOURCE_NOT_FILE', 'Only files can be backed up');
      }

      const hash = sha256File(originalPath);
      const backupPath = path.join(root, `${Date.now()}-${crypto.randomUUID()}-${path.basename(originalPath)}`);
      fs.copyFileSync(originalPath, backupPath, fs.constants.COPYFILE_EXCL);

      return okResult({
        originalPath,
        backupPath,
        sha256: hash,
        byteCount: stat.size
      });
    }
  };
}

module.exports = {
  createBackupService
};
