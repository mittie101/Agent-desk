const fs = require('node:fs');
const path = require('node:path');
const { errorResult, okResult } = require('./result');

function hasUncPrefix(inputPath) {
  return typeof inputPath === 'string' && (inputPath.startsWith('\\\\') || inputPath.startsWith('//'));
}

function isDriveAbsolute(inputPath) {
  return /^[a-zA-Z]:[\\/]/.test(inputPath || '');
}

function ensureDirectoryPath(directoryPath) {
  if (!directoryPath || typeof directoryPath !== 'string') {
    throw new Error('workspaceRoot is required');
  }
  if (hasUncPrefix(directoryPath)) {
    throw new Error('workspaceRoot cannot be a UNC path');
  }
  return path.resolve(directoryPath);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function createSafePathResolver({ workspaceRoot } = {}) {
  const root = ensureDirectoryPath(workspaceRoot);
  const rootDrive = path.parse(root).root.toLowerCase();

  function resolve(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.trim() === '') {
      return errorResult('PATH_REQUIRED', 'Path is required');
    }
    if (hasUncPrefix(relativePath)) {
      return errorResult('UNC_PATH_REJECTED', 'UNC paths are not allowed');
    }
    if (isDriveAbsolute(relativePath)) {
      const candidateDrive = path.parse(path.resolve(relativePath)).root.toLowerCase();
      if (candidateDrive !== rootDrive) {
        return errorResult('DRIVE_SWITCH_REJECTED', 'Paths cannot switch drives');
      }
      return errorResult('ABSOLUTE_PATH_REJECTED', 'Absolute paths are not allowed');
    }
    if (path.isAbsolute(relativePath)) {
      return errorResult('ABSOLUTE_PATH_REJECTED', 'Absolute paths are not allowed');
    }

    const candidate = path.resolve(root, relativePath);
    if (!isInside(root, candidate)) {
      return errorResult('PATH_TRAVERSAL', 'Path escapes workspace root');
    }

    const nearestExisting = findNearestExistingPath(candidate, root);
    if (!nearestExisting.ok) {
      return nearestExisting;
    }

    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
    const realNearest = fs.realpathSync(nearestExisting.path);
    if (!isInside(realRoot, realNearest)) {
      return errorResult('SYMLINK_ESCAPE', 'Path resolves outside workspace root through a symlink');
    }

    return okResult({
      root,
      path: candidate,
      relativePath: path.relative(root, candidate)
    });
  }

  return {
    root,
    resolve
  };
}

function findNearestExistingPath(candidate, root) {
  let current = candidate;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      return errorResult('PATH_NOT_FOUND', 'No existing parent directory found');
    }
    if (!isInside(root, parent)) {
      return errorResult('PATH_TRAVERSAL', 'Path escapes workspace root');
    }
    current = parent;
  }
  return okResult({ path: current });
}

module.exports = {
  createSafePathResolver,
  hasUncPrefix,
  isInside
};
