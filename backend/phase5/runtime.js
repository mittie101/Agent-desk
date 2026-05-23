const { errorResult, okResult } = require('../core/result');
const { CRITICAL_CONFIRMATION, createApprovalManager } = require('./approval-manager');
const { createAgentManager } = require('./agent-manager');
const { createMockWorker } = require('./mock-worker');
const { createOrchestratorService } = require('./orchestrator-service');
const { createWebSocketManager } = require('./websocket-manager');

function createInitialState() {
  return {
    nextEventNumber: 1,
    nextChatNumber: 3,
    nextRunNumber: 1,
    nextApprovalNumber: 1,
    agents: [
      {
        id: 'agent-alice',
        name: 'alice',
        role: 'test agent',
        model: 'gpt-4o-mini',
        status: 'idle',
        updatedAt: new Date().toISOString()
      }
    ],
    events: [
      {
        id: 'evt-seed-1',
        level: 'info',
        source: 'database',
        message: 'Phase 2 seed data loaded.',
        payload: { phase: 5, seed: true },
        createdAt: new Date().toISOString()
      }
    ],
    chat: [
      {
        id: 'chat-1',
        role: 'user',
        content: 'Create a test agent called alice.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'chat-2',
        role: 'assistant',
        content: 'Created alice as the Phase 2 seed agent.',
        createdAt: new Date().toISOString()
      }
    ],
    approvals: [],
    runs: [],
    toolResults: [],
    snapshots: [],
    settings: {
      model: 'stub-orchestrator',
      maxBudget: 0.5,
      requireTypedConfirmation: true
    }
  };
}

function sanitizeMessage(message) {
  if (typeof message !== 'string') {
    return '';
  }
  return message.trim().slice(0, 4000);
}

function createPhase5Runtime({ webSocketManager = createWebSocketManager() } = {}) {
  const state = createInitialState();

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
    webSocketManager.broadcast('event', event);
    return event;
  }

  const agentManager = createAgentManager(state, emitEvent);
  const approvalManager = createApprovalManager(state, emitEvent);
  const mockWorker = createMockWorker(state, emitEvent);
  const orchestrator = createOrchestratorService(state, emitEvent, agentManager, approvalManager);

  function snapshot() {
    return {
      agents: state.agents.map((agent) => ({ ...agent })),
      events: state.events.map((event) => ({ ...event })),
      chat: state.chat.map((message) => ({ ...message })),
      approvals: state.approvals.map((approval) => ({ ...approval })),
      snapshots: state.snapshots.map((item) => ({ ...item })),
      settings: { ...state.settings }
    };
  }

  function sendChat({ message } = {}) {
    const sanitized = sanitizeMessage(message);
    if (!sanitized) {
      return errorResult('MESSAGE_REQUIRED', 'A non-empty message is required');
    }
    const result = orchestrator.sendChat(sanitized);
    webSocketManager.broadcast('state', snapshot());
    return result;
  }

  function approve(approvalId, body) {
    const approvalResult = approvalManager.approve(approvalId, body);
    if (!approvalResult.ok) {
      return approvalResult;
    }
    const run = state.runs.find((candidate) => candidate.id === approvalResult.approval.runId);
    if (run) {
      mockWorker.emitToolResult({ runId: run.id, approvalId });
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      emitEvent('info', 'agent-manager', 'Mock agent run closed.', { phase: 5, runId: run.id });
    }
    const agentResult = agentManager.setStatus(approvalResult.approval.agentName, 'idle');
    webSocketManager.broadcast('state', snapshot());
    return okResult({
      approval: approvalResult.approval,
      agent: agentResult.agent,
      run
    });
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
    webSocketManager.broadcast('state', snapshot());
    return denied;
  }

  function interrupt(agentName, body) {
    const interrupted = agentManager.interrupt(agentName, body);
    if (!interrupted.ok) {
      return interrupted;
    }
    for (const run of state.runs) {
      if (run.agentName === interrupted.agent.name && !run.completedAt) {
        run.status = 'interrupted';
        run.completedAt = new Date().toISOString();
      }
    }
    webSocketManager.broadcast('state', snapshot());
    return interrupted;
  }

  function saveSettings(input = {}) {
    const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim().slice(0, 120) : state.settings.model;
    const maxBudget = Number(input.maxBudget);
    if (!Number.isFinite(maxBudget) || maxBudget < 0 || maxBudget > 1000) {
      return errorResult('SETTINGS_INVALID', 'maxBudget must be a number between 0 and 1000');
    }
    state.settings = {
      model,
      maxBudget,
      requireTypedConfirmation: input.requireTypedConfirmation === true
    };
    emitEvent('info', 'settings', 'Settings saved.', { phase: 5, settings: state.settings });
    webSocketManager.broadcast('state', snapshot());
    return okResult({ settings: { ...state.settings } });
  }

  return {
    CRITICAL_CONFIRMATION,
    approve,
    deny,
    getApprovals: () => okResult({ approvals: snapshot().approvals }),
    getAgents: () => okResult({ agents: snapshot().agents }),
    getChatHistory: () => okResult({ chat: snapshot().chat }),
    getEvents: () => okResult({ events: snapshot().events }),
    getSettings: () => okResult({ settings: snapshot().settings }),
    getSnapshots: () => okResult({ snapshots: snapshot().snapshots }),
    getFullState: () => okResult(snapshot()),
    interrupt,
    saveSettings,
    sendChat,
    snapshot,
    webSocketManager
  };
}

module.exports = {
  CRITICAL_CONFIRMATION,
  createPhase5Runtime
};
