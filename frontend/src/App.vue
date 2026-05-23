<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  API_BASE_URL,
  approvePending,
  createSnapshot,
  createPhase5InitialState,
  criticalConfirmationPhrase,
  denyPending,
  interruptAgent,
  loadPhase5State,
  normalizePhase5State,
  previewSnapshotRestore,
  restoreSnapshot,
  saveSettings,
  sendChat,
  type Phase5Settings,
  type Phase5State
} from './phase5Api';
import { eventIcon, formatCost, formatTokens, permissionClass, severityClass, statusClass } from './phase9Ui';

const state = reactive<Phase5State>(createPhase5InitialState());
const chatDraft = ref('Run the Phase 5 mock write flow.');
const typedConfirmation = ref('');
const settingsDraft = reactive<Phase5Settings>({ ...state.settings });
const operationStatus = ref('Loading backend state...');
const operationError = ref('');
const snapshotName = ref('Manual workspace snapshot');
const selectedSnapshotId = ref('');
const snapshotDiffCount = ref<number | null>(null);
const eventFilter = ref('all');
const eventSearch = ref('');
const showOnboarding = ref(false);
const settingsExpanded = ref(true);
const apiKeyDraft = ref('');
const criticalShake = ref(false);
let criticalShakeTimer: ReturnType<typeof setTimeout> | null = null;

const pendingApproval = computed(() => state.pendingApproval);
const selectedSnapshot = computed(() => state.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId.value) || state.snapshots[0] || null);
const pendingQueueCount = computed(() => state.approvals.filter((approval) => approval.status === 'pending').length);
const unrestrictedMode = computed(() => settingsDraft.requireTypedConfirmation === false);
const visibleEvents = computed(() => {
  const query = eventSearch.value.trim().toLowerCase();
  return state.events.filter((event) => {
    const levelMatches = eventFilter.value === 'all' || event.level === eventFilter.value;
    const queryMatches = !query || (eventSearchKeys.get(event.id) ?? '').includes(query);
    return levelMatches && queryMatches;
  });
});

function triggerCriticalShake() {
  if (criticalShakeTimer !== null) {
    clearTimeout(criticalShakeTimer);
    criticalShakeTimer = null;
  }
  criticalShake.value = false;
  window.requestAnimationFrame(() => {
    criticalShake.value = true;
    criticalShakeTimer = window.setTimeout(() => {
      criticalShake.value = false;
      criticalShakeTimer = null;
    }, 420);
  });
}

function replaceState(nextState: Phase5State) {
  state.agents = nextState.agents;
  state.events = nextState.events;
  eventSearchKeys.clear();
  for (const event of nextState.events) {
    eventSearchKeys.set(event.id, `${event.message} ${event.source ?? ''}`.toLowerCase());
  }
  state.chat = nextState.chat;
  state.approvals = nextState.approvals;
  state.pendingApproval = nextState.pendingApproval;
  state.snapshots = nextState.snapshots;
  state.settings = nextState.settings;
  state.errors = nextState.errors;
  state.health = nextState.health;
  Object.assign(settingsDraft, nextState.settings);
  if (!selectedSnapshotId.value && nextState.snapshots.length > 0) {
    selectedSnapshotId.value = nextState.snapshots[0].id;
  }
}

async function refreshState(message = 'State reloaded.') {
  operationError.value = '';
  try {
    replaceState(await loadPhase5State());
    operationStatus.value = message;
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Backend state load failed';
    operationStatus.value = 'Using local seed state';
  }
}

async function submitChat() {
  operationError.value = '';
  try {
    await sendChat(chatDraft.value);
    chatDraft.value = '';
    typedConfirmation.value = '';
    await refreshState('Mock flow started; approval is waiting.');
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Chat send failed';
  }
}

