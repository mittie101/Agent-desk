const path = require('node:path');
const fs = require('node:fs');
const { createBackupService } = require('../core/backup-service');
const { createCostTracker } = require('../core/cost-tracker');
const { errorResult, okResult } = require('../core/result');
const { createSafePathResolver } = require('../core/safe-path');
const { writeFileTool } = require('../core/write-file');
const { CRITICAL_CONFIRMATION, createApprovalManager } = require('../phase5/approval-manager');
const { createWebSocketManager } = require('../phase5/websocket-manager');
const { createSnapshotService } = require('../phase8/snapshot-service');
const { createAgentManager } = require('./agent-manager');
const { createOpenAIService } = require('./openai-service');
const { createOrchestratorService } = require('./orchestrator-service');
const { createSubagentWorker } = require('./subagent-worker');

function createInitialState(workspaceRoot) {
  const now = new Date().toISOString();
  return {
    nextEventNumber: 1,
    nextChatNumber: 3,
    nextRunNumber: 1,
    nextApprovalNumber: 1,
    agents: [
      {
        id: 'agent-alice',
        name: 'alice',
        role: 'real OpenAI worker',
        model: process.env.AGENTDESK_OPENAI_MODEL || 'gpt-4o',
        status: 'idle',
        workspaceRoot,
        updatedAt: now
      }
    ],
    events: [
      {
        id: 'evt-seed-1',
        level: 'info',
        source: 'database',
        message: 'Phase 2 seed data loaded.',
        payload: { phase: 6, seed: true },
        createdAt: now
      }
    ],
    chat: [
      { id: 'chat-1', role: 'user', content: 'Create a test agent called alice.', createdAt: now },
      { id: 'chat-2', role: 'assistant', content: 'Created alice as the Phase 2 seed agent.', createdAt: now }
    ],
    approvals: [],
    runs: [],
    snapshots: [],
    settings: {
      model: process.env.AGENTDESK_OPENAI_MODEL || 'gpt-4o',
      maxBudget: 2,
      requireTypedConfirmation: true
    }
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadStateFromDatabase(database, workspaceRoot) {
  if (!database) {
    return createInitialState(workspaceRoot);
  }

  database.runStartupRecovery?.();
  const fallback = createInitialState(workspaceRoot);
  const settingsRows = database.listAppSettings ? database.listAppSettings() : [];
  const savedSettings = settingsRows.reduce((settings, row) => {
    settings[row.key] = parseJson(row.value_json, undefined);
    return settings;
  }, {});

  const agents = database.listAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    status: agent.status,
    workspaceRoot: path.resolve(agent.workspace_path || workspaceRoot),
    updatedAt: agent.updated_at
  }));

  const events = (database.listRecentSystemLogs ? database.listRecentSystemLogs(100) : database.listSystemLogs().slice(-100))
    .map((event) => ({
      id: event.id,
      level: event.level,
      source: event.source,
      message: event.message,
      payload: parseJson(event.payload_json, {}),
      createdAt: event.created_at
    }));

  const chat = database.listOrchestratorChat().map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    payload: parseJson(message.payload_json, {}),
    createdAt: message.created_at
  }));

  const snapshots = database.listSnapshots().map((snapshot) => ({
    id: snapshot.id,
    name: snapshot.name,
    workspacePath: snapshot.workspace_path,
    fileCount: snapshot.file_count,
    byteCount: snapshot.byte_count,
    createdAt: snapshot.created_at
  }));

  return {
    ...fallback,
    nextEventNumber: Math.max(events.length + 1, fallback.nextEventNumber),
    nextChatNumber: Math.max(chat.length + 1, fallback.nextChatNumber),
    agents: agents.length > 0 ? agents : fallback.agents,
    events: events.length > 0 ? events : fallback.events,
    chat: chat.length > 0 ? chat : fallback.chat,
    snapshots,
    settings: {
      ...fallback.settings,
      ...savedSettings
    }
  };
}

