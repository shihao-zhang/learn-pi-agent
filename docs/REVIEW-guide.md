# Review 指南

> 面向 review 本仓库内容的人（人类或 AI）。
> Review 的核心问题只有一个：**这条"对应真实 Pi"的声明，能不能在 `.evidence` 或 Pi monorepo 源码按 `file:line` 复核？**

---

## 目录

1. [Review 的核心问题](#review-的核心问题)
2. [逐章 review 清单](#逐章-review-清单)
3. [如何复核真实 trace](#如何复核真实-trace)
4. [如何跑外链存活检查](#如何跑外链存活检查)
5. [调用外部模型（如 Claude）review 的规范](#调用外部模型如-claude-review-的规范)
6. [高风险易过期点清单](#高风险易过期点清单)

---

## Review 的核心问题

每当你读到"Pi 的 X 是 Y"这样的声明，问自己：

> 这条声明的来源是什么？能在 `.evidence/pi-evidence.json` 或 Pi monorepo 对应 commit 的源码里找到 `file:line`？

三个可能的结论：

| 结论 | 含义 | 后续动作 |
|---|---|---|
| 能找到 `file:line` | 声明有源码依据 | 记录引用，继续 |
| 只能找到官方文档页面 | 文档声明，非源码级核验 | 注明"来源：官方文档 X"，提醒易过期 |
| 找不到 | 疑似 mock-as-fact 或过时事实 | 标记为 P0 问题，要求修改或删除 |

---

## 逐章 review 清单

对每一章，按顺序检查以下六个维度：

### 1. commit 锚是否在

章节 README 顶部（"对应真实 Pi"节或开篇注释）必须包含：

```
事实基准：Pi monorepo `dbb9911a`（2026-05-30），npm `@earendil-works/pi-coding-agent@0.78.0`
```

若 commit 锚缺失或版本号与其他章节不一致，标记为 **P1**（需要补充）。

### 2. file:line 是否真实存在于 evidence

每条 `file:line` 引用（如 `extensions/types.ts:986`）的可信度取决于它是否在 `.evidence/pi-evidence.json` 的 `confirmedFacts` 里有对应条目和逐字引用（`quote` 字段）。

检查步骤：

1. 打开 `.evidence/pi-evidence.json`，搜索引用的文件名和行号。
2. 确认 `quote` 字段与章节引用内容一致。
3. 若 evidence 里没有，检查 `.evidence/README.md` 的"已知边界"——如果在 `notFound` 里，该事实不得在章节里声明为已确认。

找不到对应 evidence 条目的 `file:line` 引用，标记为 **P0**（高优先级，可能是伪造引用或 copy-paste 错误）。

### 3. 是否有 mock-as-fact

"mock-as-fact"是本仓库最常见的质量问题：把教学 mock 的字段名、函数名或行为，写成"Pi 内部就是这样"。

检查信号：

- 声明 Pi 的内部字段名，但没有 `file:line` 引用（例如"Pi 的 messages 格式是 `{role, content}`"）。
- 把 mock 的事件名写成 Pi 事件名，没有注明"教学 mock 自定义"。
- "教学简化 vs 生产差异"表格里，"本章 mock"列和"真实 Pi"列说的是同一件事（表明作者没有认真区分）。
- s09 README 里有真实发生的 mock-as-fact 案例（引用了不存在的 URL 和不存在的三态权限模型），可作为参考对照。

发现 mock-as-fact，标记为 **P0**（核心质量红线）。

### 4. 边界声明是否到位

"教学简化 vs 生产差异"表格（每章必有）应该：

- 明确指出本章 mock 做了哪些简化。
- 如果某个简化可能被读者误认为是 Pi 行为，需要加注说明。
- 不能只写"略有差异"而不说具体差异是什么。

表格缺失或内容空洞，标记为 **P1**。

### 5. code.mjs 是否能跑

```bash
node s{xx}_{topic}/code.mjs
```

预期：无报错、有可观察的终端输出（不应全部静默）。

如果 `node` 执行失败或无输出，标记为 **P0**（`npm run check` 也会捕捉此问题）。

### 6. 练习是否有梯度

每章至少 4 题，应有层次：

- 前几题：操作性（改代码验证行为）
- 中间题：理解性（解释机制与真实 Pi 的对应）
- 最后题：设计性或开放性（思考 harness 设计取舍）

若所有题目都是"跑一遍代码"或"改一个参数"，没有需要思考的题，标记为 **P2**。

---

## 如何复核真实 trace

`.evidence/traces/` 目录存放真实 Pi 运行产物，是验证 Pi 行为的第一手证据：

| 文件 | 内容 |
|---|---|
| `raw-json-trace.jsonl` | 真实 `pi --mode json` 的原始 JSON event stream |
| `json-trace-readme.md` | 对该 trace 的事件序列、关键字段的注释说明 |
| `pi-help.txt` | 真实 `pi --help` 输出 |
| `pi-list-models.txt` | 真实 `pi --list-models` 输出（如有）|

### 对照使用方式

1. 章节声明某个事件名（如 `agent_start`）或字段（如 `stopReason`）时，先在 `raw-json-trace.jsonl` 里搜索，确认真实输出里有该字段。
2. 若章节说"事件顺序是 A → B → C"，对照 `json-trace-readme.md` 里的事件序列骨架。
3. 字段值（如 `version: 3`、`willRetry: false`）可以直接从 trace 里读取。

### 重新抓取 trace 的注意事项

如果需要用新版 Pi 重新生成 trace，注意：

```bash
# print 模式（默认）会等待用户输入，必须重定向 stdin：
pi --mode json --no-session -p "..." </dev/null

# 如果不加 </dev/null，Pi 进入交互模式，命令会阻塞
```

抓取后将新 trace 存入 `.evidence/traces/`，同步更新 `.evidence/README.md` 里的 commit 和版本信息，并通知相关章节的事实核验清单需要重新核对。

---

## 如何跑外链存活检查

```bash
CHECK_LINKS_ONLINE=1 npm run check
```

该命令用 `curl` 而非 `node fetch` 检查外链，原因：某些站点（如 `pi.dev`）对 `node fetch` 的 TLS/HTTP2 握手不友好，但 curl 能正常访问，更能反映链接对普通读者的真实可达性。

适用场景：

- 修改或新增外部链接后
- 章节引用的官方文档 URL 是否仍可访问
- 定期检查（`pi.dev` 文档路径有时随版本迁移）

默认（无 `CHECK_LINKS_ONLINE=1`）只检查本地相对链接和文件存在性，不发网络请求。CI/CD 或无网络环境请保持默认。

---

## 调用外部模型（如 Claude）review 的规范

本仓库 [`AGENTS.md`](../AGENTS.md) 规定：

> 不调用外部模型 review 本仓库内容，除非人类明确授权。

如果人类授权了 Claude review，操作规范如下：

### 授权与发送范围

在调用前，主 agent 必须向人类说明：
- 将发送的内容范围（完整 diff、指定文件、摘要或问题清单）
- 会话不会包含 `.env`、API key 或 `.evidence/pi-evidence.json` 之外的敏感内容

默认调用方式（来自 AGENTS.md）：

```bash
claude -p "<prompt>" --model claude-opus-4-7 --effort xhigh
```

### Review 输出格式要求

要求 Claude 输出三个部分：

1. `Findings`：按 P0/P1/P2 排序，每条包含文件、问题、影响、建议修复。
2. `Open Questions`：需要人类确认的问题（如"这条 file:line 是否指向正确的 commit"）。
3. `Verification`：建议本地验证命令。

### 结论的处理方式

Claude 的结论**必须**由主 agent 逐条复核，不能未经本地验证就当作事实或直接触发大范围改动。

对 Claude 的每条建议，区分：

| 类型 | 含义 | 处理 |
|---|---|---|
| 真实缺陷 | mock-as-fact、缺失引用、代码运行失败 | 修复并运行 `npm run check` |
| 边界问题 | 措辞不清、简化未注明 | 补充说明或注释，无需改代码 |
| 模型误判 | Claude 误认为事实错误，但引用有 evidence 支撑 | 保留原内容，记录为"已复核" |

修复后向人类说明：修改了什么、`npm run check` 是否通过。

---

## 高风险易过期点清单

下列内容在 Pi 版本迭代中容易变化，review 时需要特别关注，并与 `.evidence/pi-evidence.json` 里各模块的 `volatileFacts` 字段交叉核对：

### 包名与版本

| 易过期点 | 当前值（截至 `dbb9911a`）| 核验位置 |
|---|---|---|
| CLI 包名 | `@earendil-works/pi-coding-agent` | npm registry + 官方新闻 |
| 当前版本 | `0.78.0` | `.evidence/README.md` |
| 旧 scope | `@mariozechner/*`（0.74.0 起过渡） | 官方新闻页 |

### 模型与 provider

| 易过期点 | 说明 |
|---|---|
| 默认模型 | 官方文档描述易变，不要在章节里写死默认值 |
| Provider 列表 | 参考 `pi.dev/docs/latest/providers`，但以最新文档为准 |
| 认证方式 | 每个 provider 的 env var 名或 OAuth 流程可能随版本变 |

### Extension API

| 易过期点 | 当前已核验值 | 核验 file:line |
|---|---|---|
| `tool_call` 事件触发时机 | `tool_execution_start` 后、handler 前 | `extensions/types.ts:682` |
| `ToolCallEventResult` 类型 | `{ block?: boolean; reason?: string }`，无 allow/ask 枚举 | `extensions/types.ts:986` |
| 多处理器策略 | first-block-wins | `extensions/runner.ts:796` |
| `tool_result` 可 patch 字段 | `content` / `details` / `isError`（later-wins） | `extensions/types.ts:1000` |

如果 Pi 更新后上述行数偏移，需要重新提取 `.evidence` 并更新所有引用该行的章节。

### Session format

| 易过期点 | 说明 |
|---|---|
| `version` 字段 | 真实 trace 显示当前为 `3`，未来可能升级 |
| Entry 类型 | `session`、`agent_start`、`turn_start` 等事件名可能重命名 |
| fork/clone/compact 语义 | 文档描述的用户体验层；内部实现可能变化 |

### Skills / Prompt Templates / Packages

| 易过期点 | 说明 |
|---|---|
| `SKILL.md` frontmatter 字段 | 如 `allowed-tools`，实验性能力，随版本变化 |
| Prompt template 参数替换语义 | 占位符格式 |
| Package install/update 命令 | settings 写入位置可能变化 |

### 操作性提示

1. 每次更新本仓库前，先检查 `.evidence/pi-evidence.json` 里的 `volatileFacts`——它集中列出了上述易过期事实的当前值。
2. 如果 Pi 发布了新版本（npm 版本号变化），需要重新提取 evidence，更新 commit 锚，并对所有章节的事实核验清单做一次扫描。
3. Review 时若发现某个事实在 `volatileFacts` 里已标记为"易过期"，而章节写法是"Pi 的 X 是 Y"（没有注明"截至 commit XXX"），该声明应改写为带版本约束的形式。
