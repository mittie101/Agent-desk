const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { loadWindowState, persistWindowState } = require('./window-state');

// ---------------------------------------------------------------------------
// Persistent settings (encrypted API key lives here)
// ---------------------------------------------------------------------------

function getSettingsPath(app) {
  return path.join(app.getPath('userData'), 'agentdesk-settings.json');
}

function readStoredData(app) {
  try {
    const filePath = getSettingsPath(app);
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeStoredData(app, data) {
  const filePath = getSettingsPath(app);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createBrowserWindowOptions() {
  return {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#0f141b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false
    }
  };
}

function resolveRendererEntry(app) {
  if (!app.isPackaged && process.env.AGENTDESK_VITE_URL) {
    return process.env.AGENTDESK_VITE_URL;
  }

  return `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
}

async function createMainWindow(electronApp, BrowserWindow) {
  const savedState = loadWindowState(electronApp);
  const options = {
    ...createBrowserWindowOptions(),
    ...savedState
  };
  const mainWindow = new BrowserWindow(options);

  persistWindowState(electronApp, mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(resolveRendererEntry(electronApp));
  return mainWindow;
}

// ---------------------------------------------------------------------------
// Backend — dev mode (child process)
// ---------------------------------------------------------------------------

function createBackendChildProcessConfig(projectRoot = path.join(__dirname, '..')) {
  return {
    command: 'node',
    args: [path.join(projectRoot, 'backend', 'standalone.js')],
    options: {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  };
}

function waitForBackendHealth({ timeoutMs = 10000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get('http://127.0.0.1:9403/health', (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error('AgentDesk backend did not become healthy before timeout'));
        return;
      }
      setTimeout(check, intervalMs);
    };

    check();
  });
}

// ---------------------------------------------------------------------------
// Backend — packaged mode (in-process)
// ---------------------------------------------------------------------------

async function startPackagedBackend(electronApp) {
  const { safeStorage } = require('electron');
  const { loadEnvFile } = require('../backend/env-loader');
  const { startServer } = require('../backend/server');

  const userDataPath = electronApp.getPath('userData');

  // Load any .env the user placed in userData (optional, low-priority)
  loadEnvFile({ envPath: path.join(userDataPath, '.env') });

  // Decrypt and apply stored API key
  const storedData = readStoredData(electronApp);
  if (storedData.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
    try {
      process.env.OPENAI_API_KEY = safeStorage.decryptString(
        Buffer.from(storedData.encryptedApiKey, 'base64')
      );
    } catch {
      console.warn('AgentDesk: could not decrypt stored API key');
    }
  }

  const databasePath = path.join(userDataPath, '.agentdesk', 'agentdesk.db');
  const serverHandle = await startServer({ databasePath });

  return {
    process: null,
    close() {
      serverHandle.server.close();
      serverHandle.database?.close();
    }
  };
}

async function startBackendForElectron(app) {
  if (app.isPackaged) {
    return startPackagedBackend(app);
  }

  const config = createBackendChildProcessConfig(path.join(__dirname, '..'));
  const child = spawn(config.command, config.args, config.options);
  child.stdout.on('data', (chunk) => console.log(String(chunk).trim()));
  child.stderr.on('data', (chunk) => console.error(String(chunk).trim()));
  child.once('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`AgentDesk backend exited with code ${code}`);
    }
  });

  await waitForBackendHealth();

  return {
    process: child,
    close() {
      if (!child.killed) {
        child.kill();
      }
    }
  };
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(electronApp) {
  const { ipcMain, safeStorage } = require('electron');

  ipcMain.handle('agentdesk:get-api-key', async () => {
    if (!safeStorage.isEncryptionAvailable()) return '';
    const data = readStoredData(electronApp);
    if (!data.encryptedApiKey) return '';
    try {
      return safeStorage.decryptString(Buffer.from(data.encryptedApiKey, 'base64'));
    } catch {
      return '';
    }
  });

  ipcMain.handle('agentdesk:set-api-key', async (_event, key) => {
    const trimmed = String(key || '').trim();
    const data = readStoredData(electronApp);
    if (trimmed && safeStorage.isEncryptionAvailable()) {
      data.encryptedApiKey = safeStorage.encryptString(trimmed).toString('base64');
    } else {
      delete data.encryptedApiKey;
    }
    writeStoredData(electronApp, data);
    // Update env so the in-process backend (packaged) or next-request re-read picks it up
    process.env.OPENAI_API_KEY = trimmed || '';
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function shouldBootstrapElectronMain({ versions = process.versions, env = process.env } = {}) {
  return Boolean(versions.electron) && env.AGENTDESK_DISABLE_BOOTSTRAP !== '1';
}

async function bootstrap() {
  const { app, BrowserWindow } = require('electron');

  let backendHandle = null;

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    backendHandle?.close?.();
  });

  await app.whenReady();

  registerIpcHandlers(app);
  backendHandle = await startBackendForElectron(app);
  await createMainWindow(app, BrowserWindow);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow(app, BrowserWindow);
    }
  });
}

if (shouldBootstrapElectronMain()) {
  bootstrap().catch((error) => {
    console.error('AgentDesk failed to start:', error);
    const { app } = require('electron');
    app.exit(1);
  });
}

module.exports = {
  createBackendChildProcessConfig,
  createBrowserWindowOptions,
  createMainWindow,
  readStoredData,
  resolveRendererEntry,
  shouldBootstrapElectronMain,
  waitForBackendHealth,
  writeStoredData
};
