# 事实更新机制

> 本仓库的所有"对应真实 Pi"声明都锚定在某个 Pi commit(当前 `dbb9911a`,2026-05-30,npm `0.78.0`)。Pi 是活跃项目,事实会过期。这份文档定义**怎么知道过期、谁来更、怎么更**,让仓库的可信度可以长期维持,而不是发布即衰减。

## 一、为什么需要这个机制

教学内容最大的风险不是写错,而是**写对了之后慢慢过期**:包名变了、默认模型换代、字段重命名、事件新增。读者拿着过期事实去做决策,比没有内容更糟。

所以本仓库把"事实"和"教学叙事"分开管理:

- **教学叙事**(为什么、机制、图、练习)相对稳定,不随版本变。
- **事实**(file:line、包名、版本、默认值、字段名)易过期,集中在 `.evidence/pi-evidence.json` 的 `volatileFacts`(当前 135 条)和每章的"事实核验清单"。

更新事实 = 重新提取 evidence + 比对 diff + 改受影响章节。叙事基本不动。

## 二、过期信号:什么时候该复检

出现以下任一情况,触发一次事实复检:

1. **定期**:每季度一次例行复检(对照当时 Pi latest)。
2. **版本跳变**:`@earendil-works/pi-coding-agent` 出现 minor 跳变(Pi 用 lockstep 版本,minor = breaking change)。用 `npm view @earendil-works/pi-coding-agent version` 对比。
3. **外链失效**:`CHECK_LINKS_ONLINE=1 npm run check` 报出死链(curl 存活检查)。
4. **读者报告**:issue 指出某条事实与最新 Pi 不符。

## 三、高风险易过期点(优先核这些)

下面是最容易过期的类别,与 `.evidence` 的 `volatileFacts` 一一对应。复检时按此清单逐项核:

| 类别 | 当前值(基准 `dbb9911a`) | 主要影响章节 | evidence 模块 |
|---|---|---|---|
| 包名 / 版本 | `@earendil-works/pi-coding-agent@0.78.0` | 全部 | quickstart, sdk |
| 仓库规范名 | `earendil-works/pi-mono`(`/pi` 别名) | 全部 | agent-loop |
| 默认 provider / 模型 | provider `google`;默认模型 `claude-opus-4-6` | s08 | models, providers, quickstart |
| 默认工具集 | 内置 7(read/bash/edit/write/grep/find/ls),默认 active 4 | s01, s02 | tools-permissions, quickstart |
| 停止机制 | 无 maxTurns;`shouldStopAfterTurn` hook + 自然退出 + stopReason error/aborted | s01 | agent-loop |
| 生命周期事件名 | 10 个(`agent_start`…`tool_execution_end`) | s01, s06, s10, s14 | agent-loop, extensions |
| Extension 字段 | tool 用 `parameters`(非 schema);`label` 必填;`execute` 5 参 | s06, s10 | sdk, extensions |
| 权限模型 | 单 `block?:boolean`(无 allow/ask/block) | s09 | tools-permissions, extensions |
| Session format | version 3;entry 9 类;id/parentId 树 | s07, s13 | sessions, session-format |
| Compaction 默认 | reserveTokens 16384 / keepRecentTokens 20000;tool result 截断 2000 字符 | s13 | (compaction.md) |
| Package manifest | `pi` 字段,kinds: extensions/skills/prompts/themes | s11 | packages |
| Observability | design notes(`observability.md`),实现程度待核 | s14 | (observability.md) |

> 注:compaction / observability 的事实主要来自文档(`compaction.md` / `observability.md`),不在 13 个 evidence 模块的源码提取里;复检时直接读这两份 doc。

## 四、更新流程(标准操作)

```text
1. 重新提取 evidence
   - clone 最新 pi-mono: git clone --depth 1 https://github.com/earendil-works/pi.git
   - 记录新 HEAD commit 和 npm latest 版本
   - 按 .evidence/README.md 的方式重新生成 pi-evidence.json
     (13 模块各读官方 doc + src,产出带 path:line 的事实)

2. 比对 diff
   - 对比新旧 pi-evidence.json 的 volatileFacts:哪些值变了?
   - 重点看第三节"高风险易过期点"那张表的每一行

3. 改受影响章节
   - 对每条变化的事实,定位用到它的章节(用上表的"主要影响章节"列)
   - 更新该章的 file:line、值、commit 锚
   - 更新该章"事实核验清单"里相应条目

4. 全局更新 commit 锚
   - 把全仓库的 `dbb9911a` / `0.78.0` / `2026-05-30` 批量替换为新基准
   - .evidence/README.md、docs/P0-quality-plan.md、各章顶部锚、本文件第一行

5. 重抓真实 trace(可选但推荐)
   - 若事件流/字段有变,重抓 .evidence/traces/raw-json-trace.jsonl
   - 命令见 .evidence/traces/json-trace-readme.md

6. 验证
   - npm run check(14 lessons + trace 资产)
   - CHECK_LINKS_ONLINE=1 npm run check(外链存活)

7. 记录
   - 在本文件末尾"复检历史"追加一行:日期 / 新基准 commit / 变了什么
```

## 五、责任与边界

- **谁来更**:维护者或贡献者;可借助 AI agent 起草,但**事实结论必须人工逐条复核**(见 [REVIEW-guide](REVIEW-guide.md) 和 AGENTS.md 的外部模型 review 规范)。
- **不要做的事**:
  - 不要凭记忆改事实——一律以重新提取的 evidence 为准。
  - 不要只改章节正文而不更新 `.evidence` 和 commit 锚——会造成引用与来源脱节。
  - 不要把"教学 mock 的字段"当成 Pi 事实去"更新"——它们本就不是 Pi 的。

## 六、复检历史

| 日期 | 基准 commit | npm 版本 | 变更摘要 |
|---|---|---|---|
| 2026-05-30 | `dbb9911a` | 0.78.0 | 首次系统提取(13 模块 / 135 volatile 事实)+ 真实 trace。修正 s01(无 maxTurns)、s09(单 block 门)等 mock-as-fact。 |
