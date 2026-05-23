function compactContext({ messages = [], maxMessages = 20 } = {}) {
  if (!Array.isArray(messages)) {
    return {
      ok: false,
      tool: 'context_compactor',
      code: 'MESSAGES_INVALID',
      message: 'messages must be an array'
    };
  }
  if (!Number.isInteger(maxMessages) || maxMessages < 1) {
    return {
      ok: false,
      tool: 'context_compactor',
      code: 'MAX_MESSAGES_INVALID',
      message: 'maxMessages must be a positive integer'
    };
  }

  return {
    ok: true,
    tool: 'context_compactor',
    compacted: messages.length > maxMessages,
    messages: messages.slice(-maxMessages)
  };
}

module.exports = {
  compactContext
};
