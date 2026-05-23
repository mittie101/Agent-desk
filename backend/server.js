const express = require('express');
const path = require('node:path');
const { openDatabase } = require('./database');
const { hasOpenAIKey } = require('./env-loader');
const { createPhase6Runtime } = require('./phase6/runtime');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9403;
const ALLOWED_RENDERER_ORIGINS = Object.freeze([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'null'
]);

function resolveListenOptions(overrides = {}) {
  const host = overrides.host || DEFAULT_HOST;
  const port = Number(overrides.port || DEFAULT_PORT);

  if (host !== DEFAULT_HOST) {
    throw new Error('AgentDesk backend must bind to the 127.0.0.1 loopback interface');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('AgentDesk backend port must be an integer between 1 and 65535');
  }

  return { host, port };
}

function runtimeExceptionResult(error) {
  return {
    ok: false,
    code: 'RUNTIME_EXCEPTION',
    message: error instanceof Error ? error.message : 'Runtime operation failed'
  };
}

async function sendRuntimeResult(response, resultOrPromise, successStatus = 200) {
  let result;
  try {
    result = await resultOrPromise;
  } catch (error) {
    response.status(500).json(runtimeExceptionResult(error));
    return;
  }

  if (result.ok) {
    response.status(successStatus).json(result);
    return;
  }

  const status =
    result.code === 'APPROVAL_NOT_FOUND' || result.code === 'AGENT_NOT_FOUND'
      ? 404
      : result.code === 'RUNTIME_EXCEPTION'
        ? 500
        : 400;
  response.status(status).json(result);
}

function routeResult(handler, successStatus) {
  return (request, response) => {
    sendRuntimeResult(response, handler(request), successStatus);
  };
}

function createServer({ runtime = createPhase6Runtime() } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (ALLOWED_RENDERER_ORIGINS.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    next();
  });
  app.options('*', (_request, response) => response.status(204).end());

  app.locals.phase5Runtime = runtime;

  app.get('/health', (_request, response) => {
    response.status(200).json({
      ok: true,
      service: 'agentdesk-backend',
      phase: 9,
      openaiConfigured: hasOpenAIKey()
    });
  });

  app.post('/send_chat', routeResult((request) => runtime.sendChat(request.body), 202));

  app.get('/agents', routeResult(() => runtime.getAgents()));

  app.get('/events', routeResult(() => runtime.getEvents()));

  app.get('/chat_history', routeResult(() => runtime.getChatHistory()));

  app.get('/approvals', routeResult(() => runtime.getApprovals()));

  app.post('/approve/:approvalId', routeResult((request) => runtime.approve(request.params.approvalId, request.body)));

  app.post('/deny/:approvalId', routeResult((request) => runtime.deny(request.params.approvalId, request.body)));

  app.post('/interrupt/:agentName', routeResult((request) => runtime.interrupt(request.params.agentName, request.body)));

  app.get('/snapshots', routeResult(() => runtime.getSnapshots()));

  app.post('/snapshots', routeResult((request) => runtime.createSnapshot(request.body), 201));

  app.get('/snapshots/:snapshotId/diff', routeResult((request) => runtime.previewSnapshotRestore(request.params.snapshotId)));

  app.post('/snapshots/:snapshotId/restore', routeResult((request) => runtime.restoreSnapshot(request.params.snapshotId, request.body)));

  app.get('/settings', routeResult(() => runtime.getSettings()));

  app.post('/settings', routeResult((request) => runtime.saveSettings(request.body)));

  app.get('/cost', routeResult(() => runtime.getCost()));

  app.get('/errors', routeResult(() => (runtime.getErrors ? runtime.getErrors() : { ok: true, errors: [] })));

  app.get('/state', routeResult(() => (runtime.getFullState ? runtime.getFullState() : { ok: true })));

  return app;
}

function startServer(overrides = {}) {
  const databasePath =
    overrides.databasePath ||
    process.env.AGENTDESK_DB_PATH ||
    path.join(process.cwd(), '.agentdesk', 'agentdesk.db');
  const database = overrides.runtime ? null : openDatabase({ databasePath });
  const runtime = overrides.runtime || createPhase6Runtime({ database });
  const app = createServer({ runtime });
  const listenOptions = resolveListenOptions(overrides);

  return new Promise((resolve, reject) => {
    const server = app.listen(listenOptions.port, listenOptions.host);
    runtime.webSocketManager.attach(server);

    server.once('listening', () => {
      resolve({
        app,
        server,
        runtime,
        database,
        host: listenOptions.host,
        port: listenOptions.port
      });
    });

    server.once('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  ALLOWED_RENDERER_ORIGINS,
  createServer,
  runtimeExceptionResult,
  resolveListenOptions,
  startServer
};
