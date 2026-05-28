const tools = [
  {
    type: "function",
    name: "read_file",
    description: "Read one project file",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const builtInModels = [
  {
    provider: "anthropic",
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    authEnv: "ANTHROPIC_API_KEY",
    compat: {
      supportsTools: true,
      supportsStrictMode: false,
      supportsReasoningEffort: true,
      cacheControlFormat: "anthropic",
    },
  },
  {
    provider: "openai",
    id: "gpt-5.1",
    name: "GPT-5.1",
    api: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
    authEnv: "OPENAI_API_KEY",
    compat: {
      supportsTools: true,
      supportsStrictMode: true,
      supportsReasoningEffort: true,
      supportsDeveloperRole: true,
    },
  },
];

const customModelsJson = {
  providers: {
    "local-openai": {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      apiKey: "LOCAL_LLM_KEY",
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
        supportsUsageInStreaming: false,
        maxTokensField: "max_tokens",
      },
      models: [
        {
          id: "qwen2.5-coder:7b",
          name: "Qwen Coder 7B Local",
          reasoning: false,
          input: ["text"],
          compat: { supportsTools: false, supportsStrictMode: false },
        },
      ],
    },
  },
};

class AuthStore {
  constructor({ runtime = {}, authFile = {}, env = {}, modelsJson = {} }) {
    this.runtime = runtime;
    this.authFile = authFile;
    this.env = env;
    this.modelsJson = modelsJson;
  }

  resolve(model) {
    const provider = model.provider;
    if (this.runtime[provider]) {
      return { source: "runtime", value: redact(this.runtime[provider]) };
    }

    if (this.authFile[provider]?.key) {
      return { source: "auth.json", value: redact(this.authFile[provider].key) };
    }

    if (model.authEnv && this.env[model.authEnv]) {
      return { source: `env:${model.authEnv}`, value: redact(this.env[model.authEnv]) };
    }

    const providerConfig = this.modelsJson.providers?.[provider];
    if (providerConfig?.apiKey) {
      const key = providerConfig.apiKey;
      const value = this.env[key] ?? key;
      const source = this.env[key] ? `models.json env:${key}` : "models.json literal";
      return { source, value: redact(value) };
    }

    return undefined;
  }
}

class ModelRegistry {
  constructor({ builtIns, customConfig, authStore }) {
    this.authStore = authStore;
    this.models = [
      ...builtIns.map((model) => ({ ...model, source: "built-in" })),
      ...modelsFromCustomConfig(customConfig),
    ];
  }

  find(provider, id) {
    return this.models.find((model) => model.provider === provider && model.id === id);
  }

  getAvailable() {
    return this.models
      .map((model) => ({ ...model, auth: this.authStore.resolve(model) }))
      .filter((model) => model.auth);
  }
}

function modelsFromCustomConfig(config) {
  return Object.entries(config.providers ?? {}).flatMap(([provider, providerConfig]) =>
    (providerConfig.models ?? []).map((model) => ({
      provider,
      id: model.id,
      name: model.name ?? model.id,
      api: model.api ?? providerConfig.api,
      baseUrl: providerConfig.baseUrl,
      authEnv: providerConfig.apiKey,
      input: model.input ?? ["text"],
      reasoning: Boolean(model.reasoning),
      compat: { ...(providerConfig.compat ?? {}), ...(model.compat ?? {}) },
      source: "models.json",
    })),
  );
}

function redact(value) {
  if (!value) return "<missing>";
  return `${String(value).slice(0, 6)}...`;
}

function textBlock(text) {
  return { type: "text", text };
}

const canonicalMessages = [
  { role: "system", content: [textBlock("You are a concise coding agent.")] },
  { role: "user", content: [textBlock("Summarize README.md and mention risks.")] },
  {
    role: "assistant",
    content: [
      textBlock("I will inspect the file first."),
      { type: "tool_call", id: "call_read_1", name: "read_file", input: { path: "README.md" } },
    ],
  },
  {
    role: "tool",
    toolCallId: "call_read_1",
    toolName: "read_file",
    content: [textBlock("# Learn Pi Agent\nA Chinese learning repo for Pi harness mechanics.")],
    isError: false,
  },
];

const providerAdapters = {
  "anthropic-messages": {
    toRequest(model, messages, activeTools) {
      return {
        method: "POST",
        url: `${model.baseUrl}/v1/messages`,
        headers: { "x-api-key": "<resolved>", "anthropic-version": "2023-06-01" },
        body: {
          model: model.id,
          system: systemText(messages),
          messages: messages.filter((message) => message.role !== "system").map(toAnthropicMessage),
          tools: compatTools(model, activeTools),
        },
      };
    },
  },
  "openai-responses": {
    toRequest(model, messages, activeTools) {
      return {
        method: "POST",
        url: `${model.baseUrl}/responses`,
        headers: { authorization: "Bearer <resolved>" },
        body: {
          model: model.id,
          input: messages.flatMap(toResponsesInput),
          tools: compatTools(model, activeTools),
          reasoning: model.compat.supportsReasoningEffort ? { effort: "medium" } : undefined,
        },
      };
    },
  },
  "openai-completions": {
    toRequest(model, messages, activeTools) {
      const maxTokensField = model.compat.maxTokensField ?? "max_completion_tokens";
      return {
        method: "POST",
        url: `${model.baseUrl}/chat/completions`,
        headers: { authorization: "Bearer <resolved>" },
        body: {
          model: model.id,
          messages: messages.map(toChatCompletionMessage),
          tools: compatTools(model, activeTools),
          [maxTokensField]: 2048,
        },
      };
    },
  },
};

function systemText(messages) {
  return messages
    .filter((message) => message.role === "system")
    .flatMap((message) => message.content)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function textContent(message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function toAnthropicMessage(message) {
  if (message.role === "tool") {
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: textContent(message) }],
    };
  }

  return {
    role: message.role,
    content: message.content.map((block) =>
      block.type === "tool_call"
        ? { type: "tool_use", id: block.id, name: block.name, input: block.input }
        : block,
    ),
  };
}

