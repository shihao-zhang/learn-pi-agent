const resources = {
  contextFiles: ["AGENTS.md: keep answers concise"],
  prompts: ["/review: review repository changes"],
  skills: ["repo-review: structured repository review workflow"],
};

const session = [];
const tools = new Map();
const hooks = [];

function registerTool(name, execute) {
  tools.set(name, execute);
}

function onToolCall(handler) {
  hooks.push(handler);
}

async function executeTool(call) {
  for (const hook of hooks) {
    const decision = await hook(call);
    if (decision?.block) {
      return `blocked: ${decision.reason}`;
    }
  }

  const tool = tools.get(call.name);
  if (!tool) return `unknown tool: ${call.name}`;
  return tool(call.input);
}

registerTool("read", async ({ path }) => `virtual content of ${path}`);
registerTool("bash", async ({ command }) => `virtual shell output: ${command}`);

onToolCall(async (call) => {
  if (call.name === "bash" && call.input.command.includes("rm -rf")) {
    return { block: true, reason: "dangerous command" };
  }
});

const scriptedTurn = {
  assistant: "I will read the README and avoid destructive commands.",
  toolCalls: [
    { id: "1", name: "read", input: { path: "README-zh.md" } },
    { id: "2", name: "bash", input: { command: "rm -rf dist" } },
  ],
};

session.push({ role: "system", content: resources });
session.push({ role: "user", content: "Review this learning repo." });
session.push({ role: "assistant", content: scriptedTurn.assistant });

for (const call of scriptedTurn.toolCalls) {
  session.push({
    role: "tool",
    tool_call_id: call.id,
    content: await executeTool(call),
  });
}

console.log(JSON.stringify(session, null, 2));
