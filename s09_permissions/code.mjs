// s09 教学 mock:对齐真实 Pi 的"工具执行门"机制。
//
// 真实 Pi 没有权限系统,也没有 allow/ask/block 三态枚举。
// 它只在工具执行前发出 `tool_call` 事件,处理器可返回:
//   { block?: boolean; reason?: string }
// 不返回 / block 不为真 = 隐式放行;返回 block:true = 拦截,reason 回灌模型。
// 依据(commit dbb9911a):
//   packages/coding-agent/src/core/extensions/types.ts:986  ToolCallEventResult
//   packages/coding-agent/src/core/extensions/runner.ts:796   first-block-wins
//
// 因此本 mock 用单一布尔门 + first-block-wins,而不是三态机。
// "询问用户(ask)"不是内置态,是在处理器内部用 ctx.ui.select 自己拼出来的。

import path from "node:path";

// ---- tool_call 处理器的返回类型:只有 block 一个开关 ----
// 放行就返回 undefined(或 {});拦截就返回 { block: true, reason }。
function blockResult(reason, details = {}) {
  return { block: true, reason, details };
}

const mutatingTools = new Set(["write", "edit"]);
const pathTools = new Set(["read", "write", "edit"]);

const credentialPatterns = [
  /(^|[/\\])\.env($|[./\\])/,
  /(^|[/\\])\.npmrc$/,
  /(^|[/\\])id_rsa$/,
  /(^|[/\\])credentials\.json$/,
  /(^|[/\\])secrets?($|[./\\])/i,
];

const dangerousShellPatterns = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bcurl\b.+\|\s*(sh|bash)\b/,
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

// 命令字符串里凭证名前后通常是空格/引号,而非路径分隔符,需单独匹配。
function commandTouchesCredentials(command) {
  return /(^|[\s"'=])\.env($|[\s"'])|id_rsa\b|credentials\.json\b|\.npmrc\b|secret/i.test(command);
}

function commandLooksDangerous(command) {
  return dangerousShellPatterns.some((pattern) => pattern.test(command));
}

function summarizeCall(call) {
  if (call.name === "bash") return `bash "${call.input.command}"`;
  if (pathTools.has(call.name)) return `${call.name} ${call.input.path}`;
  return call.name;
}

// ---- 处理器 1:硬禁止(凭证、越界写)。直接 block,不问人。----
// 对应真实 extension 里一个不依赖 UI 的 tool_call 处理器。
function denyHardRules(call, context) {
  const targetPath = resolveTargetPath(call, context);
  const command = String(call.input?.command ?? "");

  if (targetPath && looksLikeCredentialPath(targetPath)) {
    return blockResult("credential paths are never exposed to tools", { targetPath });
  }
  if (targetPath && mutatingTools.has(call.name) && !isInsideWorkspace(targetPath, context)) {
    return blockResult("writes outside the workspace are blocked", { targetPath });
  }
  if (call.name === "bash" && commandTouchesCredentials(command)) {
    return blockResult("shell command appears to touch credentials");
  }
  return undefined; // 隐式放行,交给下一个处理器
}

// ---- 处理器 2:把"ask"拼出来。----
// Pi 没有 ask 态;这里用 ctx.ui.select 在处理器内部实现"问一下",
// 用户拒绝就翻译成 block:true,用户同意就放行(返回 undefined)。
async function askOnDangerousShell(call, context) {
  const command = String(call.input?.command ?? "");
  if (call.name === "bash" && commandLooksDangerous(command)) {
    const choice = await context.ui.select(`允许危险命令吗?\n  ${command}`, ["允许", "拒绝"]);
    if (choice !== "允许") {
      return blockResult(`user denied dangerous command: ${command}`);
    }
  }
  // 越界读也走"问一下"
  const targetPath = resolveTargetPath(call, context);
  if (call.name === "read" && targetPath && !isInsideWorkspace(targetPath, context)) {
    const choice = await context.ui.select(
      `允许读取 workspace 外文件吗?\n  ${targetPath}`,
      ["允许", "拒绝"],
    );
    if (choice !== "允许") {
      return blockResult(`user denied out-of-workspace read: ${targetPath}`);
    }
  }
  return undefined;
}

// ---- harness 侧:顺序执行所有 tool_call 处理器,first-block-wins ----
// 对应 runner.ts:796 的聚合语义:任一返回 block:true 即早退。
async function emitToolCall(call, context, handlers) {
  for (const handler of handlers) {
    const result = await handler(call, context);
    if (result?.block) {
      context.auditLog.push({ call: summarizeCall(call), blocked: true, reason: result.reason });
      return { blocked: true, reason: result.reason, details: result.details ?? {} };
    }
  }
  context.auditLog.push({ call: summarizeCall(call), blocked: false });
  return { blocked: false };
}

function createDemoContext(overrides = {}) {
  return {
    workspaceRoot: "/demo/workspace",
    auditLog: [],
    // 模拟 ctx.ui.select:真实 Pi 在交互模式下弹选择框,非交互模式需降级。
    ui: {
      select: async (prompt, _options) => {
        // 教学固定策略:危险命令一律拒绝,体现"ask = block + UI"。
        console.log(`ui.select: ${prompt.split("\n")[0]} -> 拒绝`);
        return "拒绝";
      },
    },
    ...overrides,
  };
}

async function runScenario(title, context, handlers, calls) {
  console.log(`\n== ${title} ==`);
  for (const call of calls) {
    const decision = await emitToolCall(call, context, handlers);
    const verdict = decision.blocked ? `blocked (${decision.reason})` : "allowed";
    console.log(`${summarizeCall(call)} -> ${verdict}`);
  }
}

async function main() {
  const handlers = [denyHardRules, askOnDangerousShell];
  const context = createDemoContext();

  await runScenario("tool_call gate (单 block 门 + first-block-wins)", context, handlers, [
    { name: "read", input: { path: "README.md" } }, // 隐式放行
    { name: "write", input: { path: "notes.md" } }, // 隐式放行
    { name: "read", input: { path: "../shared/design.md" } }, // 处理器2 问 -> 拒 -> block
    { name: "write", input: { path: "../outside.txt" } }, // 处理器1 硬 block
    { name: "read", input: { path: ".env" } }, // 处理器1 硬 block
    { name: "bash", input: { command: "sudo npm install -g demo" } }, // 处理器2 问 -> 拒 -> block
    { name: "bash", input: { command: "cat .env" } }, // 处理器1 硬 block(命中凭证名)
    { name: "bash", input: { command: "npm test" } }, // 隐式放行
  ]);

  console.log("\n== audit log(harness 记录的真实事实)==");
  for (const entry of context.auditLog) {
    const tag = entry.blocked ? "BLOCK" : "allow";
    console.log(`${tag.padEnd(5)} ${entry.call}${entry.reason ? `  (${entry.reason})` : ""}`);
  }

  console.log(
    "\n注意:本 mock 只有 block 一个开关。'拒绝' 是用 ui.select 拼出来的,不是 Pi 的内置态。",
  );
}

await main();

export { emitToolCall, denyHardRules, askOnDangerousShell };