function createPhase6Runtime({
  database,
  openAIService,
  workspaceRoot = path.join(process.cwd(), 'workspaces', 'alice'),
  webSocketManager = createWebSocketManager(),
  maxTotalTokens = Infinity,
  approvalTimeoutMs = 30 * 60 * 1000
} = {}) {
  fs.mkdirSync(path.resolve(workspaceRoot), { recursive: true });
  const state = loadStateFromDatabase(database, path.resolve(workspaceRoot));
  for (const agent of state.agents) {
    database?.upsertAgent?.(agent);
  }
  const primaryAgent = state.agents[0];
  if (!primaryAgent) {
    throw new Error('Runtime initialised with no agents in state');
  }
  const costTracker = createCostTracker();
  const virtualFs = {
    resolver: createSafePathResolver({ workspaceRoot: primaryAgent.workspaceRoot }),
    backups: createBackupService({ backupRoot: path.join(primaryAgent.workspaceRoot, '.agentdesk-backups') })
  };
  const visibleErrors = [];

  function recordError(code, message, details = {}) {
    const error = {
      id: `err-${visibleErrors.length + 1}`,
      code,
      message,
      details,
      createdAt: new Date().toISOString()
    };
    visibleErrors.push(error);
    emitEvent('error', 'error-boundary', message, { phase: 7, code, ...details });
    return error;
  }

  function emitEvent(level, source, message, payload = {}) {
    const event = {
      id: `evt-${state.nextEventNumber++}`,
      level,
      source,
      message,
      payload,
      createdAt: new Date().toISOString()
    };
    state.events.push(event);
    if (state.events.length > 100) {
      state.events = state.events.slice(-100);
    }
    database?.insertSystemLog?.(event);
    webSocketManager.broadcast('event', event);
    return event;
  }

  const resolvedOpenAIService =
    openAIService ||
    createOpenAIService({
      onEvent: (event) => {
        if (event.type === 'openai.invalid_key') {
          emitEvent('error', 'openai-service', 'OpenAI API key is invalid.', { phase: 6 });
        }
        if (event.type === 'openai.retry') {
          emitEvent('warn', 'openai-service', 'OpenAI request retry scheduled.', { phase: 6, ...event });
        }
      }
    });

  function addCost(usage = {}) {
    costTracker.record({
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      inputTokenCost: 0,
      outputTokenCost: 0
    });
  }

  function enforceTokenBudget() {
    const totals = getCost().cost;
    if (totals.totalTokens > maxTotalTokens) {
      recordError('TOKEN_BUDGET_EXCEEDED', 'Token budget exceeded.', {
        totalTokens: totals.totalTokens,
        maxTotalTokens
      });
      return errorResult('TOKEN_BUDGET_EXCEEDED', 'Token budget exceeded', { cost: totals, maxTotalTokens });
    }
    return okResult({ cost: totals });
  }

  const agentManager = createAgentManager(state, emitEvent);
  const approvalManager = createApprovalManager(state, emitEvent);
  const orchestrator = createOrchestratorService(resolvedOpenAIService, addCost, emitEvent);
  const worker = createSubagentWorker(resolvedOpenAIService, addCost, emitEvent);
  let chatInFlight = false;
  const snapshotService = createSnapshotService({
    workspaceRoot: primaryAgent.workspaceRoot,
    database
  });

  function snapshot() {
    return {
      agents: state.agents.map((agent) => ({ ...agent })),
      events: state.events.map((event) => ({ ...event })),
      chat: state.chat.map((message) => ({ ...message })),
      approvals: state.approvals.map((approval) => ({ ...approval })),
      snapshots: state.snapshots.map((item) => ({ ...item })),
      settings: { ...state.settings },
      cost: getCost().cost,
      errors: visibleErrors.map((error) => ({ ...error }))
    };
  }

  async function sendChat({ message } = {}) {
    if (chatInFlight) {
      return errorResult('CHAT_IN_FLIGHT', 'A chat request is already in progress');
    }
    const sanitized = typeof message === 'string' ? message.trim().slice(0, 4000) : '';
    if (!sanitized) {
      recordError('MESSAGE_REQUIRED', 'A non-empty chat message is required.');
      return errorResult('MESSAGE_REQUIRED', 'A non-empty message is required');
    }
    chatInFlight = true;
    try {

    const userMessage = {
      id: `chat-${state.nextChatNumber++}`,
      role: 'user',
      content: sanitized,
      createdAt: new Date().toISOString()
    };
    state.chat.push(userMessage);
    database?.insertChatMessage?.(userMessage);

    const run = {
      id: `run-${state.nextRunNumber++}`,
      agentName: 'alice',
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      pendingAction: null
    };
    state.runs.push(run);
    agentManager.setStatus('alice', 'running');
    database?.updateAgentStatusByName?.('alice', 'running');

    const streamed = await orchestrator.streamOrchestratorResponse({ message: sanitized, agentName: 'alice' });
    if (!streamed.ok) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      agentManager.setStatus('alice', streamed.code === 'OPENAI_KEY_MISSING' || streamed.code === 'OPENAI_INVALID_KEY' ? 'error' : 'idle');
      database?.updateAgentStatusByName?.('alice', streamed.code === 'OPENAI_KEY_MISSING' || streamed.code === 'OPENAI_INVALID_KEY' ? 'error' : 'idle');
      emitEvent('error', 'openai-service', streamed.message, { phase: 6, code: streamed.code });
      recordError(streamed.code, streamed.message);
      return streamed;
    }
    const streamedBudget = enforceTokenBudget();
    if (!streamedBudget.ok) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      agentManager.setStatus('alice', 'idle');
      return streamedBudget;
    }

    state.chat.push({
      id: `chat-${state.nextChatNumber++}`,
      role: 'assistant',
      content: streamed.text,
      createdAt: new Date().toISOString()
    });
    database?.insertChatMessage?.(state.chat[state.chat.length - 1]);

    const agent = agentManager.getAgentByName('alice');
    const action = await worker.run({ message: sanitized, agent });
    if (!action.ok) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      agentManager.setStatus('alice', action.code === 'WORKER_CRASH' || action.code === 'TOKEN_BUDGET_EXCEEDED' ? 'idle' : 'error');
      database?.updateAgentStatusByName?.('alice', action.code === 'WORKER_CRASH' || action.code === 'TOKEN_BUDGET_EXCEEDED' ? 'idle' : 'error');
      recordError(action.code, action.message);
      return action;
    }
    const actionBudget = enforceTokenBudget();
    if (!actionBudget.ok) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      agentManager.setStatus('alice', 'idle');
      database?.updateAgentStatusByName?.('alice', 'idle');
      return actionBudget;
    }

    run.status = 'waiting_for_approval';
    run.pendingAction = action.action;
    const approval = approvalManager.createWriteFileApproval({ runId: run.id, agentName: 'alice' });
    approval.path = action.action.path;
    approval.requestedPayload = { ...action.action };
    approval.expiresAt = new Date(Date.now() + approvalTimeoutMs).toISOString();
    webSocketManager.broadcast('state', snapshot());
    return okResult({ chatMessage: userMessage, run, approval });
    } finally {
      chatInFlight = false;
    }
  }

  function approve(approvalId, body) {
    expireApprovals();
    const approved = approvalManager.approve(approvalId, body);
    if (!approved.ok) {
      recordError(approved.code, approved.message, { approvalId });
      return approved;
    }
    const run = state.runs.find((candidate) => candidate.id === approved.approval.runId);
    if (!run?.pendingAction) {
      recordError('RUN_ACTION_MISSING', 'Approved run has no pending action.', { approvalId });
      return errorResult('RUN_ACTION_MISSING', 'Approved run has no pending action');
    }
    if (/^\.env($|[\\/])|(^|[\\/])\.env($|[\\/])/.test(run.pendingAction.path)) {
      run.status = 'failed';
      agentManager.setStatus(approved.approval.agentName, 'error');
      database?.updateAgentStatusByName?.(approved.approval.agentName, 'error');
      recordError('PROTECTED_ENV_WRITE', 'Protected .env writes require a later hardened approval path.', {
        path: run.pendingAction.path
      });
      return errorResult('PROTECTED_ENV_WRITE', 'Protected .env writes are blocked in Phase 7', {
        path: run.pendingAction.path
      });
    }

    const writeResult = writeFileTool({
      virtualFs,
      relativePath: run.pendingAction.path,
      content: run.pendingAction.content,
      overwrite: true
    });
    if (!writeResult.ok) {
      run.status = 'failed';
      agentManager.setStatus(approved.approval.agentName, 'error');
      database?.updateAgentStatusByName?.(approved.approval.agentName, 'error');
      emitEvent('error', 'virtual-fs', 'Approved write_file failed.', { phase: 6, writeResult });
      recordError(writeResult.code, writeResult.message, { path: run.pendingAction.path });
      return writeResult;
    }

    emitEvent('info', 'virtual-fs', 'Approved write_file executed.', {
      phase: 6,
      path: run.pendingAction.path
    });
    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    emitEvent('info', 'agent-manager', 'Agent run completed.', { phase: 6, runId: run.id });
    const agentResult = agentManager.setStatus(approved.approval.agentName, 'idle');
    database?.updateAgentStatusByName?.(approved.approval.agentName, 'idle');
    webSocketManager.broadcast('state', snapshot());
    return okResult({ approval: approved.approval, agent: agentResult.agent, run, writeResult });
  }

  function deny(approvalId, body) {
    const denied = approvalManager.deny(approvalId, body);
    if (!denied.ok) {
      return denied;
    }
    const run = state.runs.find((candidate) => candidate.id === denied.approval.runId);
    if (run) {
      run.status = 'denied';
      run.completedAt = new Date().toISOString();
    }
    agentManager.setStatus(denied.approval.agentName, 'idle');
    database?.updateAgentStatusByName?.(denied.approval.agentName, 'idle');
    return denied;
  }

  function interrupt(agentName, body) {
    return agentManager.interrupt(agentName, body);
  }

  function saveSettings(input = {}) {
    const maxBudget = Number(input.maxBudget);
    if (!Number.isFinite(maxBudget) || maxBudget < 0 || maxBudget > 1000) {
      return errorResult('SETTINGS_INVALID', 'maxBudget must be a number between 0 and 1000');
    }
    state.settings = {
      model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : state.settings.model,
      maxBudget,
      requireTypedConfirmation: input.requireTypedConfirmation === true
    };
    for (const [key, value] of Object.entries(state.settings)) {
      database?.saveAppSetting?.(key, value);
    }
    emitEvent('info', 'settings', 'Settings saved.', { phase: 6 });
    return okResult({ settings: { ...state.settings } });
  }

  function getCost() {
    const totals = costTracker.getTotals();
    return {
      ok: true,
      cost: {
        ...totals,
        totalTokens: totals.inputTokens + totals.outputTokens
      }
    };
  }

  function expireApprovals({ nowMs = Date.now() } = {}) {
    let expiredCount = 0;
    for (const approval of state.approvals) {
      if (approval.status === 'pending' && approval.expiresAt && Date.parse(approval.expiresAt) <= nowMs) {
        approval.status = 'expired';
        approval.resolvedAt = new Date(nowMs).toISOString();
        expiredCount += 1;
        const run = state.runs.find((candidate) => candidate.id === approval.runId);
        if (run && !run.completedAt) {
          run.status = 'expired';
          run.completedAt = approval.resolvedAt;
        }
        agentManager.setStatus(approval.agentName, 'idle');
        database?.updateAgentStatusByName?.(approval.agentName, 'idle');
        recordError('APPROVAL_EXPIRED', 'Approval timed out.', { approvalId: approval.id });
      }
    }
    return { ok: true, expiredCount };
  }

  return {
    CRITICAL_CONFIRMATION,
    approve,
    deny,
    expireApprovals,
    getAgents: () => okResult({ agents: snapshot().agents }),
    getApprovals: () => okResult({ approvals: snapshot().approvals }),
    getChatHistory: () => okResult({ chat: snapshot().chat }),
    getCost,
    getEvents: () => okResult({ events: snapshot().events }),
    getErrors: () => okResult({ errors: snapshot().errors }),
    getSettings: () => okResult({ settings: snapshot().settings }),
    getSnapshots: () => okResult({ snapshots: snapshotService.listSnapshots() }),
    interrupt,
    createSnapshot: (input) => {
      const result = snapshotService.createSnapshot(input);
      if (result.ok) {
        state.snapshots = snapshotService.listSnapshots();
        emitEvent('info', 'snapshot-manager', 'Snapshot created.', {
          phase: 8,
          snapshotId: result.snapshot.id,
          fileCount: result.snapshot.fileCount
        });
      } else {
        recordError(result.code, result.message);
      }
      return result;
    },
    previewSnapshotRestore: (snapshotId) => snapshotService.previewSnapshotRestore(snapshotId),
    restoreSnapshot: (snapshotId, input) => {
      const result = snapshotService.restoreSnapshot(snapshotId, input);
      if (result.ok) {
        emitEvent('info', 'snapshot-manager', 'Snapshot restored.', {
          phase: 8,
          snapshotId,
          diffCount: result.diffCount
        });
      } else {
        recordError(result.code, result.message, { snapshotId });
      }
      return result;
    },
    getFullState: () => okResult(snapshot()),
    emitEventForTest: emitEvent,
    persistChatForTest: (message) => {
      const chatMessage = {
        id: `chat-${state.nextChatNumber++}`,
        role: message.role,
        content: message.content,
        createdAt: new Date().toISOString()
      };
      state.chat.push(chatMessage);
      database?.insertChatMessage?.(chatMessage);
      return chatMessage;
    },
    setAgentStatusForTest: (agentName, status) => {
      const result = agentManager.setStatus(agentName, status);
      database?.updateAgentStatusByName?.(agentName, status);
      return result;
    },
    saveSettings,
    sendChat,
    snapshot,
    webSocketManager
  };
}

module.exports = {
  createPhase6Runtime
};
