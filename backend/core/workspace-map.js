const { createMountManager } = require('./mount-manager');
const { errorResult, okResult } = require('./result');

function createWorkspaceMap() {
  const mounts = createMountManager();
  const workspaceToMount = new Map();

  return {
    registerWorkspace({ id, root } = {}) {
      const added = mounts.addMount({ id, root });
      if (!added.ok) {
        return added;
      }
      workspaceToMount.set(id, id);
      return okResult({ id, root: added.root });
    },

    resolveWorkspace(id) {
      const mountId = workspaceToMount.get(id);
      if (!mountId) {
        return errorResult('WORKSPACE_NOT_FOUND', 'Workspace was not found');
      }
      const mount = mounts.getMount(mountId);
      if (!mount.ok) {
        return mount;
      }
      return okResult({ id, root: mount.root });
    },

    createResolver(id) {
      const mountId = workspaceToMount.get(id);
      if (!mountId) {
        throw new Error(`Workspace not found: ${id}`);
      }
      const mount = mounts.getMount(mountId);
      if (!mount.ok) {
        throw new Error(mount.message);
      }
      return mount.resolver;
    }
  };
}

module.exports = {
  createWorkspaceMap
};