async function approveCurrent() {
  if (!pendingApproval.value) {
    return;
  }
  operationError.value = '';
  try {
    await approvePending(pendingApproval.value.id, typedConfirmation.value);
    typedConfirmation.value = '';
    await refreshState('Approval resolved; mock run closed.');
  } catch (error) {
    triggerCriticalShake();
    operationError.value = error instanceof Error ? error.message : 'Approval failed';
  }
}

async function denyCurrent() {
  if (!pendingApproval.value) {
    return;
  }
  operationError.value = '';
  try {
    await denyPending(pendingApproval.value.id, 'Denied from Phase 5 renderer');
    typedConfirmation.value = '';
    await refreshState('Approval denied.');
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Deny failed';
  }
}

async function interruptAlice() {
  operationError.value = '';
  try {
    await interruptAgent('alice');
    await refreshState('alice interrupted.');
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Interrupt failed';
  }
}

async function saveSettingsDraft() {
  operationError.value = '';
  try {
    await saveSettings({ ...settingsDraft, maxBudget: Number(settingsDraft.maxBudget) });
    await refreshState('Settings saved and reloaded.');
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Settings save failed';
  }
}

async function saveApiKey() {
  operationError.value = '';
  try {
    await window.agentdesk?.setApiKey(apiKeyDraft.value.trim());
    operationStatus.value = apiKeyDraft.value.trim() ? 'API key saved.' : 'API key cleared.';
    await refreshState();
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'API key save failed';
  }
}

async function createWorkspaceSnapshot() {
  operationError.value = '';
  snapshotDiffCount.value = null;
  try {
    const result = await createSnapshot(snapshotName.value);
    selectedSnapshotId.value = result.snapshot.id;
    await refreshState('Snapshot created.');
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Snapshot create failed';
  }
}

async function previewSelectedSnapshot() {
  if (!selectedSnapshot.value) {
    return;
  }
  operationError.value = '';
  try {
    const result = await previewSnapshotRestore(selectedSnapshot.value.id);
    snapshotDiffCount.value = result.diffCount;
    operationStatus.value = `Snapshot restore would change ${result.diffCount} file(s).`;
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : 'Snapshot diff failed';
  }
}

async function restoreSelectedSnapshot() {
  if (!selectedSnapshot.value) {
    return;
  }
  operationError.value = '';
  try {
    const result = await restoreSnapshot(selectedSnapshot.value.id, typedConfirmation.value);
    snapshotDiffCount.value = result.diffCount;
    typedConfirmation.value = '';
    await refreshState(`Snapshot restored; ${result.diffCount} file(s) changed.`);
  } catch (error) {
    triggerCriticalShake();
    operationError.value = error instanceof Error ? error.message : 'Snapshot restore failed';
  }
}

function dismissOnboarding() {
  showOnboarding.value = false;
  window.localStorage.setItem('agentdesk-onboarding-dismissed', '1');
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.key === ',') {
    event.preventDefault();
    settingsExpanded.value = true;
    nextTick(() => document.getElementById('settings-model')?.focus());
  }
}

let wsRef: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
const eventSearchKeys = new Map<string, string>();

function connectWs() {
  if (wsRef !== null) return;
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);
  wsRef = ws;

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { type: string; payload: unknown };
      if (msg.type === 'state' && msg.payload && typeof msg.payload === 'object') {
        replaceState(normalizePhase5State({ ...(msg.payload as Partial<Phase5State>), health: state.health }));
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener('close', () => {
    wsRef = null;
    wsReconnectTimer = setTimeout(connectWs, 3000);
  });

  ws.addEventListener('error', () => {
    ws.close();
  });
}

function disconnectWs() {
  if (wsReconnectTimer !== null) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (wsRef !== null) {
    wsRef.close();
    wsRef = null;
  }
}

