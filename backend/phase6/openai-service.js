const { errorResult, okResult } = require('../core/result');

const RETRY_DELAYS_MS = Object.freeze([5000, 10000, 20000]);

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDefaultClient(apiKey) {
  const OpenAI = require('openai');
  return new OpenAI({ apiKey });
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.input_tokens || 0),
    outputTokens: Number(usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0)
  };
}

function getStatus(error) {
  return Number(error?.status || error?.code || error?.response?.status || 0);
}

function mapOpenAIError(error) {
  const status = getStatus(error);
  if (status === 401) {
    return errorResult('OPENAI_INVALID_KEY', 'OpenAI API key is invalid', { status });
  }
  if (status === 429) {
    return errorResult('OPENAI_RATE_LIMITED', 'OpenAI rate limit was reached', { status });
  }
  if (status >= 500 && status <= 599) {
    return errorResult('OPENAI_SERVER_ERROR', error.message || 'OpenAI server error', { status });
  }
  return errorResult('OPENAI_REQUEST_FAILED', error.message || 'OpenAI request failed', { status });
}

function extractText(response) {
  if (typeof response?.output_text === 'string') {
    return response.output_text;
  }
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('');
}

function createOpenAIService({
  apiKey,
  client,
  model = process.env.AGENTDESK_OPENAI_MODEL || 'gpt-4o',
  sleep = defaultSleep,
  onEvent = () => {}
} = {}) {
  function getClient() {
    if (client) return client;
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    return key ? createDefaultClient(key) : null;
  }

  function checkpoint(mode, request) {
    onEvent({
      type: 'openai.checkpoint',
      mode,
      model: request.model || model,
      at: new Date().toISOString()
    });
  }

  async function withRetries(mode, request, call) {
    const resolvedClient = getClient();
    if (!resolvedClient) {
      onEvent({ type: 'openai.invalid_key', at: new Date().toISOString() });
      return errorResult('OPENAI_KEY_MISSING', 'OPENAI_API_KEY is required for Phase 6 real OpenAI calls');
    }

    checkpoint(mode, request);
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await call(resolvedClient);
      } catch (error) {
        const status = getStatus(error);
        if (status === 401) {
          onEvent({ type: 'openai.invalid_key', at: new Date().toISOString() });
          return mapOpenAIError(error);
        }
        if (status === 429 && attempt < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[attempt];
          onEvent({ type: 'openai.retry', status, delayMs, attempt: attempt + 1 });
          await sleep(delayMs);
          continue;
        }
        return mapOpenAIError(error);
      }
    }

    return errorResult('OPENAI_RATE_LIMITED', 'OpenAI rate limit retries exhausted', { status: 429 });
  }

  async function createText(request = {}) {
    return withRetries('create', request, async (resolvedClient) => {
      const response = await resolvedClient.responses.create({
        model: request.model || model,
        instructions: request.instructions,
        input: request.input,
        text: request.text,
        reasoning: request.reasoning
      });

      return okResult({
        response,
        text: extractText(response),
        usage: normalizeUsage(response.usage)
      });
    });
  }

  async function streamText(request = {}) {
    return withRetries('stream', request, async (resolvedClient) => {
      const stream = await resolvedClient.responses.create({
        model: request.model || model,
        instructions: request.instructions,
        input: request.input,
        reasoning: request.reasoning,
        stream: true
      });

      let text = '';
      let usage = normalizeUsage();
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          text += event.delta || '';
          onEvent({ type: 'openai.delta', delta: event.delta || '' });
        }
        if (event.type === 'response.completed') {
          usage = normalizeUsage(event.response?.usage);
        }
      }

      return okResult({ text, usage });
    });
  }

  return {
    createText,
    streamText
  };
}

module.exports = {
  RETRY_DELAYS_MS,
  createOpenAIService,
  mapOpenAIError,
  normalizeUsage
};
