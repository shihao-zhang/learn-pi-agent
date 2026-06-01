# s13 Compaction & 上下文经济学

> 事实基准:Pi monorepo commit `dbb9911a`(2026-05-30),npm `@earendil-works/pi-coding-agent@0.78.0`。
> 以下 `file:line` 仅对该 commit 有效;易过期点见末尾"事实核验清单"。
>
> 来源说明:本章事实主要来自官方文档 `packages/coding-agent/docs/compaction.md`,**未**纳入 `.evidence/pi-evidence.json` 的 13 个源码提取模块。触发阈值、默认值、切点规则等以 `compaction.md` 为准;若要核到源码级,需另读 `packages/coding-agent/src/core/compaction/`。

## 本章要解决的问题

LLM 的上下文窗口是有限的。一个 coding agent 跑久了,messages 会越积越多:每次 `read` 一个大文件、每次 `bash` 一长串输出,都在吃 token。

到某个点,上下文会**装不下**。这时 harness 有两个选择:报错停摆,或者**把旧消息压缩成摘要、腾出空间继续干活**。Pi 选后者,这个机制叫 **compaction(压缩)**。

一句话:

```text
compaction = 在上下文快满时,把旧消息换成一段结构化摘要,保留最近的工作。
```

本章还会讲它的孪生机制 **branch summarization(分支摘要)**:用 `/tree` 切换分支时,把要离开的分支总结成一条上下文带过去。两者用同一套摘要格式和文件追踪逻辑。

> 这一章是整个仓库的"上下文经济学"主线(横切线 2,见 [00 机制地图](../00_map/README.md))。skill 的渐进披露、tool result 截断、compaction,本质都在回答同一个问题:**token 是稀缺资源,harness 怎么花?**

## 为什么前面的章不够

s05 讲 skill 的渐进披露——那是"**进**上下文时省 token":能力先只暴露 catalog,用到才加载全文。

但渐进披露管不了一件事:**已经进了上下文的消息,越积越多怎么办?** 你不能要求模型"少读文件",coding agent 的本职就是读文件、跑命令。真实工作里,tool result(尤其 `read`/`bash` 的输出)是上下文增长的最大来源。

所以需要一个"**出**上下文"的机制:在不丢失关键信息的前提下,把旧消息换成摘要。这就是 compaction,前面任何一章都没覆盖。

## 触发条件:一个明确的不等式

auto-compaction 在下面这个条件成立时触发(`compaction.md`):

```text
contextTokens > contextWindow - reserveTokens
```

- `reserveTokens` 默认 **16384**:给 LLM 的回复留出的空间。
- 也可以手动触发:`/compact [instructions]`,可选 instructions 用来聚焦摘要方向。

配置位置 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json`:

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 是否开启 auto-compaction |
| `reserveTokens` | `16384` | 给回复预留的 token |
| `keepRecentTokens` | `20000` | 保留多少"最近 token"不被摘要 |

设 `"enabled": false` 可关掉自动压缩,但仍能用 `/compact` 手动压。

## 它怎么工作:五步

1. **找切点**:从最新消息往回走,累加 token 估算,直到攒够 `keepRecentTokens`(默认 20k)。这个点之后的消息"保留",之前的"待摘要"。
2. **取出待摘要消息**:从上一次保留边界(或会话开头)到切点。
3. **生成摘要**:调 LLM 用结构化格式摘要;若有上一次的摘要,作为迭代上下文一起传入。
4. **追加 entry**:写一条 `CompactionEntry`,带 `summary` 和 `firstKeptEntryId`。
5. **重载**:会话用"摘要 + 从 `firstKeptEntryId` 起的消息"重建上下文。

```text
压缩前:
  entry: 0    1    2    3     4    5    6     7     8    9
        hdr  usr  ass  tool  usr  ass  tool  tool  ass  tool
              └── 待摘要 ──┘   └────── 保留(最近)──────┘
                            ↑ firstKeptEntryId (entry 4)

压缩后(末尾追加 cmp entry):
  模型看到的 = system + summary(来自 cmp) + 从 firstKeptEntryId 起的消息