onMounted(async () => {
  showOnboarding.value = window.localStorage.getItem('agentdesk-onboarding-dismissed') !== '1';
  window.addEventListener('keydown', handleGlobalKeydown);
  connectWs();
  refreshState('Backend state loaded.');
  if (window.agentdesk?.getApiKey) {
    try {
      apiKeyDraft.value = await window.agentdesk.getApiKey();
    } catch {
      // not in Electron or no key stored
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  disconnectWs();
});
</script>

<template>
  <main class="workspace-shell">
    <header class="app-header" data-panel="app-header">
      <div>
        <p class="eyebrow">Phase 10 Distribution</p>
        <h1>AgentDesk</h1>
      </div>
      <div class="header-status">
        <span class="status-dot"></span>
        <span>{{ operationStatus }}</span>
      </div>
    </header>

    <section v-if="showOnboarding" class="onboarding-banner" data-panel="first-run-onboarding">
      <div>
        <strong>First run</strong>
        <p>Set model and approval mode, then send an instruction. File writes require review before execution.</p>
      </div>
      <button type="button" class="inline-button" data-action="dismiss-onboarding" @click="dismissOnboarding">Dismiss</button>
    </section>

    <section v-if="unrestrictedMode" class="warning-banner" data-panel="unrestricted-warning" role="alert">
      Unrestricted approval mode is active. Critical actions will not require typed confirmation.
    </section>

    <section v-if="state.health.openaiConfigured" class="success-toast" data-panel="openai-ready-toast" role="status">
      <span class="toast-dot"></span>
      OpenAI key loaded. AgentDesk is ready for live model calls.
    </section>

    <section class="workspace-grid" aria-label="AgentDesk static workspace">
      <aside class="left-column" data-panel="agent-list">
        <div class="section-heading">
          <p>Agents</p>
          <span class="count">{{ state.agents.length }}</span>
        </div>

        <p v-if="state.agents.length === 0" class="empty-state">No agents restored yet.</p>
        <article v-for="agent in state.agents" :key="agent.name" class="agent-row">
          <div class="row-title">
            <strong>{{ agent.name }}</strong>
            <span class="badge status" :class="statusClass(agent.status)">{{ agent.status }}</span>
          </div>
          <p>{{ agent.role || 'test agent' }} · {{ agent.model || 'gpt-4o-mini' }}</p>
          <small>{{ agent.updatedAt || 'waiting for backend update' }}</small>
          <div class="badge-row" aria-label="Agent permissions">
            <span v-for="permission in ['read', 'write guarded']" :key="permission" class="badge permission" :class="permissionClass(permission)">
              {{ permission }}
            </span>
            <span class="badge queue" data-badge="agent-queue">queue {{ pendingQueueCount }}</span>
          </div>
          <button type="button" class="secondary-button" data-action="interrupt-agent" @click="interruptAlice">
            Interrupt alice
          </button>
        </article>

        <section class="snapshot-panel" data-panel="snapshot-manager" aria-label="Snapshot Manager">
          <div class="section-heading">
            <p>Snapshot Manager</p>
            <span class="badge status">phase 8</span>
          </div>
          <p class="empty-state">{{ state.snapshots.length === 0 ? 'No snapshots captured yet.' : `${state.snapshots.length} snapshots` }}</p>
          <input v-model="snapshotName" aria-label="Snapshot name" />
          <button type="button" data-action="create-snapshot" @click="createWorkspaceSnapshot">Create snapshot</button>
          <select v-if="state.snapshots.length > 0" v-model="selectedSnapshotId" aria-label="Snapshot selection">
            <option v-for="snapshot in state.snapshots" :key="snapshot.id" :value="snapshot.id">
              {{ snapshot.name }} · {{ snapshot.fileCount }} files
            </option>
          </select>
          <p v-if="snapshotDiffCount !== null" class="empty-state">Restore diff {{ snapshotDiffCount }} file(s)</p>
          <button type="button" class="secondary-button" :disabled="!selectedSnapshot" data-action="preview-snapshot" @click="previewSelectedSnapshot">
            Preview restore
          </button>
          <button type="button" class="secondary-button" :disabled="!selectedSnapshot" data-action="restore-snapshot" @click="restoreSelectedSnapshot">
            Restore with confirmation
          </button>
        </section>

        <section class="snapshot-panel" aria-label="Cost Counter">
          <div class="section-heading">
            <p>Cost Counter</p>
            <span class="badge status">live</span>
          </div>
          <p class="cost-line">Input {{ formatTokens(state.cost.inputTokens) }} · Output {{ formatTokens(state.cost.outputTokens) }}</p>
          <p class="cost-line">Total {{ formatTokens(state.cost.totalTokens) }} · {{ formatCost(state.cost.estimatedCost) }}</p>
        </section>
      </aside>

      <section class="center-column" data-panel="event-stream">
        <div class="section-heading">
          <p>EventStream</p>
          <span class="count">{{ visibleEvents.length }} / {{ state.events.length }}</span>
        </div>

        <div class="event-toolbar" data-action="event-filter">
          <select v-model="eventFilter" aria-label="Event level filter">
            <option value="all">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <input v-model="eventSearch" aria-label="Search events" placeholder="Search events" />
        </div>

        <p v-if="visibleEvents.length === 0" class="empty-state">No events match the current filter.</p>
        <article v-for="event in visibleEvents" :key="event.id" class="event-row">
          <div class="event-meta">
            <span class="event-icon" :class="event.level">{{ eventIcon(event.level) }}</span>
            <span class="badge" :class="event.level">{{ event.level }}</span>
            <span>{{ event.createdAt || 'seed' }}</span>
            <span>{{ event.source }}</span>
          </div>
          <p>{{ event.message }}</p>
          <details>
            <summary>Raw payload</summary>
            <pre>{{ JSON.stringify(event.payload || {}, null, 2) }}</pre>
          </details>
        </article>
      </section>

      <aside class="right-column">
        <section class="chat-panel" data-panel="orchestrator-chat">
          <div class="section-heading">
            <p>OrchestratorChat</p>
            <span class="badge status">interactive</span>
          </div>
          <p v-if="state.chat.length === 0" class="empty-state">No chat history restored yet.</p>
          <article v-for="message in state.chat" :key="message.id" class="chat-message" :class="message.role">
            <span>{{ message.role }} · {{ message.createdAt || 'seed' }}</span>
            <p>{{ message.content }}</p>
          </article>
          <form class="chat-form" data-action="send-chat" @submit.prevent="submitChat">
            <textarea v-model="chatDraft" aria-label="Chat message" rows="3" @keydown.enter.exact.prevent="submitChat"></textarea>
            <button type="submit">Send chat</button>
          </form>
        </section>

        <section class="settings-modal" data-panel="settings-modal" role="dialog" aria-label="Settings Modal" :data-state="settingsExpanded ? 'open' : 'closed'">
          <div class="section-heading">
            <p>Settings</p>
            <span class="badge status">save/reload</span>
          </div>
          <label for="settings-api-key">OpenAI API key</label>
          <input id="settings-api-key" v-model="apiKeyDraft" type="password" placeholder="sk-…" autocomplete="current-password" />
          <button type="button" data-action="save-api-key" @click="saveApiKey">Save API key</button>
          <label for="settings-model">Runtime safety</label>
          <input id="settings-model" v-model="settingsDraft.model" />
          <label for="settings-budget">Max budget</label>
          <input id="settings-budget" v-model.number="settingsDraft.maxBudget" type="number" min="0" step="0.01" />
          <label class="checkbox-row">
            <input v-model="settingsDraft.requireTypedConfirmation" type="checkbox" />
            Require typed confirmation
          </label>
          <button type="button" data-action="save-settings" @click="saveSettingsDraft">Save settings</button>
        </section>

        <section class="approval-card" data-panel="approval-card">
          <div class="section-heading">
            <p>{{ pendingApproval?.title || 'Approval Card' }}</p>
            <span class="badge critical" :class="severityClass(pendingApproval?.severity)">{{ pendingApproval?.severity || 'none' }}</span>
          </div>
          <p>{{ pendingApproval ? pendingApproval.actionType : 'No approval pending.' }}</p>
          <code>{{ pendingApproval?.path || 'No protected path selected.' }}</code>
          <div class="approval-actions">
            <button type="button" :disabled="!pendingApproval" data-action="approve" @click="approveCurrent">Approve</button>
            <button type="button" :disabled="!pendingApproval" class="secondary-button" data-action="deny" @click="denyCurrent">
              Deny
            </button>
          </div>
        </section>

        <section class="confirmation-card" data-panel="critical-confirmation-card" :class="{ 'critical-shake': criticalShake }">
          <p>Critical Typed Confirmation Card</p>
          <label for="typed-confirmation">Type exact phrase</label>
          <input id="typed-confirmation" v-model="typedConfirmation" :placeholder="criticalConfirmationPhrase" />
          <small>{{ pendingApproval ? criticalConfirmationPhrase : 'No additional approvals pending.' }}</small>
        </section>

        <section class="error-panel" data-panel="error-panel" aria-label="Visible error messages">
          <div class="section-heading">
            <p>Errors</p>
            <span class="badge error">{{ state.errors.length }}</span>
          </div>
          <p v-if="state.errors.length === 0" class="empty-state">No runtime errors.</p>
          <article v-for="error in state.errors" :key="error.id || error.code" class="error-item">
            <strong>{{ error.code }}</strong>
            <p>{{ error.message }}</p>
          </article>
        </section>

        <p v-if="operationError" class="error-text" role="alert">{{ operationError }}</p>
      </aside>
    </section>
  </main>
</template>

<style>
:root {
  color: #e8edf2;
  background: #101214;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow: hidden;
  background: #101214;
}

button,
input,
select,
textarea {
  font: inherit;
}

.workspace-shell {
  display: grid;
  grid-template-rows: 72px auto auto minmax(0, 1fr);
  height: 100vh;
  padding: 18px;
  gap: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 180px),
    #101214;
}

.onboarding-banner,
.warning-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid #34524a;
  border-radius: 8px;
  background: #13221e;
  padding: 10px 12px;
}

