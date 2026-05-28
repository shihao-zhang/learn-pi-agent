import path from "node:path";

const ACTIONS = new Set(["allow", "ask", "block"]);

class PermissionDecision {
  constructor(action, reason, options = {}) {
    if (!ACTIONS.has(action)) {
      throw new Error(`Unknown permission action: ${action}`);
    }
    this.action = action;
    this.reason = reason;
    this.rule = options.rule ?? "default";
    this.details = options.details ?? {};
  }

  static allow(reason, options) {
    return new PermissionDecision("allow", reason, options);
  }

  static ask(reason, options) {
    return new PermissionDecision("ask", reason, options);
  }

  static block(reason, options) {
    return new PermissionDecision("block", reason, options);
  }
}

const mutatingTools = new Set(["write", "edit"]);
const pathTools = new Set(["read", "write", "edit"]);

const credentialPatterns = [
  /(^|[/\\])\.env($|[./\\])/,
  /(^|[/\\])\.npmrc$/,
  /(^|[/\\])\.pypirc$/,
  /(^|[/\\])id_rsa$/,
  /(^|[/\\])credentials\.json$/,
  /(^|[/\\])secrets?($|[./\\])/i,
];

const dangerousShellPatterns = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bcurl\b.+\|\s*(sh|bash)\b/,
  /\bwget\b.+\|\s*(sh|bash)\b/,
];

const readonlyShellAllowList = [
  /^pwd$/,
  /^ls(\s|$)/,
  /^rg(\s|$)/,
  /^cat\s+[\w./-]+$/,
  /^node\s+--version$/,
];

function resolveTargetPath(call, context) {
  const rawPath = call.input?.path;
  if (typeof rawPath !== "string") return null;
  return path.resolve(context.workspaceRoot, rawPath);
}

function isInsideWorkspace(targetPath, context) {
  const root = path.resolve(context.workspaceRoot);
  return targetPath === root || targetPath.startsWith(`${root}${path.sep}`);
}

function looksLikeCredentialPath(targetPath) {
  return credentialPatterns.some((pattern) => pattern.test(targetPath));
}

function commandLooksDangerous(command) {
  return dangerousShellPatterns.some((pattern) => pattern.test(command));
}

function commandTouchesCredentials(command) {
  return /(^|[\s"'=])\.env($|[\s"'])|id_rsa\b|credentials\.json\b|\.npmrc\b|secret/i.test(command);
}

function isReadonlyShellCommand(command) {
  return readonlyShellAllowList.some((pattern) => pattern.test(command.trim()));
}

function summarizeCall(call) {
  if (call.name === "bash") return `bash "${call.input.command}"`;
  if (pathTools.has(call.name)) return `${call.name} ${call.input.path}`;
  return call.name;
}

function preflightDecision(call, context) {
  const targetPath = resolveTargetPath(call, context);
  const command = String(call.input?.command ?? "");

  if (context.readonly && mutatingTools.has(call.name)) {
    return PermissionDecision.block("readonly mode blocks file mutation", {
      rule: "readonly-file-mutation",
    });
  }

  if (context.readonly && call.name === "bash" && !isReadonlyShellCommand(command)) {
    return PermissionDecision.block("readonly mode only allows read-only shell commands", {
      rule: "readonly-shell",
    });
  }

  if (targetPath && looksLikeCredentialPath(targetPath)) {
    return PermissionDecision.block("credential paths are never exposed to tools", {
      rule: "credential-path",
      details: { targetPath },
    });
  }

  if (targetPath && mutatingTools.has(call.name) && !isInsideWorkspace(targetPath, context)) {
    return PermissionDecision.block("writes outside the workspace are blocked", {
      rule: "workspace-write-boundary",
      details: { targetPath },
    });
  }

  if (targetPath && call.name === "read" && !isInsideWorkspace(targetPath, context)) {
    return PermissionDecision.ask("reading outside the workspace needs user approval", {
      rule: "workspace-read-boundary",
      details: { targetPath },
    });
  }

  if (call.name === "bash" && commandTouchesCredentials(command)) {
    return PermissionDecision.block("shell command appears to touch credentials", {
      rule: "credential-shell",
    });
  }

  if (call.name === "bash" && commandLooksDangerous(command)) {
    return PermissionDecision.ask("destructive or privileged shell command", {
      rule: "dangerous-shell",
    });
  }

  return PermissionDecision.allow("no matching restriction", {
    rule: "default-allow",
  });
}

function recordAudit(context, call, preflight, finalDecision) {
  context.auditLog.push({
    at: context.now(),
    call: summarizeCall(call),
    rule: preflight.rule,
    preflight: preflight.action,
    final: finalDecision.action,
    reason: finalDecision.reason,
  });
}

async function evaluatePermission(call, context) {
  const preflight = preflightDecision(call, context);
  let finalDecision = preflight;

  if (preflight.action === "ask") {
    const approved = await context.askUser({ call, decision: preflight });
    finalDecision = approved
      ? PermissionDecision.allow(`user approved: ${preflight.reason}`, {
          rule: preflight.rule,
          details: preflight.details,
        })
      : PermissionDecision.block(`user denied: ${preflight.reason}`, {
          rule: preflight.rule,
          details: preflight.details,
        });
  }

  recordAudit(context, call, preflight, finalDecision);
  return finalDecision;
}

function createDemoContext(overrides = {}) {
  return {
    workspaceRoot: "/demo/workspace",
    readonly: false,
    auditLog: [],
    now: () => "2026-05-28T00:00:00.000Z",
    askUser: async ({ call, decision }) => {
      const approved = call.name === "read";
      console.log(`askUser: ${summarizeCall(call)} -> ${approved ? "allow" : "deny"}`);
      console.log(`  reason: ${decision.reason}`);
      return approved;
    },
    ...overrides,
  };
}

async function runScenario(title, context, calls) {
  console.log(`\n== ${title} ==`);
  for (const call of calls) {
    const decision = await evaluatePermission(call, context);
    console.log(`${summarizeCall(call)} -> ${decision.action} (${decision.reason})`);
  }
}

async function main() {
  const normalContext = createDemoContext();
  await runScenario("normal mode", normalContext, [
    { name: "read", input: { path: "README.md" } },
    { name: "write", input: { path: "notes.md" } },
    { name: "read", input: { path: "../shared/design.md" } },
    { name: "write", input: { path: "../outside.txt" } },
    { name: "read", input: { path: ".env" } },
    { name: "bash", input: { command: "sudo npm install -g demo" } },
    { name: "bash", input: { command: "cat .env" } },
  ]);

  const readonlyContext = createDemoContext({ readonly: true });
  await runScenario("readonly mode", readonlyContext, [
    { name: "read", input: { path: "README.md" } },
    { name: "bash", input: { command: "rg permissions s09_permissions" } },
    { name: "write", input: { path: "notes.md" } },
    { name: "bash", input: { command: "npm test" } },
  ]);

  console.log("\n== audit log sample ==");
  for (const entry of [...normalContext.auditLog, ...readonlyContext.auditLog]) {
    console.log(`${entry.final.padEnd(5)} ${entry.rule.padEnd(24)} ${entry.call}`);
  }
}

await main();

export { PermissionDecision, evaluatePermission, preflightDecision };
