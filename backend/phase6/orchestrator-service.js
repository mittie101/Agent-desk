function createOrchestratorService(openAIService, addCost, emitEvent) {
  async function streamOrchestratorResponse({ message, agentName }) {
    const result = await openAIService.streamText({
      instructions: `You are AgentDesk orchestrator. Delegate to the local agent named "${agentName}". Stream a concise status update before delegating. Do not request secrets.`,
      input: [{ role: 'user', content: message }],
      reasoning: { effort: 'low' }
    });
    if (!result.ok) {
      return result;
    }
    addCost(result.usage);
    emitEvent('info', 'orchestrator', 'OpenAI orchestrator response streamed.', {
      phase: 6,
      text: result.text
    });
    return result;
  }

  return {
    streamOrchestratorResponse
  };
}

module.exports = {
  createOrchestratorService
};