.onboarding-banner strong {
  color: #eaf7f2;
  font-size: 13px;
}

.onboarding-banner p,
.warning-banner {
  margin: 0;
  color: #b9cfc7;
  font-size: 12px;
  line-height: 1.35;
}

.warning-banner {
  border-color: #7d5b31;
  background: #241b10;
  color: #f4ca72;
}

.success-toast {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #3f7a58;
  border-radius: 8px;
  background: #12251a;
  color: #bcf3cf;
  padding: 10px 12px;
  font-size: 13px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  contain: layout style paint;
}

.toast-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #53d08a;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  border-bottom: 1px solid #2d3339;
  padding-bottom: 14px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #8fc7b5;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1;
}

.header-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #c9d2dc;
  font-size: 13px;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #53d08a;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(230px, 0.82fr) minmax(420px, 1.5fr) minmax(310px, 1fr);
  min-height: 0;
  gap: 14px;
}

.left-column,
.center-column,
.right-column {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border: 1px solid #2d3339;
  border-radius: 8px;
  background: #171a1e;
}

.left-column,
.center-column,
.right-column,
.chat-panel,
.settings-modal,
.approval-card,
.confirmation-card,
.snapshot-panel,
.error-panel {
  padding: 14px;
}

.right-column {
  display: grid;
  gap: 12px;
  align-content: start;
}