```

### 切点规则

合法切点只能是:user 消息、assistant 消息、BashExecution 消息、custom 消息(`custom_message`/`branch_summary`)。
**绝不在 tool result 处切**——它必须跟它的 tool call 待在一起。

### split turn(单轮过大)

一个"turn"从一条 user 消息开始,含其后所有 assistant 响应和 tool 调用,直到下一条 user 消息。正常情况 compaction 在 turn 边界切。

但如果**单个 turn 就超过 `keepRecentTokens`**,切点会落在 turn 中间的某条 assistant 消息上,这叫 split turn。此时 Pi 生成两段摘要(历史摘要 + turn 前缀摘要)并合并。

## 摘要格式

compaction 和 branch summarization 用同一套结构化格式(`compaction.md`):

```markdown
## Goal
[用户想达成什么]
## Constraints & Preferences
- [用户提的要求]
## Progress
### Done
- [x] [已完成]
### In Progress
- [ ] [进行中]
### Blocked
- [阻塞项]
## Key Decisions
- **[决策]**: [理由]
## Next Steps
1. [下一步]
## Critical Context
- [继续工作所需数据]

<read-files>
path/to/file1.ts
</read-files>
<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化与 tool result 截断

摘要前,消息先被 `serializeConversation()` 转成文本(`[User]: ...` / `[Assistant tool calls]: read(...)` / `[Tool result]: ...`),避免模型把它当对话续写。

关键数字:**tool result 在序列化时被截断到 2000 字符**,超出部分用一个标记替换并注明截断了多少字符。原因——`read`/`bash` 的结果通常是上下文里最大的部分。

> 这条 2000 字符截断,就是"上下文经济学"最朴素的体现:harness 知道 tool 输出是 token 大户,在摘要环节主动砍。

## Branch Summarization

用 `/tree` 切换到另一分支时,Pi 会问要不要把"正在离开的分支"总结一下,把上下文带到新分支。

```text
切换前:        ┌─ B ─ C ─ D (旧 leaf,要离开)
          A ───┤
               └─ E ─ F (目标)
公共祖先: A;待摘要: B, C, D

切换后:        ┌─ B ─ C ─ D ─ [B,C,D 的摘要]
          A ───┤
               └─ E ─ F (新 leaf)
```

`CompactionEntry` 和 `BranchSummaryEntry` 都带 `details: { readFiles, modifiedFiles }`,且**文件追踪是累积的**:跨多次压缩/嵌套分支摘要,读过和改过的文件历史会一直累积下去。

## 扩展可以接管:两个 hook

extension 可以拦截并自定义两种摘要(`compaction.md`):

- **`session_before_compact`**:auto-compaction 或 `/compact` 前触发,可 `return { cancel: true }` 取消,或返回自定义 `compaction.summary`。event 里能拿到 `preparation`(待摘要消息、split-turn 前缀、上次摘要、文件操作、`firstKeptEntryId`、settings 等)。
- **`session_before_tree`**:`/tree` 导航前触发(无论用户是否选择摘要),可取消导航或提供自定义摘要。

这呼应 s06 的"控制/变更型事件":摘要策略不是写死的,可由 extension 替换。

## 代码导读

运行:

```bash
node s13_compaction/code.mjs
```

本章 mock 不调用真实 LLM,用一个假摘要器演示 compaction 的**决策逻辑**:

- `estimateTokens()`:粗略 token 估算(字符数 / 4)。
- `findCutPoint()`:从最新往回攒够 `keepRecentTokens` 找切点,**跳过 tool result**(不在那切)。
- `shouldCompact()`:实现 `contextTokens > contextWindow - reserveTokens`。
- `serializeForSummary()`:把消息转文本,并把 tool result **截断到 2000 字符**。
- `compact()`:产出一条带 `summary` / `firstKeptEntryId` / `details.{readFiles,modifiedFiles}` 的 `CompactionEntry`,并重建上下文。

输出会展示:触发判断、切点位置、截断前后的 token 对比、压缩后模型看到的上下文。

> 教学边界:mock 的 token 估算和摘要文本都是假的;真实 token 取决于 provider tokenizer,真实摘要由 LLM 生成。本章只演示**何时压、从哪切、保留什么、追踪什么**这套产品逻辑。

## 对应真实 Pi

已核验(commit `dbb9911a`):

