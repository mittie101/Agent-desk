const { okResult } = require('../core/result');

function createOrchestratorService(state, emitEvent, agentManager, approvalManager) {
  function sendChat(message) {
    const timestamp = new Date().toISOString();
    const userMessage = {
      id: `chat-${state.nextChatNumber++}`,
      role: 'user',
      content: message,
      createdAt: timestamp
    };
    state.chat.push(userMessage);

    const assistantMessage = {
      id: `chat-${state.nextChatNumber++}`,
      role: 'assistant',
      content: 'Mock orchestrator is preparing alice and requesting approval for a guarded write.',
      createdAt: new Date().toISOString()
    };
    state.chat.push(assistantMessage);

    emitEvent('info', 'orchestrator', 'Mock orchestrator streamed a response.', {
      phase: 5,
      chatMessageId: assistantMessage.id
    });

    const run = {
      id: `run-${state.nextRunNumber++}`,
      agentName: 'alice',
      status: 'waiting_for_approval',
      startedAt: new Date().toISOString(),
      completedAt: null
    };
    state.runs.push(run);
    agentManager.setStatus('alice', 'running');
    const approval = approvalManager.createWriteFileApproval({ runId: run.id, agentName: 'alice' });

    return okResult({
      chatMessage: userMessage,
      assistantMessage,
      run,
      approval
    });
  }

  return {
    sendChat
  };
}

module.exports = {
  createOrchestratorService
};