.section-heading,
.row-title,
.event-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 10px;
}

.section-heading {
  margin-bottom: 12px;
}

.section-heading p,
.confirmation-card > p {
  margin: 0;
  color: #f4f7fa;
  font-size: 14px;
  font-weight: 800;
}

.count {
  color: #9aa7b5;
  font-size: 12px;
}

.agent-row,
.event-row,
.chat-message,
.settings-modal,
.approval-card,
.confirmation-card,
.snapshot-panel,
.error-panel {
  border-top: 1px solid #2b3137;
}

.agent-row,
.event-row,
.chat-message {
  padding: 12px 0;
}

.agent-row p,
.event-row p,
.chat-message p,
.approval-card p,
.empty-state,
small,
li {
  color: #b9c3ce;
  font-size: 13px;
  line-height: 1.35;
}

.error-item {
  border-top: 1px solid #51333a;
  padding: 10px 0;
}

.error-item strong,
.error-text {
  color: #ffaaa8;
}

.agent-row p,
.event-row p,
.chat-message p,
.approval-card p,
.empty-state {
  margin: 8px 0;
}

.agent-row small,
code {
  display: block;
  overflow: hidden;
  color: #93a1af;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.badge {
  flex: none;
  border: 1px solid #3c4650;
  border-radius: 999px;
  padding: 3px 8px;
  color: #d8e0e8;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  text-transform: uppercase;
}

