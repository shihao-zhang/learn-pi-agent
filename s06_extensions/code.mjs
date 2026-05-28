class MockPiRuntime {
  constructor({ confirmPolicy } = {}) {
    this.handlers = new Map();
    this.tools = new Map();
    this.commands = new Map();
    this.auditLog = [];
    this.confirmPolicy =
      confirmPolicy ?? (({ message }) => !message.includes("rm -rf"));

    this.registerTool({
      name: "bash",
      label: "Bash",
      description: "Run a shell command",
      async execute(_toolCallId, input) {
        return {
          content: [{ type: "text", text: `mock shell ran: ${input.command}` }],
          details: { exitCode: 0 },
        };
      },
    });
  }

  get api() {
    return {
      on: (eventName, handler) => this.on(eventName, handler),
      registerTool: (definition) => this.registerTool(definition),
      registerCommand: (name, definition) =>
        this.registerCommand(name, definition),
    };
  }

  on(eventName, handler) {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  registerTool(definition) {
    if (!definition?.name || typeof definition.execute !== "function") {
      throw new Error("tool definition requires name and execute()");
    }
    this.tools.set(definition.name, definition);
  }

  registerCommand(name, definition) {
    if (!name || typeof definition?.handler !== "function") {
      throw new Error("command definition requires name and handler()");
    }
    this.commands.set(name, definition);
  }

  createContext() {
    return {
      cwd: "/repo",
      auditLog: this.auditLog,
      ui: {
        confirm: async (title, message) => {
          const ok = await this.confirmPolicy({ title, message });
          console.log(`confirm: ${title} -> ${ok ? "allow" : "deny"}`);
          return ok;
        },
        notify: (message, level = "info") => {
          console.log(`notify[${level}]: ${message}`);
        },
      },
    };
  }

  async emit(eventName, event) {
    const ctx = this.createContext();
    let patch = {};

    for (const handler of this.handlers.get(eventName) ?? []) {
      const result = await handler(event, ctx);
      if (result?.block) return result;
      if (result && typeof result === "object") {
        patch = { ...patch, ...result };
      }
    }

    return { block: false, ...patch };
  }

  async runCommand(line) {
    const [name, ...rest] = line.replace(/^\//, "").split(" ");
    const command = this.commands.get(name);
    if (!command) throw new Error(`unknown command: /${name}`);

    await command.handler(rest.join(" "), this.createContext());
  }

  async callTool(toolName, input) {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`unknown tool: ${toolName}`);

    const toolCallId = `call_${this.auditLog.length + 1}`;
    const event = { toolCallId, toolName, input: { ...input } };
    const prehook = await this.emit("tool_call", event);

    if (prehook.block) {
      const blocked = {
        content: [{ type: "text", text: prehook.reason }],
        details: { blocked: true },
        isError: true,
      };
      this.auditLog.push({ toolCallId, toolName, status: "blocked" });
      return blocked;
    }

    let result = await tool.execute(
      toolCallId,
      event.input,
      new AbortController().signal,
      () => {},
      this.createContext(),
    );

    const posthook = await this.emit("tool_result", {
      ...event,
      content: result.content,
      details: result.details ?? {},
      isError: Boolean(result.isError),
    });

    result = {
      ...result,
      content: posthook.content ?? result.content,
      details: posthook.details ?? result.details,
      isError: posthook.isError ?? result.isError,
    };

    this.auditLog.push({ toolCallId, toolName, status: "completed" });
    return result;
  }
}

function protectDangerousExtension(pi) {
  pi.registerCommand("safety", {
    description: "Show active safety rules",
    async handler(_args, ctx) {
      ctx.ui.notify("Active rules: confirm rm -rf, sudo, and .env writes");
    },
  });

  pi.registerTool({
    name: "project_note",
    label: "Project Note",
    description: "Record a short project note for the current session",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      const text = String(params.text ?? "").trim();
      return {
        content: [{ type: "text", text: `note saved in ${ctx.cwd}: ${text}` }],
        details: { noteId: toolCallId, text },
      };
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    const dangerous = /\brm\s+-rf\b|\bsudo\b|>\s*\.env\b/.test(command);
    if (!dangerous) return;

    const ok = await ctx.ui.confirm(
      "Dangerous command",
      `Allow this command?\n\n${command}`,
    );

    if (!ok) {
      return { block: true, reason: "blocked by protectDangerousExtension" };
    }
  });

  pi.on("tool_result", async (event) => {
    return {
      details: {
        ...event.details,
        audit: {
          reviewedBy: "protectDangerousExtension",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
        },
      },
    };
  });
}

function printResult(label, result) {
  const text = result.content.map((item) => item.text).join("\n");
  console.log(`${label}: ${result.isError ? "ERROR" : "OK"} - ${text}`);
  console.log(`details: ${JSON.stringify(result.details)}`);
}

const runtime = new MockPiRuntime();
protectDangerousExtension(runtime.api);

await runtime.runCommand("/safety");

printResult(
  "safe bash",
  await runtime.callTool("bash", { command: "npm test" }),
);

printResult(
  "dangerous bash",
  await runtime.callTool("bash", { command: "rm -rf node_modules" }),
);

printResult(
  "custom tool",
  await runtime.callTool("project_note", {
    text: "Extensions turn project policy into runtime behavior.",
  }),
);
