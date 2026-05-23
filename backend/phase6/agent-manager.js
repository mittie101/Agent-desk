const { errorResult, okResult } = require('../core/result');

function createAgentManager(state, emitEvent) {
  function getAgentByName(agentName) {
    return state.agents.find((agent) => agent.name.toLowerCase() === String(agentName || '').toLowerCase());
  }

  function setStatus(agentName, status) {
    const agent = getAgentByName(agentName);
    if (!agent) {
      return errorResult('AGENT_NOT_FOUND', 'Agent was not found');
    }
    agent.status = status;
    agent.updatedAt = new Date().toISOString();
    emitEvent('info', 'agent-manager', `Agent ${agent.name} status changed to ${status}.`, {
      phase: 6,
      status
    });
    return okResult({ agent });
  }

  function interrupt(agentName, { reason } = {}) {
    const result = setStatus(agentName, 'interrupted');
    if (!result.ok) {
      return result;
    }
    emitEvent('warn', 'agent-manager', `Agent ${result.agent.name} interrupted.`, {
      phase: 6,
      reason: typeof reason === 'string' ? reason.slice(0, 300) : ''
    });
    return result;
  }

  return {
    getAgentByName,
    interrupt,
    setStatus
  };
}

module.exports = {
  createAgentManager
};