.permission {
  border-color: #46645b;
  color: #9ed9c6;
}

.status,
.info {
  border-color: #3f5265;
  color: #9fc9ef;
}

.status-running,
.permission-write-guarded,
.queue {
  border-color: #6b5c36;
  color: #f4ca72;
}

.status-error,
.permission-unrestricted,
.severity-critical {
  border-color: #804b4f;
  color: #ffaaa8;
}

.status-idle,
.severity-low {
  border-color: #46645b;
  color: #9ed9c6;
}

.warn {
  border-color: #6b5c36;
  color: #f4ca72;
}

.debug {
  border-color: #4b5662;
  color: #c2ccd7;
}

.critical,
.error {
  border-color: #804b4f;
  color: #ffaaa8;
}

.event-toolbar {
  display: grid;
  grid-template-columns: minmax(120px, 0.35fr) minmax(180px, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.event-icon {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid #3c4650;
  border-radius: 50%;
  color: #d5dee8;
  font-size: 12px;
  font-weight: 900;
}

.cost-line {
  margin: 8px 0;
  color: #e1ebe6;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

button {
  width: 100%;
  border: 1px solid #496257;
  border-radius: 6px;
  background: #20372f;
  color: #dff8ee;
  padding: 9px 10px;
  cursor: default;
}

.inline-button {
  width: auto;
  min-width: 88px;
  padding: 7px 10px;
}

details {
  margin-top: 8px;
}

summary {
  color: #8fc7b5;
  cursor: default;
  font-size: 12px;
  font-weight: 700;
}

pre {
  overflow: auto;
  margin: 8px 0 0;
  max-height: 94px;
  border-radius: 6px;
  background: #0d0f12;
  color: #d5dee8;
  padding: 10px;
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message.assistant {
  padding-left: 10px;
  border-left: 3px solid #8fc7b5;
}

.chat-message span,
label {
  color: #93a1af;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

ul {
  margin: 0;
  padding-left: 18px;
}

code,
input,
select,
textarea {
  width: 100%;
  border: 1px solid #39424b;
  border-radius: 6px;
  background: #0d0f12;
  padding: 8px;
}

input,
select,
textarea {
  margin: 8px 0;
  color: #f4f7fa;
}

textarea {
  min-height: 82px;
  resize: vertical;
}

.confirmation-card {
  will-change: transform;
}

.critical-shake {
  animation: critical-shake 420ms ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
  .critical-shake {
    animation: none;
  }
}

@keyframes critical-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  50% {
    transform: translateX(5px);
  }
  75% {
    transform: translateX(-3px);
  }
}

@media (max-width: 900px) {
  body {
    overflow: auto;
  }

  .workspace-shell {
    height: auto;
    min-height: 100vh;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .event-toolbar,
  .onboarding-banner {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