function toResponsesInput(message) {
  if (message.role === "tool") {
    return { type: "function_call_output", call_id: message.toolCallId, output: textContent(message) };
  }

  const items = [];
  const text = textContent(message);
  if (text) {
    items.push({
      role: message.role === "system" ? "developer" : message.role,
      content: text,
    });
  }

  for (const toolCall of message.content.filter((block) => block.type === "tool_call")) {
    items.push({
      type: "function_call",
      call_id: toolCall.id,
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.input),
    });
  }

  return items.length === 1 ? items[0] : items;
}

function toChatCompletionMessage(message) {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      name: message.toolName,
      content: textContent(message),
    };
  }

  const toolCalls = message.content
    .filter((block) => block.type === "tool_call")
    .map((block) => ({
      id: block.id,
      type: "function",
      function: { name: block.name, arguments: JSON.stringify(block.input) },
    }));

  return {
    role: message.role,
    content: textContent(message),
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

function compatTools(model, activeTools) {
  if (model.compat.supportsTools === false) return undefined;

  return activeTools.map((tool) => {
    if (model.compat.supportsStrictMode === false) {
      const { strict: _strict, ...looseTool } = tool;
      return looseTool;
    }
    return tool;
  });
}

function appendEntry(session, entry) {
  const parent = session.at(-1);
  const id = `e${String(session.length).padStart(2, "0")}`;
  session.push({
    id,
    parentId: parent?.id ?? null,
    timestamp: `2026-05-28T08:${String(session.length).padStart(2, "0")}:00.000Z`,
    ...entry,
  });
}

function appendMessage(session, message) {
  appendEntry(session, { type: "message", message });
}

function appendModelChange(session, model, reason) {
  appendEntry(session, {
    type: "model_change",
    provider: model.provider,
    modelId: model.id,
    api: model.api,
    reason,
  });
}

function buildSessionContext(session) {
  const currentModelEntry = session.findLast((entry) => entry.type === "model_change");
  return {
    currentModel: currentModelEntry
      ? `${currentModelEntry.provider}/${currentModelEntry.modelId}`
      : "unknown",
    messages: session.filter((entry) => entry.type === "message").map((entry) => entry.message),
  };
}

function printWireRequest(title, request) {
  const compact = {
    url: request.url,
    model: request.body.model,
    inputShape: request.body.messages ? "messages[]" : "input[]",
    toolCount: request.body.tools?.length ?? 0,
    compatNote: request.body.tools ? "tools enabled" : "tools omitted by compat",
  };
  console.log(`${title}: ${JSON.stringify(compact)}`);
}

const authStore = new AuthStore({
  authFile: { anthropic: { type: "api_key", key: "<mock-anthropic-key>" } },
  env: { OPENAI_API_KEY: "<mock-openai-key>", LOCAL_LLM_KEY: "<mock-local-key>" },
  modelsJson: customModelsJson,
});

const registry = new ModelRegistry({
  builtIns: builtInModels,
  customConfig: customModelsJson,
  authStore,
});

const available = registry.getAvailable();
console.log("available models:");
for (const model of available) {
  console.log(`- ${model.provider}/${model.id} via ${model.api} auth=${model.auth.source}`);
}

const session = [{ type: "session", id: "s08", parentId: null, timestamp: "2026-05-28T08:00:00.000Z" }];
const firstModel = registry.find("anthropic", "claude-sonnet-4-6");
const secondModel = registry.find("local-openai", "qwen2.5-coder:7b");

appendModelChange(session, firstModel, "initial model for repo reading");
for (const message of canonicalMessages) appendMessage(session, message);
appendModelChange(session, secondModel, "switch to local draft model");

console.log("\nmodel_change entries:");
for (const entry of session.filter((item) => item.type === "model_change")) {
  console.log(`- ${entry.provider}/${entry.modelId} (${entry.reason})`);
}

console.log("\nwire requests:");
for (const model of [firstModel, registry.find("openai", "gpt-5.1"), secondModel]) {
  const request = providerAdapters[model.api].toRequest(model, canonicalMessages, tools);
  printWireRequest(`${model.provider}/${model.id}`, request);
}

const context = buildSessionContext(session);
console.log(`\nsession context: model=${context.currentModel}, messages=${context.messages.length}`);
