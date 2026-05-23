const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = Object.freeze({
  width: 1280,
  height: 800
});

function getStatePath(app) {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isUsableState(value) {
  return value
    && Number.isInteger(value.width)
    && Number.isInteger(value.height)
    && value.width >= 1024
    && value.height >= 720;
}

function loadWindowState(app) {
  try {
    const statePath = getStatePath(app);
    if (!fs.existsSync(statePath)) {
      return { ...DEFAULT_STATE };
    }

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!isUsableState(parsed)) {
      return { ...DEFAULT_STATE };
    }

    return {
      width: parsed.width,
      height: parsed.height,
      x: Number.isInteger(parsed.x) ? parsed.x : undefined,
      y: Number.isInteger(parsed.y) ? parsed.y : undefined
    };
  } catch (error) {
    console.warn('Ignoring invalid AgentDesk window state:', error.message);
    return { ...DEFAULT_STATE };
  }
}

function writeWindowStateAtomically(statePath, state) {
  const directory = path.dirname(statePath);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(temporaryPath, statePath);
}

function persistWindowState(app, browserWindow) {
  const save = () => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    const bounds = browserWindow.getBounds();
    if (!isUsableState(bounds)) {
      return;
    }

    try {
      writeWindowStateAtomically(getStatePath(app), bounds);
    } catch (error) {
      console.warn('Failed to persist AgentDesk window state:', error.message);
    }
  };

  browserWindow.on('close', save);
}

module.exports = {
  DEFAULT_STATE,
  getStatePath,
  loadWindowState,
  persistWindowState,
  writeWindowStateAtomically
};