- 触发条件 `contextTokens > contextWindow - reserveTokens`;`reserveTokens` 默认 16384、`keepRecentTokens` 默认 20000;可在 settings.json 配置(`packages/coding-agent/docs/compaction.md§Compaction`)。
- 实现位于 `packages/coding-agent/src/core/compaction/`:`compaction.ts`(auto-compaction)、`branch-summarization.ts`(分支摘要)、`utils.ts`(文件追踪/序列化)。
- `CompactionEntry` / `BranchSummaryEntry` 定义在 `packages/coding-agent/src/core/session-manager.ts`,都带 `summary` 和 `details`;`CompactionEntry` 有 `firstKeptEntryId` / `tokensBefore`,`BranchSummaryEntry` 有 `fromId`。
- 切点不能落在 tool result;合法切点为 user/assistant/BashExecution/custom 消息(`compaction.md§Cut Point Rules`)。
- tool result 序列化截断到 2000 字符(`compaction.md§Message Serialization`)。
- 文件追踪跨压缩/分支累积(`compaction.md§Cumulative File Tracking`)。
- 两个扩展事件 `session_before_compact` / `session_before_tree` 可取消或自定义摘要(`compaction.md§Custom Summarization via Extensions`;事件类型见 `packages/coding-agent/src/core/extensions/types.ts`)。

官方入口:[Compaction 文档](https://pi.dev/docs/latest/compaction)(`packages/coding-agent/docs/compaction.md`) · 源码 [`compaction/`](https://github.com/earendil-works/pi-mono/tree/main/packages/coding-agent/src/core/compaction)

## 教学简化 vs 生产差异

| 主题 | 本章 mock | 真实 Pi |
|---|---|---|
| token 估算 | 字符数 / 4 | provider tokenizer 精确计数 |
| 摘要生成 | 假摘要器 | 调 LLM,结构化格式,可传上次摘要迭代 |
| 切点 | 跳过 tool result 的简化扫描 | 完整 cut-point 规则 + split-turn 双摘要合并 |
| 重载 | 重建数组 | 会话从 `firstKeptEntryId` 真正重载 |
| 文件追踪 | 单次 | 跨压缩/嵌套分支累积 |
| 扩展 | 不演示 | `session_before_compact/tree` 可取消/自定义 |

## 练习

1. 把 `keepRecentTokens` 调小,观察切点前移、被摘要的消息变多。
2. 构造一个单 turn 就超过 `keepRecentTokens` 的输入,触发 split-turn 分支,思考为什么不能在 turn 中间随便切。
3. 把某条 tool result 写到 3000 字符,验证序列化时被截断到 2000 + 截断标记。
4. 给 `CompactionEntry` 的 `details` 加 `readFiles` 累积:第二次压缩时合并第一次的文件列表。
5. 思考:为什么 compaction 把摘要写成"Goal / Progress / Next Steps"结构,而不是一段自由文本?
6. 设计题:你要做一个"按重要性保留消息"的 extension,该挂 `session_before_compact` 还是改 settings?各自边界是什么?

## 事实核验清单

写 compaction 内容时,下面这些不要凭记忆:

- 触发不等式是否仍是 `contextTokens > contextWindow - reserveTokens`。
- `reserveTokens`(16384)/`keepRecentTokens`(20000)默认值是否变化:`compaction.md§Settings`。
- settings 路径与键名(`compaction.enabled/reserveTokens/keepRecentTokens`)是否变化。
- 切点规则、split-turn 双摘要逻辑是否变化。
- tool result 截断阈值(2000 字符)是否变化:`compaction.md§Message Serialization`。
- `CompactionEntry`/`BranchSummaryEntry` 的字段(`firstKeptEntryId`/`tokensBefore`/`fromId`/`details`)是否变化:`session-manager.ts`。
- `session_before_compact`/`session_before_tree` 的 event 语义是否变化:`extensions/types.ts`。
- 文件追踪是否仍累积。

## 小结

Compaction 是 coding agent 的"上下文新陈代谢":旧消息不是删掉,而是换成结构化摘要,保留最近的工作和关键决策。它和 skill 渐进披露、tool result 截断一起,构成 Pi 的上下文经济学——**token 是稀缺资源,harness 在进、出两个方向上都主动管理它。** 理解了这条线,你就能判断一个长任务为什么没崩、上下文里到底留下了什么。
