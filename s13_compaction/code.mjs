// s13 教学 mock:演示 Pi compaction 的决策逻辑(不调用真实 LLM)。
//
// 对应真实 Pi(commit dbb9911a):
//   触发: contextTokens > contextWindow - reserveTokens
//   默认: reserveTokens=16384, keepRecentTokens=20000
//   实现: packages/coding-agent/src/core/compaction/{compaction,branch-summarization,utils}.ts
//   CompactionEntry: packages/coding-agent/src/core/session-manager.ts
//   tool result 序列化截断到 2000 字符
//
// 本 mock 只演示"何时压、从哪切、保留什么、追踪什么",token 与摘要都是假的。

const SETTINGS = {
  contextWindow: 600, // 教学用小窗口,真实是模型的 context window
  reserveTokens: 120, // 真实默认 16384
  keepRecentTokens: 80, // 真实默认 20000
  toolResultCharLimit: 2000, // 真实截断阈值
};

// 粗略 token 估算:字符数 / 4(真实由 provider tokenizer 决定)。
function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / 4);
}

function entryTokens(entry) {
  if (entry.role === "tool") {
    // tool result 计入截断后的长度(模拟序列化截断)
    return estimateTokens(truncateToolResult(entry.content));
  }
  return estimateTokens(entry.content);
}

// tool result 序列化时截断到 toolResultCharLimit,超出加标记。
function truncateToolResult(content) {
  const s = String(content ?? "");
  if (s.length <= SETTINGS.toolResultCharLimit) return s;
  const cut = s.length - SETTINGS.toolResultCharLimit;
  return `${s.slice(0, SETTINGS.toolResultCharLimit)}\n[... truncated ${cut} chars ...]`;
}

function totalTokens(entries) {
  return entries.reduce((sum, e) => sum + entryTokens(e), 0);
}

// 触发判断: contextTokens > contextWindow - reserveTokens
function shouldCompact(entries) {
  return totalTokens(entries) > SETTINGS.contextWindow - SETTINGS.reserveTokens;
}

// 合法切点:user / assistant / bash / custom,绝不在 tool result 处切。
const CUTTABLE = new Set(["user", "assistant", "bash", "custom", "branch_summary"]);

// 从最新往回攒够 keepRecentTokens,找到一个合法切点的索引。
// 返回 firstKeptIndex:从该索引起(含)的消息保留。
function findCutPoint(entries) {
  let recent = 0;
  let idx = entries.length;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    recent += entryTokens(entries[i]);
    if (recent >= SETTINGS.keepRecentTokens) {
      idx = i;
      break;
    }
  }
  // 把切点上移到一个合法切点(不在 tool result 处切)
  while (idx < entries.length && !CUTTABLE.has(entries[idx].role)) {
    idx += 1;
  }
  return idx;
}

// 序列化待摘要消息(真实用 serializeConversation),tool result 截断。
function serializeForSummary(entries) {
  return entries
    .map((e) => {
      if (e.role === "tool") return `[Tool result]: ${truncateToolResult(e.content)}`;
      if (e.role === "assistant") return `[Assistant]: ${e.content}`;
      if (e.role === "bash") return `[Bash]: ${e.content}`;
      return `[User]: ${e.content}`;
    })
    .join("\n");
}

// 假摘要器:真实由 LLM 用结构化格式生成。这里只提取 read/modified 文件 + 一句话。
function fakeSummarize(serialized, prevDetails) {
  const readFiles = new Set(prevDetails?.readFiles ?? []);
  const modifiedFiles = new Set(prevDetails?.modifiedFiles ?? []);
  for (const m of serialized.matchAll(/read\(([^)]+)\)/g)) readFiles.add(m[1]);
  for (const m of serialized.matchAll(/(?:write|edit)\(([^)]+)\)/g)) modifiedFiles.add(m[1]);
  const summary = [
    "## Goal",
    "(mock) 继续手头任务",
    "## Progress",
    `### Done\n- 摘要了 ${serialized.split("\n").length} 条旧消息`,
    "## Next Steps",
    "1. 基于保留消息继续",
  ].join("\n");
  return {
    summary,
    details: { readFiles: [...readFiles], modifiedFiles: [...modifiedFiles] },
  };
}

