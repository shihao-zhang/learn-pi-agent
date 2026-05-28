function createSessionManager() {
  const entries = [];
  let nextId = 1;
  let activeLeafId = null;

  return {
    append(entry) {
      const id = `e${String(nextId).padStart(3, "0")}`;
      nextId += 1;
      const fullEntry = {
        id,
        parentId: activeLeafId,
        timestamp: "2026-05-28T00:00:00.000Z",
        ...entry,
      };
      entries.push(fullEntry);
      activeLeafId = id;
      return fullEntry;
    },

    getEntries() {
      return [...entries];
    },
  };
}

function createMockHarness() {
  const tools = new Map();
  const toolCallHooks = [];
  const sessionManager = createSessionManager();
  const trace = [];

  function record(phase, subject, outcome) {
    trace.push({
      step: String(trace.length + 1).padStart(2, "0"),
      phase,
      subject,
      outcome,
    });
  }

  async function loadResources() {
    const resources = {
      contextFiles: [
        {
          path: "AGENTS.md",
          content: "面向人类 AI 产品经理，回复精炼；涉及 Pi 事实先核验官方资料。",
        },
      ],
      promptTemplates: [
        {
          name: "review",
          description: "审查当前变更，优先输出风险和缺失测试。",
        },
      ],
      skills: [
        {
          name: "repo-review",
          description: "Use when asked to inspect repository changes for correctness, safety, and product clarity.",
        },
      ],
      extensions: [
        {
          name: "protect-dangerous",
          hooks: ["tool_call"],
        },
      ],
      packages: [
        {
          name: "@example/pi-product-workflows",
          resources: ["prompts", "skills", "extensions"],
        },
      ],
    };

    record("resources", "loadResources", "loaded context/prompts/skills/extensions/packages");
    return resources;
  }

  function assembleSystemPrompt(resources) {
    const context = resources.contextFiles
      .map((file) => `- ${file.path}: ${file.content}`)
      .join("\n");
    const prompts = resources.promptTemplates
      .map((template) => `- /${template.name}: ${template.description}`)
      .join("\n");
    const skills = resources.skills
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join("\n");
    const packages = resources.packages
      .map((pkg) => `- ${pkg.name}: ${pkg.resources.join(", ")}`)
      .join("\n");

    const systemPrompt = [
      "You are running inside a teaching mock harness.",
      "",
      "Context files:",
      context,
      "",
      "Prompt templates:",
      prompts,
      "",
      "Skill catalog:",
      skills,
      "",
      "Package resources:",
      packages,
      "",
      "Safety: tool calls must pass runtime hooks before execution.",
    ].join("\n");

    record("prompt", "assembleSystemPrompt", `${systemPrompt.split("\n").length} lines`);
    return systemPrompt;
  }

  function registerTool(name, definition) {
    if (!name || typeof definition?.execute !== "function") {
      throw new Error("registerTool(name, definition) requires an execute function.");
    }
    tools.set(name, {
      description: "",
      required: [],
      ...definition,
      name,
    });
    record("tool", name, "registered");
  }

  function onToolCall(handler) {
    if (typeof handler !== "function") {
      throw new Error("onToolCall(handler) requires a function.");
    }
    toolCallHooks.push(handler);
    record("hook", "tool_call", "registered");
  }

  function validateInput(tool, input) {
    const missing = tool.required.filter((field) => input[field] === undefined);
    if (missing.length > 0) {
      return `missing required field(s): ${missing.join(", ")}`;
    }
    return null;
  }

  async function dispatchToolCall(call) {
    record("dispatch", call.name, `requested ${JSON.stringify(call.input)}`);

    for (const hook of toolCallHooks) {
      const decision = await hook(call);
      if (decision?.block) {
        record("permission", call.name, `blocked: ${decision.reason}`);
        return {
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          ok: false,
          content: `blocked: ${decision.reason}`,
          details: {
            decision: "block",
            source: decision.source,
          },
        };
      }
    }

    const tool = tools.get(call.name);
    if (!tool) {
      record("dispatch", call.name, "unknown tool");
      return {
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        ok: false,
        content: `unknown tool: ${call.name}`,
      };
    }

    const validationError = validateInput(tool, call.input ?? {});
    if (validationError) {
      record("validation", call.name, validationError);
      return {
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        ok: false,
        content: validationError,
      };
    }

    const result = await tool.execute(call.input ?? {});
    record("execute", call.name, "ok");
    return {
      role: "tool",
      tool_call_id: call.id,
      name: call.name,
      ok: true,
      content: result.content,
      details: result.details ?? {},
    };
  }

  async function runTurn(userText) {
    const resources = await loadResources();
    const systemPrompt = assembleSystemPrompt(resources);

    const systemEntry = sessionManager.append({
      type: "message",
      role: "system",
      content: systemPrompt,
    });
    record("session", systemEntry.id, "append system prompt");

    const userEntry = sessionManager.append({
      type: "message",
      role: "user",
      content: userText,
    });
    record("session", userEntry.id, "append user message");

    const assistantPlan = {
      role: "assistant",
      content: "先读项目说明，再写一条项目笔记；危险清理命令必须交给权限 hook 判断。",
      toolCalls: [
        { id: "call-001", name: "read", input: { path: "README-zh.md" } },
        { id: "call-002", name: "project_note", input: { text: "s12 汇总的是 mock harness 架构，不是 Pi 内部源码。" } },
        { id: "call-003", name: "bash", input: { command: "rm -rf dist" } },
      ],
    };

    const assistantEntry = sessionManager.append({
      type: "message",
      role: "assistant",
      content: assistantPlan.content,
      toolCalls: assistantPlan.toolCalls,
    });
    record("session", assistantEntry.id, "append assistant tool calls");

    const toolResults = [];
    for (const call of assistantPlan.toolCalls) {
      const result = await dispatchToolCall(call);
      toolResults.push(result);
      const toolEntry = sessionManager.append({
        type: "message",
        role: "tool",
        tool_call_id: result.tool_call_id,
        name: result.name,
        ok: result.ok,
        content: result.content,
        details: result.details,
      });
      record("session", toolEntry.id, `append ${result.name} result`);
    }

    const finalText = [
      "本轮完成：资源已加载，系统提示词已组装，两个安全工具调用已执行。",
      "危险 bash 被 hook 拦截，并作为 tool result 写回 session。",
    ].join(" ");

    const finalEntry = sessionManager.append({
      type: "message",
      role: "assistant",
      content: finalText,
    });
    record("session", finalEntry.id, "append final assistant message");

    return {
      systemPrompt,
      toolResults,
      finalText,
      sessionEntries: sessionManager.getEntries(),
      trace: [...trace],
    };
  }

  return {
    loadResources,
    assembleSystemPrompt,
    registerTool,
    onToolCall,
    runTurn,
    sessionManager,
    trace,
  };
}

