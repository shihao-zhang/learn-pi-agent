# Contributing to learn-pi-agent

> 核心质量线只有一条：**不把不确定内容包装成官方 Pi 事实**。
> 这比文笔好看或代码整洁更重要。

## 目录

1. [项目定位](#项目定位)
2. [每章结构约定](#每章结构约定)
3. [事实纪律（最重要）](#事实纪律最重要)
4. [提交前检查](#提交前检查)
5. [代码风格](#代码风格)
6. [不可逆操作须知](#不可逆操作须知)

---

## 项目定位

本仓库是**教学项目**，不是 Pi 官方文档，也不代表任何 Pi 内部实现细节。

定位很窄：帮助 AI 产品经理、平台架构师和工程师——以递进、可运行的方式——理解 Pi 这款极简 coding agent harness 的产品机制。

因此：

- 示例代码不依赖真实 LLM，可单独 `node` 运行，体现机制而非性能。
- 章节 README 的价值在"问题 → 机制 → 边界"，不在逐字转述官方文档。
- 声明某件事是"Pi 的行为"，就必须能拿出来源；否则写成"本仓库教学 mock"。

---

## 每章结构约定

所有章节按以下顺序组织，缺一不可：

```
1. 本章要解决的问题
2. 为什么上一章不够
3. 机制拆解（含 Mermaid 图）
4. 代码导读（配合 code.mjs）
5. 对应真实 Pi（带 commit 锚 + file:line）
6. 教学简化 vs 生产差异（表格）
7. 练习（至少 4 题，有梯度）
8. 事实核验清单
9. 小结
```

每节的作用：

| 节 | 为什么必须 |
|---|---|
| 本章要解决的问题 | 让读者先确认"这个机制为什么存在"，避免带着错误前提往下读 |
| 为什么上一章不够 | 强迫作者想清楚章节间的递进关系，不写成孤立笔记 |
| 机制拆解 + Mermaid 图 | 把抽象概念放进 harness 的运行链路；图是产品机制图，不是源码调用图 |
| 代码导读 | 说明 mock 演示的是什么，对应的真实契约在哪 |
| 对应真实 Pi | 本章事实纪律的核心产出，见下一节 |
| 教学简化 vs 生产差异 | 明确区分"这是 mock"和"这是 Pi"，是避免 mock-as-fact 的最后防线 |
| 练习 | 检验理解而非重复操作；最后一题通常是开放设计题 |
| 事实核验清单 | 列出"不要凭记忆"的易过期点，让后续维护者知道去哪复核 |
| 小结 | 一段话收拢核心结论；如果写不出来，说明章节焦点不清 |

参考样章：[`s09_permissions/README.md`](s09_permissions/README.md)。

---

## 事实纪律（最重要）

### 采信顺序

```
官方文档 > 官方仓库源码 > 官方新闻 > 官方 package metadata
    > 第三方拆解 > 社区案例 > 教学 mock
```

越靠后，越只能写成"教学类比"或"本仓库简化"，不能以事实口吻陈述。

### commit 锚与 file:line 引用

每章"对应真实 Pi"节，**必须**在开头注明：

```
> 事实基准：Pi monorepo `dbb9911a`（2026-05-30），npm `@earendil-works/pi-coding-agent@0.78.0`。
> 本章引用的 `file:line` 均对应该 commit；易过期点见末尾"事实核验清单"。
```

所有 `file:line` 引用的上游来源是 [`.evidence/pi-evidence.json`](.evidence/pi-evidence.json)。

- 写声明前先检查 `evidence[].confirmedFacts`——里面有带逐字引用的已核验事实。
- `.evidence/README.md` 说明了该文件的生成方式和已知边界。
- 若 `.evidence` 里没有相关记录，就在"对应真实 Pi"节写明"当前 evidence 未覆盖，来源为官方文档 X"，并在事实核验清单里标记。

**pi.dev 页面级链接（如 `https://pi.dev/docs/latest/extensions`）** 只用作辅助，不能替代 `file:line` 作为精确声明的引用。

### 三类内容，严格区分

| 类型 | 写法示例 | 写法禁忌 |
|---|---|---|
| 官方事实 | "依据 `extensions/types.ts:986`，返回类型是 `{ block?: boolean; reason?: string }`" | "Pi 内部的返回类型是 `{ allow, ask, block }` 三态" |
| 教学类比 | "本章 mock 用 `messages[]` 模拟上下文，字段命名只在本章内自洽" | "Pi 的 messages[] 格式就是这样" |
| 本仓库简化 | "这里的 permission 实现是简化 mock，不能当作 shell 安全解析方案" | "Pi 的权限系统就是这样工作的" |

**最常见的错误是 mock-as-fact**：把教学 mock 的函数名、字段名、行为写成"Pi 内部就是这样"。s09 的"重要更正"框是真实案例——曾经错误引用了不存在的 URL 和不存在的三态模型，最终必须修正。

### 高风险易过期点

写到这些内容时，**不要凭记忆**，必须先查 `.evidence/pi-evidence.json` 里的 `volatileFacts` 或官方文档：

- 包名和安装命令（如 `@earendil-works/pi-coding-agent`、`--ignore-scripts` 适用性）
- 默认模型和 provider 列表
- extension event 名称（如 `tool_call`、`tool_result`）和 handler 返回 shape
- session format 字段名、entry 类型（`session`、`agent_start` 等）
- `frontmatter` 字段（skills、prompt templates、packages）
- `allowed-tools` 等实验性能力的当前状态

写法：用"官方文档当前描述为……"或"本章教学 mock 用……"，而不是"Pi 的 X 是 Y"。

---

## 提交前检查

### 必须通过

```bash
npm run check
```

该命令会：
1. 运行 `scripts/check-links.mjs`（验证文件存在、相对链接可达、14 个 lesson 目录完整）
2. 依次运行 14 个 `code.mjs`，确认均可 `node` 执行、无运行时异常

### 新增章节的要求

1. 目录名格式：`s{两位数}_{topic_name}/`（例如 `s15_something/`）
2. 目录内必须包含 `README.md` 和 `code.mjs`
3. `code.mjs` 必须可独立运行（`node s15_something/code.mjs`），无外部依赖，有运行输出
4. `package.json` 的 `check` 脚本末尾追加 `&& node s15_something/code.mjs`
5. `package.json` 的 `scripts` 里追加 `"lesson:s15": "node s15_something/code.mjs"`
6. `scripts/check-links.mjs` 里 lesson 计数断言从 `14` 改为新数量（当前为 14）
7. `README-zh.md` 的章节表格里添加该章链接（check-links 会验证此项）

### 外链存活检查（可选）

```bash
CHECK_LINKS_ONLINE=1 npm run check
```

用 curl 验证所有 Markdown 外链可达。默认跳过，CI 无网环境也不应因此断。推荐在修改/新增 URL 后手动跑一次。

---

## 代码风格

- `code.mjs` 无外部依赖（`node:fs`、`node:path`、`node:process` 等内置模块可用）
- 必须可独立 `node` 运行，有可观察的终端输出，不依赖真实 LLM
- 注释用中文；函数名/变量名可英文，保持一致即可
- 文件顶部注释说明"这是教学 mock，字段/行为在本章内自洽，与真实 Pi 的对应关系见 README"
- 不使用 `top-level await`（保持对 Node 16+ 兼容）；脚本可用 async IIFE

---

## 不可逆操作须知

以下操作**改变已 public 的路径**，必须在仓库 Issues 或 PR 讨论区先获得明确同意，再执行：

- 重命名 lesson 目录（如 `s03_context_files` → `s03_contexts`）
- 更改章节编号（如把 s13 变成 s10）
- 删除章节

原因：GitHub 原始文件链接、README 内部链接、以及任何已分享出去的 URL 都会随之失效，且无法自动重定向。

不可逆操作之所以需要先讨论，不是因为操作难，而是因为成本在仓库外部、难以评估。

---

## 其他说明

- 本仓库不调用外部模型 review 内容，除非人类明确授权；授权规范见 [`AGENTS.md`](AGENTS.md)。
- 有疑问时，先看 `docs/research-notes.md`（事实分级）和 `.evidence/pi-evidence.json`（已核验事实）；再看对应官方文档页面。
- MIT License；贡献即视为同意在该 License 下发布。
