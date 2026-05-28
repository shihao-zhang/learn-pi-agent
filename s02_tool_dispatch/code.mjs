const registry = new Map();
let activeTools = new Set();

const virtualFiles = {
  "README.md": "Pi is a minimal terminal coding harness.",
  "AGENTS.md": "Keep responses concise.",
};

function text(content) {
  return { ok: true, content: [{ type: "text", text: String(content) }] };
}

function failure(code, message, details = {}) {
  return { ok: false, error: { code, message, ...details } };
}

function registerTool(definition) {
  const requiredFields = ["name", "description", "parameters", "handler"];
  for (const field of requiredFields) {
    if (!definition[field]) {
      throw new Error(`Tool definition missing field: ${field}`);
    }
  }

  if (registry.has(definition.name)) {
    throw new Error(`Tool already registered: ${definition.name}`);
  }

  registry.set(definition.name, definition);
}

function setActiveTools(names) {
  for (const name of names) {
    if (!registry.has(name)) {
      throw new Error(`Cannot activate unknown tool: ${name}`);
    }
  }

  activeTools = new Set(names);
}

function validateParameters(schema, input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failure("validation_error", "Tool input must be an object.");
  }

  for (const [name, rule] of Object.entries(schema)) {
    const value = input[name];

    if (rule.required && value === undefined) {
      return failure("validation_error", `Missing required parameter: ${name}`);
    }

    if (value === undefined) continue;

    if (rule.type && typeof value !== rule.type) {
      return failure(
        "validation_error",
        `Parameter ${name} must be ${rule.type}.`,
        { parameter: name },
      );
    }

    if (rule.enum && !rule.enum.includes(value)) {
      return failure(
        "validation_error",
        `Parameter ${name} must be one of: ${rule.enum.join(", ")}`,
        { parameter: name },
      );
    }
  }

  const unknown = Object.keys(input).find((name) => !schema[name]);
  if (unknown) {
    return failure("validation_error", `Unknown parameter: ${unknown}`);
  }

  return { ok: true };
}

async function checkPermission(tool, params, context) {
  if (!tool.permission) return { effect: "allow" };

  const decision =
    typeof tool.permission === "function"
      ? await tool.permission(params, context)
      : tool.permission;

  if (decision === "allow") return { effect: "allow" };
  if (decision === "block") {
    return { effect: "block", reason: "Blocked by tool policy." };
  }

  return decision;
}

async function dispatch(call, context = {}) {
  const tool = registry.get(call.name);
  if (!tool) {
    return failure("unknown_tool", `Unknown tool: ${call.name}`, {
      tool: call.name,
    });
  }

  if (!activeTools.has(call.name)) {
    return failure("inactive_tool", `Tool is not active: ${call.name}`, {
      tool: call.name,
    });
  }

  const validation = validateParameters(tool.parameters, call.input ?? {});
  if (!validation.ok) return validation;

  const permission = await checkPermission(tool, call.input, context);
  if (permission.effect === "block") {
    return failure("permission_denied", permission.reason, { tool: call.name });
  }

  try {
    const result = await tool.handler(call.input, context);
    return text(result);
  } catch (error) {
    return failure("handler_error", error.message, { tool: call.name });
  }
}

function resultToText(result) {
  if (result.ok) {
    return result.content.map((part) => part.text).join("\n");
  }

  return `${result.error.code}: ${result.error.message}`;
}

registerTool({
  name: "read",
  description: "Read a virtual file by path.",
  parameters: {
    path: {
      type: "string",
      required: true,
      description: "Virtual file path.",
    },
  },
  handler: async ({ path }) => {
    if (!(path in virtualFiles)) {
      throw new Error(`File not found: ${path}`);
    }

    return virtualFiles[path];
  },
});

registerTool({
  name: "grep",
  description: "Search virtual files for a text pattern.",
  parameters: {
    pattern: {
      type: "string",
      required: true,
      description: "Text to search for.",
    },
  },
  handler: async ({ pattern }) => {
    const matches = Object.entries(virtualFiles)
      .filter(([, content]) => content.includes(pattern))
      .map(([path]) => path);

    return matches.length ? matches.join("\n") : "(no matches)";
  },
});

registerTool({
  name: "write",
  description: "Write a virtual file.",
  parameters: {
    path: {
      type: "string",
      required: true,
      description: "Virtual file path.",
    },
    content: {
      type: "string",
      required: true,
      description: "New file content.",
    },
  },
  permission: ({ path }) => {
    if (path.endsWith(".env")) {
      return { effect: "block", reason: "Refusing to write secret files." };
    }

    return { effect: "allow" };
  },
  handler: async ({ path, content }) => {
    virtualFiles[path] = content;
    return `wrote ${path}`;
  },
});

setActiveTools(["read", "grep"]);

const calls = [
  { name: "read", input: { path: "README.md" } },
  { name: "grep", input: { pattern: "concise" } },
  { name: "write", input: { path: "notes.md", content: "Draft" } },
  { name: "read", input: {} },
  { name: "missing", input: {} },
];

for (const call of calls) {
  const result = await dispatch(call);
  console.log(`${call.name}: ${resultToText(result)}`);
}

console.log("\nActivating write...");
setActiveTools(["read", "grep", "write"]);

const protectedWrite = await dispatch({
  name: "write",
  input: { path: ".env", content: "TOKEN=<redacted-token>" },
});
console.log(`write .env: ${resultToText(protectedWrite)}`);

const allowedWrite = await dispatch({
  name: "write",
  input: { path: "notes.md", content: "Tools should return stable shapes." },
});
console.log(`write notes.md: ${resultToText(allowedWrite)}`);

const readBack = await dispatch({ name: "read", input: { path: "notes.md" } });
console.log(`read notes.md: ${resultToText(readBack)}`);