const harness = createMockHarness();

harness.registerTool("read", {
  description: "Read a virtual project file.",
  required: ["path"],
  async execute({ path }) {
    return {
      content: `virtual content from ${path}: Pi 是一个可扩展的 terminal coding harness。`,
      details: { source: "virtual-workspace" },
    };
  },
});

harness.registerTool("bash", {
  description: "Run a virtual shell command.",
  required: ["command"],
  async execute({ command }) {
    return {
      content: `virtual shell output for: ${command}`,
      details: { exitCode: 0 },
    };
  },
});

harness.registerTool("project_note", {
  description: "Store a short product or architecture note.",
  required: ["text"],
  async execute({ text }) {
    return {
      content: `note saved: ${text}`,
      details: { kind: "architecture-note" },
    };
  },
});

harness.onToolCall(async (call) => {
  if (call.name === "bash" && /\brm\s+-rf\b/.test(call.input?.command ?? "")) {
    return {
      block: true,
      reason: "destructive shell command requires human approval",
      source: "protect-dangerous mock extension",
    };
  }
  return { allow: true };
});

const result = await harness.runTurn("把前 11 章汇总成一个完整 mock harness。");

console.log("=== final answer ===");
console.log(result.finalText);

console.log("\n=== tool results ===");
console.log(JSON.stringify(result.toolResults, null, 2));

console.log("\n=== session entries ===");
console.log(JSON.stringify(result.sessionEntries, null, 2));

console.log("\n=== trace table ===");
console.table(result.trace);
