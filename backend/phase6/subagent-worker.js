const { errorResult, okResult } = require('../core/result');

const MAX_AGENT_ITERATIONS = 20;

function parseWorkerPlan(text) {
  try {
    const parsed = JSON.parse(text);
    return okResult({ plan: parsed });
  } catch (error) {
    return errorResult('WORKER_PLAN_INVALID', 'Subagent did not return valid JSON', {
      rawText: text,
      parseError: error.message
    });
  }
}

function createSubagentWorker(openAIService, addCost, emitEvent) {
  async function run({ message, agent }) {
    for (let iteration = 1; iteration <= MAX_AGENT_ITERATIONS; iteration += 1) {
      let result;
      try {
        result = await openAIService.createText({
          instructions: `You are local agent ${agent.name} (iteration ${iteration} of ${MAX_AGENT_ITERATIONS}). Return only JSON. To write a file, return {"action":"write_file","path":"hello.txt","content":"hello world"}. If more thinking is needed return {"action":"continue"}.`,
          input: [{ role: 'user', content: message }],
          text: { format: { type: 'json_object' } },
          reasoning: { effort: 'low' }
        });
      } catch (error) {
        emitEvent('error', 'subagent-worker', 'Worker crashed during OpenAI loop.', {
          phase: 7,
          message: error instanceof Error ? error.message : 'unknown worker crash'
        });
        return errorResult('WORKER_CRASH', error instanceof Error ? error.message : 'Worker crashed');
      }
      if (!result.ok) {
        return result;
      }
      addCost(result.usage);

      const parsed = parseWorkerPlan(result.text);
      if (!parsed.ok) {
        return parsed;
      }

      if (parsed.plan.action === 'write_file') {
        emitEvent('info', 'subagent-worker', 'Subagent proposed write_file.', {
          phase: 6,
          iteration,
          path: parsed.plan.path
        });
        return okResult({
          iteration,
          action: {
            type: 'write_file',
            path: String(parsed.plan.path || ''),
            content: String(parsed.plan.content || '')
          }
        });
      }
    }

    emitEvent('error', 'subagent-worker', 'Subagent stopped after 20 iterations.', {
      phase: 6,
      maxIterations: MAX_AGENT_ITERATIONS
    });
    return errorResult('MAX_ITERATIONS_REACHED', 'Subagent exceeded the maximum iteration count');
  }

  return {
    run
  };
}

module.exports = {
  MAX_AGENT_ITERATIONS,
  createSubagentWorker,
  parseWorkerPlan
};
