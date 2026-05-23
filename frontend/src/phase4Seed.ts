export type PanelId =
  | 'app-header'
  | 'agent-list'
  | 'event-stream'
  | 'orchestrator-chat'
  | 'settings-modal'
  | 'snapshot-manager'
  | 'approval-card'
  | 'critical-confirmation-card';

export interface Phase4Panel {
  id: PanelId;
  title: string;
}

export interface Phase4Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'idle' | 'running' | 'interrupted' | 'error';
  permissions: string[];
  workspace: string;
}

export interface Phase4Event {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  time: string;
  rawPayloadJson: string;
}

export interface Phase4ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  time: string;
}

export const criticalConfirmationPhrase = 'I understand this critical action';

export const phase4Panels: Phase4Panel[] = [
  { id: 'app-header', title: 'AppHeader' },
  { id: 'agent-list', title: 'AgentList' },
  { id: 'event-stream', title: 'EventStream' },
  { id: 'orchestrator-chat', title: 'OrchestratorChat' },
  { id: 'settings-modal', title: 'Settings Modal' },
  { id: 'snapshot-manager', title: 'Snapshot Manager' },
  { id: 'approval-card', title: 'Approval Card' },
  { id: 'critical-confirmation-card', title: 'Critical Typed Confirmation Card' }
];

export const phase4SeedState = {
  agents: [
    {
      id: 'agent-alice',
      name: 'alice',
      role: 'test agent',
      model: 'gpt-4o-mini',
      status: 'idle',
      permissions: ['read', 'write guarded'],
      workspace: 'C:\\projects\\agents\\workspaces\\alice'
    }
  ] satisfies Phase4Agent[],
  events: [
    {
      id: 'evt-001',
      level: 'info',
      source: 'database',
      message: 'Phase 2 seed data loaded.',
      time: '17:20:12',
      rawPayloadJson: '{ "phase":4, "table":"agents", "count":1 }'
    },
    {
      id: 'evt-002',
      level: 'warn',
      source: 'permission-policy',
      message: 'Critical path requires typed confirmation.',
      time: '17:21:03',
      rawPayloadJson: '{ "phase":4, "severity":"critical", "path":"C:\\\\Windows\\\\System32" }'
    },
    {
      id: 'evt-003',
      level: 'debug',
      source: 'virtual-fs',
      message: 'Workspace boundary check passed for alice.',
      time: '17:21:44',
      rawPayloadJson: '{ "phase":4, "tool":"safe_path", "ok":true }'
    }
  ] satisfies Phase4Event[],
  chat: [
    {
      id: 'chat-001',
      role: 'user',
      content: 'Create a test agent called alice.',
      time: '17:18'
    },
    {
      id: 'chat-002',
      role: 'assistant',
      content: 'Created alice as the Phase 2 seed agent.',
      time: '17:19'
    }
  ] satisfies Phase4ChatMessage[],
  permissionBadges: ['read', 'write guarded', 'critical approval'],
  statusBadges: ['idle', 'pending approval', 'snapshot ready'],
  emptyStates: {
    snapshots: 'No snapshots captured yet.',
    approvals: 'No additional approvals pending.'
  },
  settingsModal: {
    title: 'Settings',
    sections: ['Runtime safety', 'Model defaults', 'Workspace policy']
  },
  snapshots: {
    title: 'Snapshot Manager',
    availableActions: ['Create static snapshot', 'Review manifest'],
    items: []
  },
  approval: {
    title: 'Protected path approval',
    severity: 'critical',
    action: 'Write file request',
    path: 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  }
};
