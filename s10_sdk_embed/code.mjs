class MockResourceLoader {
  constructor(resources = {}) {
    this.version = 1;
    this.resources = {
      contextFiles: ["AGENTS.md"],
      prompts: ["review-risk.md"],
      skills: ["product-spec-reader"],
      ...resources,
    };
  }

  async load() {
    return {
      version: this.version,
      ...this.resources,
    };
  }

  async reload(nextResources = {}) {
    this.version += 1;
    this.resources = {
      ...this.resources,
      ...nextResources,
    };
    return this.load();
  }
}

function createInMemorySessionManager() {
  let nextId = 1;
  const sessions = new Map();

  return {
    create({ cwd }) {
      const session = {
        id: `session-${String(nextId).padStart(3, "0")}`,
        cwd,
        entries: [],
      };
      nextId += 1;
      sessions.set(session.id, session);
      return session;
    },

    append(sessionId, entry) {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Unknown session: ${sessionId}`);
      session.entries.push(entry);
    },
  };
}

function defineTool({ name, description, schema, execute }) {
  if (!name || typeof execute !== "function") {
    throw new Error("Tool needs a name and execute function.");
  }

  return {
    name,
    description,
    schema,
    execute,
  };
}

function validateParams(schema, params) {
  for (const field of schema.required ?? []) {
    if (params[field] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  for (const [field, rule] of Object.entries(schema.properties ?? {})) {
    if (params[field] !== undefined && typeof params[field] !== rule.type) {
      throw new Error(`Field ${field} must be ${rule.type}.`);
    }
  }
}

async function createAgentSession({
  cwd = "/workspace/product-app",
  resourceLoader = new MockResourceLoader(),
  sessionManager = createInMemorySessionManager(),
  customTools = [],
} = {}) {
  const listeners = new Set();
  const tools = new Map(customTools.map((tool) => [tool.name, tool]));
  const sessionRecord = sessionManager.create({ cwd });
  const messages = [];
  const auditLog = [];
  let disposed = false;

  function emit(event) {
    auditLog.push(event);
    for (const listener of listeners) {
      listener(event);
    }
  }

  function appendMessage(message) {
    messages.push(message);
    sessionManager.append(sessionRecord.id, {
      type: "message",
      message,
    });
  }

  const session = {
    sessionId: sessionRecord.id,
    messages,
    auditLog,

    subscribe(listener) {
      if (disposed) throw new Error("Cannot subscribe to a disposed session.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async prompt(text) {
      if (disposed) throw new Error("Cannot prompt a disposed session.");

      const resources = await resourceLoader.load();
      appendMessage({ role: "user", content: text });

      emit({ type: "agent_start", sessionId: sessionRecord.id });
      emit({ type: "turn_start", sessionId: sessionRecord.id });
      emit({
        type: "message_start",
        message: { role: "assistant", content: "" },
      });
      emit({
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: `Loaded resources v${resources.version}; checking PRD-42. `,
        },
      });

      const tool = tools.get("lookup_product_spec");
      const args = { documentId: "PRD-42" };
      let toolResult;

      if (tool) {
        const toolCallId = "tool-call-001";
        emit({
          type: "tool_execution_start",
          toolCallId,
          toolName: tool.name,
          args,
        });

        try {
          validateParams(tool.schema, args);
          toolResult = await tool.execute(toolCallId, args, {
            sessionId: sessionRecord.id,
          });
          emit({
            type: "tool_execution_end",
            toolCallId,
            toolName: tool.name,
            result: toolResult,
            isError: false,
          });
        } catch (error) {
          toolResult = {
            content: [{ type: "text", text: error.message }],
            details: {},
          };
          emit({
            type: "tool_execution_end",
            toolCallId,
            toolName: tool.name,
            result: toolResult,
            isError: true,
          });
        }

        appendMessage({
          role: "tool",
          name: tool.name,
          content: toolResult.content[0].text,
        });
      }

      const answer =
        "PRD-42 risk summary: keep the SDK boundary explicit: session, loader, tools, and events.";
      appendMessage({ role: "assistant", content: answer });

      emit({
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: answer,
        },
      });
      emit({
        type: "message_end",
        message: { role: "assistant", content: answer },
      });
      emit({
        type: "turn_end",
        message: { role: "assistant", content: answer },
        toolResults: toolResult ? [toolResult] : [],
      });
      emit({
        type: "agent_end",
        messages: [...messages],
      });

      return { messages: [...messages] };
    },

    dispose() {
      disposed = true;
      listeners.clear();
    },
  };

  return {
    session,
    resourceLoader,
  };
}

function printEvent(event) {
  switch (event.type) {
    case "message_update":
      process.stdout.write(event.assistantMessageEvent.delta);
      break;
    case "tool_execution_start":
      console.log(`\n[event] ${event.type}: ${event.toolName} ${JSON.stringify(event.args)}`);
      break;
    case "tool_execution_end":
      console.log(`[event] ${event.type}: ${event.toolName} error=${event.isError}`);
      break;
    case "agent_start":
    case "turn_start":
    case "agent_end":
      console.log(`[event] ${event.type}`);
      break;
    case "turn_end":
      console.log(`\n[event] ${event.type}`);
      break;
  }
}

const lookupProductSpec = defineTool({
  name: "lookup_product_spec",
  description: "Return a product requirement summary by document id.",
  schema: {
    type: "object",
    properties: {
      documentId: {
        type: "string",
        description: "Internal product document id.",
      },
    },
    required: ["documentId"],
  },
  async execute(_toolCallId, params) {
    return {
      content: [
        {
          type: "text",
          text: `Spec ${params.documentId}: users need a clear learning path for SDK embedding.`,
        },
      ],
      details: {
        source: "mock-product-system",
      },
    };
  },
});

const { session, resourceLoader } = await createAgentSession({
  customTools: [lookupProductSpec],
});

const unsubscribe = session.subscribe(printEvent);

const reloaded = await resourceLoader.reload({
  prompts: ["review-risk.md", "sdk-smoke-test.md"],
});

console.log("resources:", reloaded);
console.log("prompt:");
await session.prompt("Read PRD-42 and propose SDK integration risks.");

unsubscribe();
session.dispose();

console.log("\n\nmessages:", session.messages);
console.log(
  "event summary:",
  session.auditLog.map((event) => event.type),
);
