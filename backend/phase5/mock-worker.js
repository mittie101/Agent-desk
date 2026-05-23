const { okResult } = require('../core/result');

function createMockWorker(state, emitEvent) {
  function emitToolResult({ runId, approvalId }) {
    const result = {
      id: `tool-result-${state.nextEventNumber}`,
      runId,
      approvalId,
      tool: 'write_file',
      ok: true,
      path: 'notes.txt',
      contentPreview: 'Phase 5 mock worker output'
    };
    state.toolResults.push(result);
    emitEvent('info', 'mock-worker', 'Mock tool result emitted.', {
      phase: 5,
      runId,
      approvalId,
      tool: 'write_file'
    });
    return okResult({ toolResult: result });
  }

  return {
    emitToolResult
  };
}

module.exports = {
  createMockWorker
};
