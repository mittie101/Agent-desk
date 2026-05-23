import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSafePathResolver } = require('../../backend/core/safe-path');
const { createBackupService } = require('../../backend/core/backup-service');
const { readFileTool } = require('../../backend/core/read-file');
const { writeFileTool } = require('../../backend/core/write-file');
const { editFileTool } = require('../../backend/core/edit-file');
const { listDirTool } = require('../../backend/core/list-dir');

const tempRoots = [];

function createVirtualFs() {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), 'agentdesk-phase3-files-'));
  tempRoots.push(workspaceRoot);
  return {
    workspaceRoot,
    resolver: createSafePathResolver({ workspaceRoot }),
    backups: createBackupService({ backupRoot: path.join(workspaceRoot, '.agentdesk-backups') })
  };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe('Phase 3 filesystem tools', () => {
  test('read, write, edit, and list tools return structured results and preserve UTF-8', () => {
    const virtualFs = createVirtualFs();

    expect(writeFileTool({ virtualFs, relativePath: 'notes\\utf8.txt', content: 'hello £ 漢字' })).toMatchObject({
      ok: true,
      tool: 'write_file'
    });
    expect(readFileTool({ virtualFs, relativePath: 'notes\\utf8.txt' })).toMatchObject({
      ok: true,
      tool: 'read_file',
      content: 'hello £ 漢字'
    });
    expect(editFileTool({ virtualFs, relativePath: 'notes\\utf8.txt', search: 'hello', replace: 'goodbye' })).toMatchObject({
      ok: true,
      tool: 'edit_file'
    });
    expect(readFileTool({ virtualFs, relativePath: 'notes\\utf8.txt' }).content).toBe('goodbye £ 漢字');
    expect(listDirTool({ virtualFs, relativePath: 'notes' })).toMatchObject({
      ok: true,
      tool: 'list_dir',
      entries: [{ name: 'utf8.txt', type: 'file' }]
    });
  });

  test('write tool prevents destructive overwrite unless explicitly allowed and backs up overwritten files', () => {
    const virtualFs = createVirtualFs();
    const target = path.join(virtualFs.workspaceRoot, 'conflict.txt');
    writeFileSync(target, 'first', 'utf8');

    expect(writeFileTool({ virtualFs, relativePath: 'conflict.txt', content: 'second' })).toMatchObject({
      ok: false,
      code: 'OVERWRITE_CONFLICT'
    });

    const overwrite = writeFileTool({
      virtualFs,
      relativePath: 'conflict.txt',
      content: 'second',
      overwrite: true
    });

    expect(overwrite).toMatchObject({ ok: true, backup: expect.any(Object) });
    expect(readFileSync(target, 'utf8')).toBe('second');
    expect(existsSync(overwrite.backup.backupPath)).toBe(true);
  });

  test('tools reject paths outside VirtualFS', () => {
    const virtualFs = createVirtualFs();
    mkdirSync(path.join(virtualFs.workspaceRoot, 'safe'));

    expect(readFileTool({ virtualFs, relativePath: '..\\outside.txt' })).toMatchObject({
      ok: false,
      code: 'PATH_TRAVERSAL'
    });
    expect(listDirTool({ virtualFs, relativePath: '\\\\server\\share' })).toMatchObject({
      ok: false,
      code: 'UNC_PATH_REJECTED'
    });
  });
});
