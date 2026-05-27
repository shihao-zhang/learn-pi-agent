const registry = new Map();

function registerTool(definition) {
  registry.set(definition.name, definition);
}

registerTool({
  name: "read",
  description: "Read a virtual file.",
  execute: async ({ path }) => virtualFiles[path] ?? `missing: ${path}`,
});

registerTool({
  name: "grep",
  description: "Search virtual files.",
  execute: async ({ pattern }) => {
    return Object.entries(virtualFiles)
      .filter(([, content]) => content.includes(pattern))
      .map(([path]) => path)
      .join("\n");
  },
});

const virtualFiles = {
  "README.md": "Pi is a minimal terminal coding harness.",
  "AGENTS.md": "Keep responses concise.",
};

async function dispatch(call) {
  const tool = registry.get(call.name);
  if (!tool) throw new Error(`Unknown tool: ${call.name}`);
  return tool.execute(call.input);
}

const calls = [
  { name: "read", input: { path: "README.md" } },
  { name: "grep", input: { pattern: "concise" } },
];

for (const call of calls) {
  console.log(`${call.name}:`);
  console.log(await dispatch(call));
}
