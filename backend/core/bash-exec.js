const childProcess = require('node:child_process');
const { validateCommand } = require('./command-validator');
const { okResult } = require('./result');

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;

function appendCapped(existing, chunk) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
  const remaining = MAX_OUTPUT_BYTES - existing.buffer.length;
  if (remaining <= 0) {
    return { buffer: existing.buffer, truncated: true };
  }
  if (buffer.length > remaining) {
    return {
      buffer: Buffer.concat([existing.buffer, buffer.subarray(0, remaining)]),
      truncated: true
    };
  }
  return {
    buffer: Buffer.concat([existing.buffer, buffer]),
    truncated: existing.truncated
  };
}

function shellForPlatform(command) {
  if (process.platform === 'win32') {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', command]
    };
  }
  return {
    file: 'bash',
    args: ['-lc', command]
  };
}

function bashExecTool({ command, cwd, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const validated = validateCommand(command);
  if (!validated.ok) {
    return Promise.resolve({ tool: 'bash_exec', ...validated });
  }
  if (cwd && typeof cwd !== 'string') {
    return Promise.resolve({
      ok: false,
      tool: 'bash_exec',
      code: 'CWD_INVALID',
      message: 'cwd must be a string when provided'
    });
  }

  const shell = shellForPlatform(validated.command);
  return new Promise((resolve) => {
    let stdout = { buffer: Buffer.alloc(0), truncated: false };
    let stderr = { buffer: Buffer.alloc(0), truncated: false };
    let settled = false;

    const child = childProcess.spawn(shell.file, shell.args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      resolve({
        ok: false,
        tool: 'bash_exec',
        code: 'COMMAND_TIMEOUT',
        message: 'Command timed out',
        stdout: stdout.buffer.toString('utf8'),
        stderr: stderr.buffer.toString('utf8'),
        outputTruncated: stdout.truncated || stderr.truncated
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout = appendCapped(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendCapped(stderr, chunk);
    });
    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        tool: 'bash_exec',
        code: 'SPAWN_FAILED',
        message: error.message,
        stdout: stdout.buffer.toString('utf8'),
        stderr: stderr.buffer.toString('utf8'),
        outputTruncated: stdout.truncated || stderr.truncated
      });
    });
    child.once('close', (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(okResult({
        tool: 'bash_exec',
        exitCode,
        stdout: stdout.buffer.toString('utf8'),
        stderr: stderr.buffer.toString('utf8'),
        outputTruncated: stdout.truncated || stderr.truncated
      }));
    });
  });
}

module.exports = {
  MAX_OUTPUT_BYTES,
  bashExecTool
};
