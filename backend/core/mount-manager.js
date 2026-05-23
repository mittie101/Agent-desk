const path = require('node:path');
const { errorResult, okResult } = require('./result');
const { createSafePathResolver, hasUncPrefix } = require('./safe-path');

function createMountManager() {
  const mounts = new Map();

  return {
    addMount({ id, root } = {}) {
      if (!id || typeof id !== 'string') {
        return errorResult('MOUNT_ID_REQUIRED', 'Mount id is required');
      }
      if (!root || typeof root !== 'string') {
        return errorResult('MOUNT_ROOT_REQUIRED', 'Mount root is required');
      }
      if (hasUncPrefix(root)) {
        return errorResult('UNC_PATH_REJECTED', 'UNC mount roots are not allowed');
      }

      const resolvedRoot = path.resolve(root);
      mounts.set(id, {
        id,
        root: resolvedRoot,
        resolver: createSafePathResolver({ workspaceRoot: resolvedRoot })
      });

      return okResult({ id, root: resolvedRoot });
    },

    getMount(id) {
      const mount = mounts.get(id);
      if (!mount) {
        return errorResult('MOUNT_NOT_FOUND', 'Mount was not found');
      }
      return okResult(mount);
    },

    listMounts() {
      return Array.from(mounts.values()).map(({ id, root }) => ({ id, root }));
    }
  };
}

module.exports = {
  createMountManager
};
