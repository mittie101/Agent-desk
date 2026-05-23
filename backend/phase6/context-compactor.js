const { errorResult, okResult } = require('../core/result');

async function compactContextWithOpenAI({ openAIService, messages, maxMessages = 12 } = {}) {
  if (!Array.isArray(messages)) {
    return errorResult('MESSAGES_INVALID', 'messages must be an array');
  }
  if (messages.length <= maxMessages) {
    return okResult({ compacted: false, messages });
  }

  const activeMessages = messages.slice(-maxMessages);
  const staleMessages = messages.slice(0, -maxMessages);
  const summaryResult = await openAIService.createText({
    input: `Summarize these completed AgentDesk messages for future context:\n${JSON.stringify(staleMessages)}`,
    instructions:
      'Summarize completed actions, unresolved blockers, IDs, tool outcomes, and next concrete goal. Do not invent facts.'
  });
  if (!summaryResult.ok) {
    return okResult({
      compacted: false,
      fallback: true,
      warning: 'Context compaction failed; using recent messages only.',
      messages: activeMessages,
      error: summaryResult
    });
  }

  return okResult({
    compacted: true,
    messages: [
      {
        role: 'system',
        content: `Compacted prior context: ${summaryResult.text}`
      },
      ...activeMessages
    ],
    usage: summaryResult.usage
  });
}

module.exports = {
  compactContextWithOpenAI
};
