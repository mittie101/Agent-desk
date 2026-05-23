const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { errorResult, okResult } = require('../core/result');
const { isInside } = require('../core/safe-path');
const { CRITICAL_CONFIRMATION } = require('../phase5/approval-manager');

const SNAPSHOT_DIRECTORY = '.agentdesk-snapshots';
const MAX_SNAPSHOT_BYTES = 500 * 1024 * 1024;
const EXCLUDED_DIRECTORIES = new Set([SNAPSHOT_DIRECTORY, '.agentdesk-backups']);

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function ensureWorkspace(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function assertSafeRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    return errorResult('SNAPSHOT_PATH_INVALID', 'Snapshot manifest contains an empty path');
  }
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[\\/]/.test(relativePath) || relativePath.startsWith('\\\\')) {
    return errorResult('SNAPSHOT_PATH_INVALID', 'Snapshot manifest contains an absolute path');
  }
  const normalized = path.normalize(relativePath);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    return errorResult('SNAPSHOT_PATH_INVALID', 'Snapshot manifest path escapes workspace');
  }
  return okResult({ relativePath: normalized });
}

function listWorkspaceFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  visit(root);
  return files.sort();
}

function publicSnapshot(rowOrSnapshot) {
  return {
    id: rowOrSnapshot.id,
    name: rowOrSnapshot.name,
    workspacePath: rowOrSnapshot.workspacePath || rowOrSnapshot.workspace_path,
    fileCount: rowOrSnapshot.fileCount ?? rowOrSnapshot.file_count,
    byteCount: rowOrSnapshot.byteCount ?? rowOrSnapshot.byte_count,
    createdAt: rowOrSnapshot.createdAt || rowOrSnapshot.created_at
  };
}

function parseSnapshotRow(row) {
  if (!row) {
    return null;
  }
  let manifest = {};
  try {
    manifest = JSON.parse(row.manifest_json || '{}');
  } catch {
    manifest = {};
  }
  return {
    id: row.id,
    name: row.name,
    workspacePath: row.workspace_path,
    manifest,
    fileCount: row.file_count,
    byteCount: row.byte_count,
    createdAt: row.created_at
  };
}

function createSnapshotService({ workspaceRoot, database } = {}) {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new Error('workspaceRoot is required');
  }

  const root = ensureWorkspace(workspaceRoot);
  const snapshotRoot = path.join(root, SNAPSHOT_DIRECTORY);
  fs.mkdirSync(snapshotRoot, { recursive: true });

  function listSnapshots() {
    if (!database?.listSnapshots) {
      return [];
    }
    return database.listSnapshots().map(publicSnapshot);
  }

  function getSnapshot(id) {
    if (!database?.listSnapshots) {
      return null;
    }
    return parseSnapshotRow(database.listSnapshots().find((snapshot) => snapshot.id === id));
  }

  function createSnapshot({ name } = {}) {
    const trimmedName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : 'Workspace snapshot';
    const id = `snapshot-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const directory = path.join(snapshotRoot, id);
    fs.mkdirSync(directory, { recursive: true });

    const files = [];
    let byteCount = 0;
    for (const sourcePath of listWorkspaceFiles(root)) {
      const relativePath = path.relative(root, sourcePath);
      const safe = assertSafeRelativePath(relativePath);
      if (!safe.ok) {
        return safe;
      }
      const buffer = fs.readFileSync(sourcePath);
      byteCount += buffer.byteLength;
      if (byteCount > MAX_SNAPSHOT_BYTES) {
        return errorResult('SNAPSHOT_TOO_LARGE', `Snapshot exceeds the ${MAX_SNAPSHOT_BYTES / (1024 * 1024)} MB size limit`);
      }
      const destinationPath = path.join(directory, safe.relativePath);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.writeFileSync(destinationPath, buffer, { flag: 'wx' });
      files.push({
        relativePath: safe.relativePath,
        sha256: sha256Buffer(buffer),
        byteCount: buffer.byteLength
      });
    }

    const snapshot = {
      id,
      name: trimmedName,
      workspacePath: root,
      manifest: {
        version: 1,
        storagePath: directory,
        files
      },
      fileCount: files.length,
      byteCount,
      createdAt
    };

    if (database?.saveSnapshot) {
      database.saveSnapshot(snapshot);
    }

    return okResult({ snapshot: publicSnapshot(snapshot) });
  }

  function previewSnapshotRestore(id) {
    const snapshot = getSnapshot(id);
    if (!snapshot) {
      return errorResult('SNAPSHOT_NOT_FOUND', 'Snapshot was not found');
    }

    let diffCount = 0;
    const files = Array.isArray(snapshot.manifest.files) ? snapshot.manifest.files : [];
    for (const file of files) {
      const safe = assertSafeRelativePath(file.relativePath);
      if (!safe.ok) {
        return safe;
      }
      const targetPath = path.resolve(root, safe.relativePath);
      if (!isInside(root, targetPath)) {
        return errorResult('SNAPSHOT_PATH_INVALID', 'Snapshot restore target escapes workspace');
      }
      if (!fs.existsSync(targetPath) || sha256File(targetPath) !== file.sha256) {
        diffCount += 1;
      }
    }

    return okResult({ snapshot: publicSnapshot(snapshot), diffCount });
  }

  function restoreSnapshot(id, { typedConfirmation } = {}) {
    if (typedConfirmation !== CRITICAL_CONFIRMATION) {
      return errorResult('SNAPSHOT_CONFIRMATION_REQUIRED', 'Snapshot restore requires typed confirmation');
    }

    const snapshot = getSnapshot(id);
    if (!snapshot) {
      return errorResult('SNAPSHOT_NOT_FOUND', 'Snapshot was not found');
    }
    const preview = previewSnapshotRestore(id);
    if (!preview.ok) {
      return preview;
    }

    const storagePath = path.resolve(snapshot.manifest.storagePath || '');
    if (!isInside(snapshotRoot, storagePath)) {
      return errorResult('SNAPSHOT_STORAGE_INVALID', 'Snapshot storage path is invalid');
    }

    const files = Array.isArray(snapshot.manifest.files) ? snapshot.manifest.files : [];
    for (const file of files) {
      const safe = assertSafeRelativePath(file.relativePath);
      if (!safe.ok) {
        return safe;
      }
      const sourcePath = path.resolve(storagePath, safe.relativePath);
      const targetPath = path.resolve(root, safe.relativePath);
      if (!isInside(storagePath, sourcePath) || !isInside(root, targetPath)) {
        return errorResult('SNAPSHOT_PATH_INVALID', 'Snapshot restore path escapes trusted root');
      }
      if (!fs.existsSync(sourcePath) || sha256File(sourcePath) !== file.sha256) {
        return errorResult('SNAPSHOT_CORRUPT', 'Snapshot content failed integrity validation');
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const tempPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.copyFileSync(sourcePath, tempPath, fs.constants.COPYFILE_EXCL);
      fs.renameSync(tempPath, targetPath);
    }

    return okResult({ snapshot: publicSnapshot(snapshot), diffCount: preview.diffCount });
  }

  return {
    createSnapshot,
    listSnapshots,
    previewSnapshotRestore,
    restoreSnapshot
  };
}

module.exports = {
  SNAPSHOT_DIRECTORY,
  createSnapshotService,
  publicSnapshot
};
