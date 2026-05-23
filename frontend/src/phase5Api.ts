import { phase4SeedState } from './phase4Seed';

export const API_BASE_URL = 'http://127.0.0.1:9403';
export const criticalConfirmationPhrase = 'I understand this critical action';

export interface Phase5Agent {
  id?: string;
  name: string;
  role?: string;
  model?: string;
  status: string;
  updatedAt?: string;
}

export interface Phase5Event {
  id: string;
  level?: string;
  source?: string;
  message: string;
  payload?: unknown;
  createdAt?: string;
}

export interface Phase5ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

export interface Phase5Approval {
  id: string;
  status: string;
  severity: string;
  actionType?: string;
  title?: string;
  path?: string;
}

export interface Phase5Snapshot {
  id: string;
  name: string;
  workspacePath?: string;
  fileCount: number;
  byteCount: number;
  createdAt?: string;
}

export interface Phase5Settings {
  model: string;
  maxBudget: number;
  requireTypedConfirmation: boolean;
}

export interface Phase5State {
  agents: Phase5Agent[];
  events: Phase5Event[];
  chat: Phase5ChatMessage[];
  approvals: Phase5Approval[];
  pendingApproval: Phase5Approval | null;
  snapshots: Phase5Snapshot[];
  settings: Phase5Settings;
  cost: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  errors: Array<{
    id?: string;
    code: string;
    message: string;
    createdAt?: string;
  }>;
  health: {
    openaiConfigured: boolean;
  };
}

const defaultSettings: Phase5Settings = {
  model: 'stub-orchestrator',
  maxBudget: 0.5,
  requireTypedConfirmation: true
};

export function createPhase5InitialState(): Phase5State {
  return normalizePhase5State({
    agents: phase4SeedState.agents,
    events: phase4SeedState.events.map((event) => ({
      id: event.id,
      level: event.level,
      source: event.source,
      message: event.message,
      payload: event.rawPayloadJson,
      createdAt: event.time
    })),
    chat: phase4SeedState.chat.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.time
    })),
    approvals: [
      {
        id: 'seed-approval',
        status: 'pending',
        severity: 'critical',
        actionType: 'write_file',
        title: phase4SeedState.approval.title,
        path: phase4SeedState.approval.path
      }
    ],
    snapshots: phase4SeedState.snapshots.items,
    settings: defaultSettings
  });
}

export function normalizePhase5State(payload: Partial<Phase5State>): Phase5State {
  const approvals = Array.isArray(payload.approvals) ? payload.approvals : [];
  return {
    agents: Array.isArray(payload.agents) ? payload.agents : [],
    events: Array.isArray(payload.events) ? payload.events : [],
    chat: Array.isArray(payload.chat) ? payload.chat : [],
    approvals,
    pendingApproval: approvals.find((approval) => approval.status === 'pending') || null,
    snapshots: Array.isArray(payload.snapshots) ? payload.snapshots : [],
    settings: {
      ...defaultSettings,
      ...(payload.settings || {})
    },
    cost: {
      inputTokens: payload.cost?.inputTokens || 0,
      outputTokens: payload.cost?.outputTokens || 0,
      totalTokens: payload.cost?.totalTokens || 0,
      estimatedCost: payload.cost?.estimatedCost || 0
    },
    errors: Array.isArray(payload.errors) ? payload.errors : [],
    health: {
      openaiConfigured: payload.health?.openaiConfigured === true
    }
  };
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok || body.ok === false) {
    throw new Error(body.message || body.code || `Request failed: ${path}`);
  }
  return body;
}

export async function loadPhase5State(): Promise<Phase5State> {
  const [stateBody, healthBody] = await Promise.all([
    requestJson<Partial<Phase5State>>('/state'),
    requestJson<{ openaiConfigured: boolean }>('/health')
  ]);
  return normalizePhase5State({
    ...stateBody,
    health: { openaiConfigured: healthBody.openaiConfigured === true }
  });
}

export async function sendChat(message: string) {
  return requestJson('/send_chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export async function approvePending(approvalId: string, typedConfirmation: string) {
  return requestJson(`/approve/${encodeURIComponent(approvalId)}`, {
    method: 'POST',
    body: JSON.stringify({ typedConfirmation })
  });
}

export async function denyPending(approvalId: string, reason: string) {
  return requestJson(`/deny/${encodeURIComponent(approvalId)}`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function interruptAgent(agentName: string) {
  return requestJson(`/interrupt/${encodeURIComponent(agentName)}`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'operator interrupt from renderer' })
  });
}

export async function saveSettings(settings: Phase5Settings) {
  return requestJson('/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
}

export async function createSnapshot(name: string) {
  return requestJson('/snapshots', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function previewSnapshotRestore(snapshotId: string) {
  return requestJson(`/snapshots/${encodeURIComponent(snapshotId)}/diff`);
}

export async function restoreSnapshot(snapshotId: string, typedConfirmation: string) {
  return requestJson(`/snapshots/${encodeURIComponent(snapshotId)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ typedConfirmation })
  });
}
