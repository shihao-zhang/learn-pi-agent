# learn-pi-agent 下一步质量提升计划 (P0)

> 状态:待人类 review。基于对 Pi 源码 `dbb9911a`(2026-05-30,npm `@earendil-works/pi-coding-agent@0.78.0`)的第一手提取。
> 证据资产:`.evidence/pi-evidence.json`(13 模块、641 条 `fact` 条目,其中 135 条标记为 volatile/易过期)。

---

## 0. 这份计划怎么来的

- 只读 clone 官方 monorepo 到 `/tmp/pi-src`,跑了一个 Lean workflow:13 个模块各一个 agent,读官方 doc + 真实 src,产出带 `file:line` 引用 + 逐字 quote 的证据清单。**Evidence 阶段全部成功**。
- Audit 阶段(12 章逐条核验)因 schema 过复杂失败,改由主 agent 用证据 + 章节原文手动审计(下面第 3 节)。
- 另外人工通读了 workflow 未覆盖、但属 harness 核心的文档:`agent-harness.md`、`hooks.md`、`durable-harness.md`、`observability.md`、`compaction.md`。

---

## 1. 重新拆解:Pi 学习机制地图

### 1.1 最大结构性发现:Pi 是三层,现 12 章把三层混在一起

| 层 | 包 | 真实职责(源码确认) | 现 12 章覆盖 |
|---|---|---|---|
| **L1 裸 agent loop** | `pi-agent-core` `packages/agent/src/agent-loop.ts` | 内外双层循环、tool 批量执行、lifecycle 事件、stop 条件 | s01(但建模过简) |
| **L1.5 编排层 AgentHarness** | `pi-agent-core` `packages/agent/src/harness/agent-harness.ts` (1064 行) | phase(idle/turn/compaction/branch_summary/retry)、turn snapshot、save point、steer/followUp/nextTurn 队列、pending writes、durable 状态 | **完全缺失** |
| **L2 coding-agent 产品面** | `pi-coding-agent` `src/core/*` `src/modes/*` | tools / skills / prompts / extensions / packages / **compaction** / sessions / TUI / RPC / JSON | s02–s12(分散) |
| **L3 多 provider API** | `pi-ai` `packages/ai/src/*` | 统一 LLM API、30+ provider、OAuth、模型 compat flags | s08(很浅) |

### 1.2 四条被现结构打散/隐形的横切线(应显性成章或成贯穿专栏)

1. **系统提示词的"编译/组装"**:`<available_skills>` XML 注入、context 文件优先级 —— 现仅隐含在 s12。
2. **Token / 上下文经济学**:compaction(`reserveTokens=16384`、`keepRecentTokens=20000`)、progressive disclosure、tool result 截断 2000 字符 —— **现完全没有 compaction 章,是硬伤**。
3. **信任与来源**:extension/package 是代码、skill/context 不是;`block?:boolean` 门 —— 现散落。
4. **可观测性**:Pi 的 runtime-agnostic trace(`pi.agent.*`/`pi.ai.*` span、默认脱敏白/黑名单)—— 现 s12 的 `console.table` "trace" 没有真实对应。

---

## 2. 12 章是否合理:判断 = **保留骨架,但需重排 + 补 3 章 + 叠加分轨**

### 2.1 现 12 章保留,但按"三层 + 横切"重排

建议新目录结构(模块化路径,不再强调"第几章"):

```
00_map         机制地图总纲(新)— 三层模型 + 横切线 + 三条读者路径入口
A 最小内核
  s01 agent loop（重写:加 AgentHarness 编排层,修 max_turns)
  s02 tool dispatch（基本保留,升级引用）
B 上下文与渐进披露（合成专题,不再 3 个平铺兄弟）
  s03 context files
  s04 prompt templates
  s05 skills
  s13 compaction & 上下文经济学（新）★
C 扩展与控制面
  s06 extensions（重写:hooks≠events）
  s09 permissions（重写:block 模型,非 allow/ask/block）
D 状态与模型
  s07 sessions
  s08 models & providers（拆深 L3）
  s15 session-format & durable（新,或并入 s07)★
E 产品化与可观测
  s10 SDK embed
  s11 packages
  s14 observability & trace（新）★
  s12 comprehensive（重写:三层总装）
```

> ★ = 新增。是否新建独立目录 vs 并入既有章,等你拍板(见第 6 节决策点)。

### 2.2 为什么这样改

