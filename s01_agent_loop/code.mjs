const tools = {
  bash: async ({ command }) => {
    if (command === "pwd") return process.cwd();
    return `demo blocked command: ${command}`;
  },
};

const scriptedModel = [
  {
    text: "I need to inspect the working directory.",
    toolCalls: [{ id: "call-1", name: "bash", input: { command: "pwd" } }],
  },
  {
    text: "The harness gave me the directory. I can now answer.",
    toolCalls: [],
  },
];

const messages = [{ role: "user", content: "Where am I running?" }];

for (const response of scriptedModel) {
  messages.push({ role: "assistant", content: response.text });

  if (response.toolCalls.length === 0) break;

  const results = [];
  for (const call of response.toolCalls) {
    const handler = tools[call.name];
    if (!handler) throw new Error(`Unknown tool: ${call.name}`);
    results.push({
      type: "tool_result",
      tool_call_id: call.id,
      content: await handler(call.input),
    });
  }

  messages.push({ role: "user", content: results });
}

console.log(JSON.stringify(messages, null, 2));
