// s14 教学 mock:演示 Pi observability 的 trace 树如何自动形成 + 脱敏 + subscriber 隔离。
//
// 对应真实 Pi(design notes, packages/agent/docs/observability.md, commit dbb9911a):
//   trace=因果树, span=有时长操作; traceOperation 自动继承 parentSpanId
//   Node 用 AsyncLocalStorage 做 async 上下文; 本 mock 用同步上下文栈代替(并发下不等价)
//   默认脱敏白/黑名单; subscriber 必须被动,错误被隔离
//
// 时间/token/成本都是假的。本 mock 只演示设计结构。

// ---- 简化的"当前上下文"(真实用 AsyncLocalStorage)----
let currentContext; // { traceId, currentSpanId, userContext }

function getContext() {
  return currentContext;
}

function runWithContext(ctx, fn) {
  const prev = currentContext;
  currentContext = ctx;
  try {
    return fn();
  } finally {
    currentContext = prev;
  }
}

function runWithPiContext(userContext, fn) {
  const parent = getContext();
  return runWithContext({ ...parent, userContext }, fn);
}

// ---- 确定性 id(教学用,真实是随机/uuid)----
let idCounter = 0;
function createId(prefix) {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

// ---- 事件总线 ----
const subscribers = new Set();
const emittedEvents = [];

function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function emit(event) {
  emittedEvents.push(event);
  for (const listener of subscribers) {
    // subscriber 必须被动:错误被隔离,绝不影响主流程
    try {
      listener(event);
    } catch (err) {
      console.log(`  [observability] subscriber 抛错被隔离: ${err.message}`);
    }
  }
}

// ---- 脱敏:白名单保留,其余敏感字段替换 ----
const SAFE_KEYS = new Set([
  "provider",
  "model",
  "api",
  "sessionId",
  "entryType",
  "toolName",
  "statusCode",
  "stopReason",
  "inputTokens",
  "outputTokens",
  "costUsd",
  "durationMs",
]);
const UNSAFE_KEYS = new Set([
  "prompt",
  "completion",
  "toolArgs",
  "toolResult",
  "shellOutput",
  "fileContent",
  "apiKey",
  "headers",
]);

function redact(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload ?? {})) {
    if (UNSAFE_KEYS.has(k)) out[k] = "[redacted]";
    else if (SAFE_KEYS.has(k)) out[k] = v;
    else out[k] = v; // 未分类:本 mock 保留,真实应默认保守
  }
  return out;
}

// ---- traceOperation:建 span、继承父子、emit start/end/error ----
function traceOperation(name, payload, fn) {
  const parent = getContext();
  const traceId = parent?.traceId ?? createId("t");
  const spanId = createId("s");
  const parentSpanId = parent?.currentSpanId;
  const child = { ...parent, traceId, currentSpanId: spanId };

  emit({
    type: "start",
    name,
    traceId,
    spanId,
    parentSpanId,
    context: parent?.userContext,
    payload: redact(payload),
  });

  return runWithContext(child, () => {
    try {
      const result = fn();
      emit({ type: "end", name, traceId, spanId, parentSpanId, status: "ok" });
      return result;
    } catch (err) {
      emit({ type: "error", name, traceId, spanId, parentSpanId, status: "error", error: { message: err.message } });
      throw err;
    }
  });
}

// ---- 假 harness:嵌套操作,trace 树自动长出来 ----
function fakeHarnessPrompt(userText) {
  return traceOperation("pi.agent.prompt", { promptLength: userText.length, prompt: userText }, () => {
    return traceOperation("pi.agent.turn", {}, () => {
      // provider 请求(含本应脱敏的 apiKey)
      traceOperation(
        "pi.ai.provider.request",
        { provider: "anthropic", model: "claude-opus-4-6", apiKey: "sk-secret-123", inputTokens: 1200 },
        () => "assistant wants a tool",
      );
      // 工具调用,内部再 append session entry
      traceOperation("pi.agent.tool_call", { toolName: "read", toolArgs: "path=payment.ts" }, () => {
        traceOperation("pi.agent.session.append_entry", { entryType: "message" }, () => "appended");
      });
      return "done";
    });
  });
}

// ---- demo ----
console.log("== 注册两个 subscriber(其中一个会抛错,验证隔离)==");
subscribe((e) => {
  if (e.type === "start") console.log(`  [event] start ${e.name} (span=${e.spanId}, parent=${e.parentSpanId ?? "-"})`);
});
subscribe((e) => {
  if (e.name === "pi.ai.provider.request" && e.type === "start") {
    throw new Error("故意抛错的坏 subscriber");
  }
});

console.log("\n== 跑一次 fakeHarnessPrompt,带 userContext ==");
runWithPiContext({ userId: "u123", orgId: "acme" }, () => fakeHarnessPrompt("重构支付模块"));

console.log("\n== 重建因果树(traceId / spanId / parent)==");
const starts = emittedEvents.filter((e) => e.type === "start");
function printTree(parentSpanId, depth) {
  for (const e of starts.filter((s) => (s.parentSpanId ?? null) === (parentSpanId ?? null))) {
    console.log(`${"  ".repeat(depth)}- ${e.name} (span=${e.spanId})`);
    printTree(e.spanId, depth + 1);
  }
}
printTree(null, 0);

console.log("\n== 脱敏前后对比 ==");
const raw = { provider: "anthropic", model: "claude-opus-4-6", apiKey: "sk-secret-123", prompt: "重构支付模块" };
console.log("raw   :", JSON.stringify(raw));
console.log("redact:", JSON.stringify(redact(raw)));

console.log("\n== userContext 是否贴在事件上 ==");
const sample = starts.find((e) => e.name === "pi.ai.provider.request");
console.log("provider.request 事件的 context =", JSON.stringify(sample?.context));

console.log("\n主流程在坏 subscriber 抛错后仍正常完成。");

export { traceOperation, runWithPiContext, subscribe, redact, getContext };