// 执行一次 compaction,返回新的 entries 与 CompactionEntry。
function compact(entries, prevDetails) {
  const cutIdx = findCutPoint(entries);
  const toSummarize = entries.slice(0, cutIdx);
  const kept = entries.slice(cutIdx);
  const firstKeptEntryId = kept[0]?.id ?? null;
  const tokensBefore = totalTokens(entries);

  const serialized = serializeForSummary(toSummarize);
  const { summary, details } = fakeSummarize(serialized, prevDetails);

  const compactionEntry = {
    type: "compaction",
    id: "cmp1",
    summary,
    firstKeptEntryId,
    tokensBefore,
    details, // { readFiles, modifiedFiles } —— 累积
  };

  // 重建:模型看到 system + summary + 从 firstKeptEntryId 起的消息
  const rebuilt = [
    { role: "system", id: "sys", content: "(system prompt)" },
    { role: "custom", id: "cmp1", content: `[summary]\n${summary}` },
    ...kept,
  ];

  return { compactionEntry, rebuilt, summarizedCount: toSummarize.length };
}

// ---- demo ----
function bigText(n) {
  return "x".repeat(n);
}

const session = [
  { role: "user", id: "e1", content: "重构支付模块,先读现有代码。" },
  { role: "assistant", id: "e2", content: "我先 read(payment.ts) 和 read(utils.ts)。" },
  { role: "tool", id: "e3", content: `read(payment.ts) =>\n${bigText(2600)}` }, // 超 2000,会被截断
  { role: "tool", id: "e4", content: "read(utils.ts) => 200 行工具函数" },
  { role: "assistant", id: "e5", content: "我打算 edit(payment.ts) 拆分 service。" },
  { role: "tool", id: "e6", content: "edit(payment.ts) => ok" },
  { role: "user", id: "e7", content: "跑一下测试。" },
  { role: "bash", id: "e8", content: "npm test => 2 failing" },
  { role: "assistant", id: "e9", content: "修复边界条件后重试。" },
  { role: "user", id: "e10", content: "现在最近的工作:继续修。" },
];

console.log("== token 账单(tool result 已按 2000 字符计)==");
for (const e of session) {
  const raw = String(e.content).length;
  const counted = e.role === "tool" ? truncateToolResult(e.content).length : raw;
  console.log(
    `${e.id.padEnd(4)} ${e.role.padEnd(9)} chars=${String(raw).padStart(4)} -> counted=${String(counted).padStart(4)} (~${entryTokens(e)} tok)`,
  );
}

console.log("\n== 触发判断 ==");
console.log(`总 token ≈ ${totalTokens(session)}`);
console.log(`阈值 = contextWindow(${SETTINGS.contextWindow}) - reserveTokens(${SETTINGS.reserveTokens}) = ${SETTINGS.contextWindow - SETTINGS.reserveTokens}`);
console.log(`shouldCompact = ${shouldCompact(session)}`);

if (shouldCompact(session)) {
  const cutIdx = findCutPoint(session);
  console.log(`\n== 切点 ==`);
  console.log(`firstKeptIndex = ${cutIdx} (entry ${session[cutIdx]?.id}, role ${session[cutIdx]?.role})`);
  console.log(`注意:切点落在合法 role 上,不会切在 tool result 处。`);

  const { compactionEntry, rebuilt, summarizedCount } = compact(session);
  console.log(`\n== 压缩结果 ==`);
  console.log(`摘要了 ${summarizedCount} 条;firstKeptEntryId = ${compactionEntry.firstKeptEntryId}`);
  console.log(`tokensBefore = ${compactionEntry.tokensBefore}`);
  console.log(`details.readFiles = ${JSON.stringify(compactionEntry.details.readFiles)}`);
  console.log(`details.modifiedFiles = ${JSON.stringify(compactionEntry.details.modifiedFiles)}`);

  console.log(`\n== 压缩后模型看到的上下文 ==`);
  for (const e of rebuilt) {
    const preview = String(e.content).split("\n")[0].slice(0, 50);
    console.log(`${e.id.padEnd(4)} ${e.role.padEnd(7)} ${preview}`);
  }
  console.log(`\n压缩前 ${totalTokens(session)} tok -> 压缩后 ${totalTokens(rebuilt)} tok`);
}

export { estimateTokens, shouldCompact, findCutPoint, truncateToolResult, compact };
