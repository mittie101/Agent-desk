export type AgentStatus = 'idle' | 'running' | 'interrupted' | 'error';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ChatRole = 'system' | 'user' | 'assistant';
export type ExecutionRunStatus = 'queued' | 'running' | 'interrupted' | 'completed' | 'failed';
export type ExecutionStepStatus = 'pending' | 'running' | 'approved' | 'denied' | 'completed' | 'failed';
export type ApprovalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface OrchestratorAgentRecord {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'error';
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRecord {
  id: string;
  orchestrator_agent_id: string;
  name: string;
  role: string;
  status: AgentStatus;
  model: string;
  workspace_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLogRecord {
  id: string;
  agent_id: string;
  level: LogLevel;
  message: string;
  payload_json: string;
  created_at: string;
}

export interface OrchestratorChatRecord {
  id: string;
  role: ChatRole;
  content: string;
  payload_json: string;
  created_at: string;
}

export interface SystemLogRecord {
  id: string;
  level: LogLevel;
  source: string;
  message: string;
  payload_json: string;
  created_at: string;
}

export interface ExecutionRunRecord {
  id: string;
  agent_id: string;
  status: ExecutionRunStatus;
  user_instruction: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionStepRecord {
  id: string;
  run_id: string;
  sequence: number;
  kind: string;
  status: ExecutionStepStatus;
  payload_json: string;
  result_json: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalEventRecord {
  id: string;
  run_id: string | null;
  step_id: string | null;
  severity: ApprovalSeverity;
  status: ApprovalStatus;
  action_type: string;
  requested_payload_json: string;
  response_payload_json: string;
  created_at: string;
  resolved_at: string | null;
}

export interface SnapshotRecord {
  id: string;
  name: string;
  workspace_path: string;
  manifest_json: string;
  file_count: number;
  byte_count: number;
  created_at: string;
}

export interface FileBackupRecord {
  id: string;
  snapshot_id: string | null;
  original_path: string;
  backup_path: string;
  sha256: string;
  byte_count: number;
  created_at: string;
}

export interface OrchestratorState {
  orchestratorAgents: OrchestratorAgentRecord[];
  agents: AgentRecord[];
  agentLogs: AgentLogRecord[];
  orchestratorChat: OrchestratorChatRecord[];
  systemLogs: SystemLogRecord[];
  executionRuns: ExecutionRunRecord[];
  executionSteps: ExecutionStepRecord[];
  approvalEvents: ApprovalEventRecord[];
  snapshots: SnapshotRecord[];
  fileBackups: FileBackupRecord[];
}

export const phase2CollectionKeys = [
  'orchestratorAgents',
  'agents',
  'agentLogs',
  'orchestratorChat',
  'systemLogs',
  'executionRuns',
  'executionSteps',
  'approvalEvents',
  'snapshots',
  'fileBackups'
] as const satisfies readonly (keyof OrchestratorState)[];

const seedTimestamp = '2026-05-21T00:00:00.000Z';

export function createDefaultOrchestratorState(): OrchestratorState {
  return {
    orchestratorAgents: [
      {
        id: 'orchestrator-default',
        name: 'orchestrator',
        model: 'gpt-4o',
        status: 'idle',
        system_prompt: 'AgentDesk orchestrator seed record for Phase 2.',
        created_at: seedTimestamp,
        updated_at: seedTimestamp
      }
    ],
    agents: [
      {
        id: 'agent-alice',
        orchestrator_agent_id: 'orchestrator-default',
        name: 'alice',
        role: 'test agent',
        status: 'idle',
        model: 'gpt-4o-mini',
        workspace_path: null,
        created_at: seedTimestamp,
        updated_at: seedTimestamp
      }
    ],
    agentLogs: [
      {
        id: 'agent-log-1',
        agent_id: 'agent-alice',
        level: 'info',
        message: 'Agent alice created.',
        payload_json: '{}',
        created_at: seedTimestamp
      },
      {
        id: 'agent-log-2',
        agent_id: 'agent-alice',
        level: 'info',
        message: 'Agent alice waiting for instruction.',
        payload_json: '{}',
        created_at: seedTimestamp
      },
      {
        id: 'agent-log-3',
        agent_id: 'agent-alice',
        level: 'debug',
        message: 'Phase 2 seed log.',
        payload_json: '{}',
        created_at: seedTimestamp
      }
    ],
    orchestratorChat: [
      {
        id: 'chat-seed-1',
        role: 'user',
        content: 'Create a test agent called alice.',
        payload_json: '{}',
        created_at: seedTimestamp
      },
      {
        id: 'chat-seed-2',
        role: 'assistant',
        content: 'Created alice as the Phase 2 seed agent.',
        payload_json: '{}',
        created_at: seedTimestamp
      }
    ],
    systemLogs: [],
    executionRuns: [],
    executionSteps: [],
    approvalEvents: [],
    snapshots: [],
    fileBackups: []
  };
}

