import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSafePathResolver } = require('../../backend/core/safe-path');
const { createMountManager } = require('../../backend/core/mount-manager');
const { createWorkspaceMap } = require('../../backend/core/workspace-map');

const tempRoots = [];

function tempWorkspace() {
  const directory = mkdtempSync(path.join(tmpdir(), 'agentdesk-phase3-paths-'));
  tempRoots.push(directory);
  return directory;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Phase 3 VirtualFS path boundary', () => {
  test('rejects traversal, UNC paths, and drive switches', () => {
    const workspaceRoot = tempWorkspace();
    const resolver = createSafePathResolver({ workspaceRoot });

    expect(resolver.resolve('notes.txt')).toMatchObject({ ok: true });
    expect(resolver.resolve('..\\outside.txt')).toMatchObject({ ok: false, code: 'PATH_TRAVERSAL' });
    expect(resolver.resolve('\\\\server\\share\\file.txt')).toMatchObject({ ok: false, code: 'UNC_PATH_REJECTED' });

    const otherDrive = path.parse(workspaceRoot).root.toUpperCase().startsWith('C:') ? 'D:\\x.txt' : 'C:\\x.txt';
    expect(resolver.resolve(otherDrive)).toMatchObject({ ok: false, code: 'DRIVE_SWITCH_REJECTED' });
  });

  test('rejects symlink escapes outside the workspace', () => {
    const workspaceRoot = tempWorkspace();
    const outsideRoot = tempWorkspace();
    writeFileSync(path.join(outsideRoot, 'secret.txt'), 'do not read', 'utf8');
    symlinkSync(outsideRoot, path.join(workspaceRoot, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');

    const resolver = createSafePathResolver({ workspaceRoot });

    expect(resolver.resolve('escape\\secret.txt')).toMatchObject({ ok: false, code: 'SYMLINK_ESCAPE' });
  });

  test('mount manager and workspace map expose only validated workspace roots', () => {
    const workspaceRoot = tempWorkspace();
    const mounts = createMountManager();
    const workspaces = createWorkspaceMap();

    expect(mounts.addMount({ id: 'main', root: workspaceRoot })).toMatchObject({ ok: true });
    expect(mounts.addMount({ id: 'unc', root: '\\\\server\\share' })).toMatchObject({
      ok: false,
      code: 'UNC_PATH_REJECTED'
    });

    expect(workspaces.registerWorkspace({ id: 'agent-alice', root: workspaceRoot })).toMatchObject({ ok: true });
    expect(workspaces.resolveWorkspace('agent-alice')).toMatchObject({ ok: true, root: path.resolve(workspaceRoot) });

    mkdirSync(path.join(workspaceRoot, 'nested'));
    expect(workspaces.createResolver('agent-alice').resolve('nested')).toMatchObject({ ok: true });
  });
});
