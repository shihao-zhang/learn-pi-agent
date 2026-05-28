const workspace = new Map([
  ["README.md", "# Learn Pi Agent\n\nA tiny teaching repo for agent loops.\n"],
  ["notes/todo.md", "- Explain messages\n- Explain tool calls\n"],
]);

const toolRegistry = new Map();

function registerTool(name, handler) {
  toolRegistry.set(name, handler);
}

function normalizePath(path) {
  return String(path ?? "").replace(/^@/, "");
}

function makeToolResult(call, result) {
  return {
    type: "tool_result",
    tool_call_id: call.id,
    tool_name: call.name,
    isError: Boolean(result.isError),
    content: result.content,
    details: result.details ?? {},
  };
}

async function executeTool(call) {
  const handler = toolRegistry.get(call.name);

  if (!handler) {
    return makeToolResult(call, {
      isError: true,
      content: `unknown tool: ${call.name}`,
    });
  }

  try {
    const result = await handler(call.input ?? {});
    return makeToolResult(call, result);
  } catch (error) {
    return makeToolResult(call, {
      isError: true,
      content: error instanceof Error ? error.message : String(error),
    });
  }
}

registerTool("read", async ({ path }) => {
  const filePath = normalizePath(path);
  if (!workspace.has(filePath)) {
    return { isError: true, content: `missing file: ${filePath}` };
  }

  return {
    content: workspace.get(filePath),
    details: { path: filePath },
  };
});

registerTool("write", async ({ path, content }) => {
  const filePath = normalizePath(path);
  workspace.set(filePath, String(content ?? ""));

  return {
    content: `wrote ${filePath}`,
    details: { path: filePath, bytes: workspace.get(filePath).length },
  };
});

registerTool("edit", async ({ path, oldText, newText }) => {
  const filePath = normalizePath(path);
  const current = workspace.get(filePath);

  if (current === undefined) {
    return { isError: true, content: `missing file: ${filePath}` };
  }

  if (!current.includes(oldText)) {
    return { isError: true, content: `text not found in ${filePath}` };
  }

  const next = current.replace(oldText, newText);
  workspace.set(filePath, next);

  return {
    content: `edited ${filePath}`,
    details: { path: filePath, bytes: next.length },
  };
});

registerTool("bash", async ({ command }) => {
  if (command === "pwd") {
    return {
      content: process.cwd(),
      details: { exitCode: 0, blocked: false },
    };
  }

  if (command === "npm run check") {
    return {
      content: "demo only: would run npm run check",
      details: { exitCode: 0, blocked: false },
    };
  }

  return {
    isError: true,
    content: `blocked command: ${command}`,
    details: { exitCode: 126, blocked: true },
  };
});

const scriptedResponses = [
  {
    text: "I need facts first, so I will read the project note and inspect cwd.",
    toolCalls: [
      { id: "call-1", name: "read", input: { path: "README.md" } },
      { id: "call-2", name: "bash", input: { command: "pwd" } },
    ],
  },
  {
    text: "I have enough context to draft and improve a tiny note.",
    toolCalls: [
      {
        id: "call-3",
        name: "write",
        input: {
          path: "notes/loop.md",
          content: "Agent loop = model asks, harness acts, result returns.\n",
        },
      },
      {
        id: "call-4",
        name: "edit",
        input: {
          path: "notes/loop.md",
          oldText: "result returns",
          newText: "tool result returns to messages",
        },
      },
    ],
  },
  {
    text: "I will demonstrate failure paths: one blocked command and one unregistered tool.",
    toolCalls: [
      { id: "call-5", name: "bash", input: { command: "rm -rf dist" } },
      { id: "call-6", name: "search", input: { query: "agent loop" } },
    ],
  },
  {
    text: "The loop handled success, blocked command, and unknown tool. I can now stop.",
    toolCalls: [],
  },
];

async function scriptedModel({ turn }) {
  return scriptedResponses[turn - 1] ?? { text: "No more work.", toolCalls: [] };
}

async function loopingModel({ turn }) {
  return {
    text: `Turn ${turn}: I keep asking for one more read.`,
    toolCalls: [
      { id: `loop-${turn}`, name: "read", input: { path: "notes/todo.md" } },
    ],
  };
}

async function runAgent({ userPrompt, model, maxTurns }) {
  const messages = [{ role: "user", content: userPrompt }];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const response = await model({ messages, turn });
    messages.push({
      role: "assistant",
      content: response.text,
      tool_calls: response.toolCalls,
    });

    if (response.toolCalls.length === 0) {
      return {
        status: "completed",
        stopReason: "no_tool_calls",
        turns: turn,
        messages,
      };
    }

    const toolResults = [];
    for (const call of response.toolCalls) {
      toolResults.push(await executeTool(call));
    }

    messages.push({ role: "tool_results", content: toolResults });
  }

  return {
    status: "stopped",
    stopReason: "max_turns",
    turns: maxTurns,
    messages,
  };
}

const completed = await runAgent({
  userPrompt: "Explain the agent loop with evidence from this workspace.",
  model: scriptedModel,
  maxTurns: 6,
});

const capped = await runAgent({
  userPrompt: "Show why maxTurns is a necessary guard.",
  model: loopingModel,
  maxTurns: 2,
});

console.log(
  JSON.stringify(
    {
      completed,
      capped,
      finalWorkspace: Object.fromEntries(workspace),
    },
    null,
    2,
  ),
);
