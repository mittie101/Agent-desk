import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createBackendChildProcessConfig,
  createBrowserWindowOptions,
  shouldBootstrapElectronMain
} = require('../../electron/main');

describe('Electron BrowserWindow security', () => {
  test('uses isolated, sandboxed renderer settings', () => {
    const options = createBrowserWindowOptions();

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    });
  });

  test('uses a preload script without enabling direct Node access', () => {
    const options = createBrowserWindowOptions();

    expect(options.webPreferences.preload).toMatch(/preload\.js$/);
    expect(options.webPreferences.enableRemoteModule).toBe(false);
  });

  test('bootstraps only inside the Electron runtime', () => {
    expect(shouldBootstrapElectronMain({ versions: { electron: '42.2.0' }, env: {} })).toBe(true);
    expect(shouldBootstrapElectronMain({ versions: {}, env: {} })).toBe(false);
    expect(shouldBootstrapElectronMain({ versions: { electron: '42.2.0' }, env: { AGENTDESK_DISABLE_BOOTSTRAP: '1' } })).toBe(false);
  });

  test('starts the development backend in a separate Node process', () => {
    const config = createBackendChildProcessConfig('C:\\projects\\agents');

    expect(config.command).toBe('node');
    expect(config.args[0]).toMatch(/backend[\\/]standalone\.js$/);
    expect(config.options.cwd).toBe('C:\\projects\\agents');
    expect(config.options.windowsHide).toBe(true);
  });
});