- **s03+s04+s05** 本是同一机制(上下文注入)的三个面,组专题比平铺更能讲清 progressive disclosure。
- **compaction 缺失**是相对 learn-claude-code 最明显的内容差距 —— coding agent 上下文工程的核心。
- **observability** 给 s12 那个假 trace 一个真实锚点。
- **读者分轨**(解决 #5):在 `00_map` 放 3 条路径,不重写章节即分层:
  - **AI 产品经理**:00 → s01 概念 → s05 → s13 → s12(只读"问题/图/边界")
  - **agent 平台设计者**:00 → L1.5 AgentHarness → s06 hooks → s09 → s14 → s15
  - **工程读者**:全章 + `code.mjs` + `.evidence` 下钻 file:line

---

## 3. 逐章审计结果(证据 vs 现内容)

> verdict: ✅confirmed ⚠️stale 🔴wrong/mock-as-fact

| 章 | 关键发现 | verdict | 证据(file:line) |
|---|---|---|---|
| s01 | **重度教 `max_turns` 作为 stop 条件**;真实 loop **无任何 max_turns/maxTurns 符号**,停止靠 `shouldStopAfterTurn` hook + 自然退出 + stopReason `error`/`aborted` | 🔴 mock-as-fact | `agent-loop.ts:241,196`;grep 全仓库无 maxTurns |
| s01 | stop reason 写成 `no_tool_calls`;真实无此常量,自然退出时 assistant stopReason 通常是 `stop` | 🔴 | `pi-ai types.ts:277` |
| s01 | 未提 AgentHarness 编排层、steer/followUp 队列、prepareNextTurn | ⚠️ 缺失 | `agent-loop.ts:226`;`agent-harness.md` |
| s02 | 默认 4 工具 + grep/find/ls 可选 = **正确**,但应升级:7 内置、4 active、读写子集 | ✅ 可升级 | `tools/index.ts:83,168,177` |
| s05 | skill 机制基本准确;可补:name≤64、desc≤1024、`<available_skills>` XML、冲突 winnerPath/loserPath | ✅ 可升级 | `skills.ts:11,14,347,413` |
| s06 | ~~把 `tool_call` 讲成"event"是 mock-as-fact~~ **此审计结论有误,已撤销**:coding-agent extension 层官方就用 `pi.on`,`tool_call`/`tool_result` 在 `extensions.md` 即称 event,s06 原说法正确。`observe`/`on` 的 hooks≠events 分界是 `pi-agent-core` 底层 `hooks.md` 的设计,不是 extension 层。 | ✅ 原文正确 | `extensions.md:676,739` |
| s06 | 真实问题:① 误把真实 API `registerTool`/`registerCommand` 标成"教学 mock 名称"(已撤);② 缺 file:line;③ 缺 `parameters`/`label`/`execute` 字段契约。已修。 | ✅ 已升级 | `extensions/types.ts:430,438,455,682,1000` |
| s08 | models 太浅;真实有 ModelApi 4 类型、20+ compat flags、默认模型 `claude-opus-4-6` | ⚠️ 浅 | `pi-ai types.ts:118,136`;`config.ts:266` |
| s09 | **教 allow/ask/block 三态**;真实**只有 `block?:boolean`**,无 permissions 目录、无 allow/ask 枚举、无持久 policy | 🔴 mock-as-fact | `extensions/types.ts:986`;grep 仅 example permission-gate.ts |
| s10 | 已诚实标注 `schema` 是 mock;可升级:真实 `parameters`(TypeBox)、execute 5 参、active 默认 `[read,bash,edit,write]` | ✅ 可升级 | `extensions/types.ts:438,455`;`sdk.ts:282` |
| s11 | manifest 用 `prompts` 非 `promptTemplates`;源 prefix npm:/git:/local | ✅ 可升级 | `packages.md` |
| s12 | 假 trace 应锚到真实 observability;总装应改三层 | ⚠️ | `observability.md` |
| 全局 | 仓库名 `earendil-works/pi`(现章节)vs `pi-mono`(源码链接用);npm 已 0.78.0(README 停在 0.74 过渡期) | ⚠️ stale | `README` clone 别名;npm view |

**3 个 mock-as-fact(s01 max_turns / s06 event / s09 allow-ask-block)是最高优先级修复** —— 它们把教学简化包装成了 Pi 事实,正是 research-notes 红线禁止的。

---

## 4. 每模块需要补的:证据 / 出处 / trace / demo / 练习 / 边界

| 模块 | 补真实证据 | 升级出处到 file:line | 补运行 trace | 补 code demo | 补练习 | 补边界声明 |
|---|---|---|---|---|---|---|
| s01 loop | shouldStopAfterTurn / 无 max_turns | `agent-loop.ts:166-256` | 真实 `pi -p` 单轮 JSON trace | mock 增 shouldStopAfterTurn hook | "找出 Pi 里的 stop 条件" | "max_turns 是本教学发明,Pi 无此" |
| s06 ext | hooks vs events 两套语义 | `hooks.md`+`types.ts:682` | 真实 extension 触发 tool_call block | mock 区分 observe/on | 写一个 block bash 的 hook | "event 只读,hook 可改/可拦" |
| s09 perm | 单 block 模型 | `extensions/types.ts:986` | 真实 block 一次危险命令 | mock 改成 block?:boolean | "ask 怎么用 ctx.ui.select 实现" | "Pi 无 allow/ask/block 三态" |
| s13 compaction(新) | reserve/keep tokens、CompactionEntry | `compaction.md`+`session-manager.ts` | 真实触发 /compact 的 trace | 新 mock:cut point + summary | "split-turn 怎么切" | "阈值与格式以源码为准" |
| s14 observ(新) | pi.* span、脱敏名单 | `observability.md` | 真实 JSON event stream | 新 mock:traceOperation | "哪些字段默认脱敏" | "trace 不进模型上下文" |
| s08 models | 4 ModelApi、compat flags | `pi-ai types.ts:118,136` | `pi --list-models` 输出 | mock provider adapter | "加一个 custom model" | "默认模型易变" |
| 全章通用 | — | 用 `.evidence` 批量替换页面级链接 | — | — | — | 每章 NOT-FOUND 风险提示 |

---

## 5. 人类 review 验收标准

一份可勾选的 DoD(Definition of Done):

**事实层**
- [ ] 3 个 mock-as-fact(s01/s06/s09)已加显式边界声明,不再把教学简化写成 Pi 事实
- [ ] 每章"对应真实 Pi"的页面级链接,凡 `.evidence` 有对应的,升级为 `file:line`(标注 commit `dbb9911a`)
- [ ] 仓库名/版本/包名统一核对(`pi` vs `pi-mono`、0.78.0)
- [ ] research-notes 的"高风险易过期点"与 `.evidence` volatile 清单对齐

**结构层**
- [ ] 有 `00_map` 机制地图(三层 + 横切 + 3 读者路径)
- [ ] compaction、observability 至少各有一章/一节
- [ ] AgentHarness 编排层在 s01 或独立节出现

**可验证层**
- [ ] 至少 3 章带**真实 Pi 运行 trace**(非 mock),trace 文件入库 + 注明 Pi 版本
- [ ] `npm run check` 升级:外链存活检查 + `sdk-example.ts` 真实 tsc + 安装命令存在性
- [ ] `.evidence/pi-evidence.json` 入库作为可复核来源

**产品层**
- [ ] 英文 README 扩展到与中文对等
- [ ] CONTRIBUTING / REVIEW-guide / 事实更新机制(复检日期 + 责任点)就位

---

## 6. 建议执行顺序(等你确认决策点后开跑)

1. **P0 本计划定稿**(本文件)— 你 review。
2. **P1.5 补审计**(可选):因 audit agent 失败,如需机器双盲复核,把审计拆成"每次 4 章"小批重投(降 schema 复杂度)。否则用本文件第 3 节人工审计结果即可。
3. **P2 重构**:先建 `00_map` + 重排目录(**重命名 = 不可逆,破坏已 public 链接,需你批**)→ 改 3 个 mock-as-fact → 批量升级引用 → 写 compaction/observability。
4. **P3 真实 Pi 验证**(你已授权我本地跑、你在场):装 0.78.0 → `pi --list-models` / `-p` JSON trace / `--mode json` → 抓 3 章 trace → 升级 `npm run check`。
5. **P4 产品化**:英文 README + CONTRIBUTING + REVIEW-guide + 更新机制。

### 待你拍板的决策点
- **D1 目录重命名**:`s01_*` 这种是否允许重命名/新增 `s13/s14`?(破坏 public 入站链接,不可逆)
- **D2 新机制落点**:compaction/observability/durable 是建独立目录,还是并入既有章的新节?
- **D3 是否要 P1.5 机器补审计**,还是接受本文件第 3 节的人工审计?
