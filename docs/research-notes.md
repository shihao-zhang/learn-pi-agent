# Research Notes

> 目的：记录本仓库采用哪些资料、哪些事实已核验、哪些内容只能当作教学类比。

最后核验日期：2026-05-28。

## 事实分级

本仓库公开后，最重要的质量线不是“写得像不像”，而是不要把不确定内容包装成官方事实。所有章节都按下面顺序采信：

```text
官方文档 > 官方仓库 > 官方新闻 > 官方 package metadata > 第三方拆解 > 社区案例 > 教学 mock
```

## 已核验的官方资料

| 资料 | 可作为事实写入的内容 |
|---|---|
| [Pi GitHub: earendil-works/pi](https://github.com/earendil-works/pi) | Pi 是 agent harness mono repo，包含 `@earendil-works/pi-coding-agent`、`pi-agent-core`、`pi-ai`、`pi-tui` 等包 |
| [Pi Docs: Overview](https://pi.dev/docs/latest) | 官方文档目录与功能面：extensions、skills、prompt templates、packages、custom models、SDK 等 |
| [Pi Docs: Quickstart](https://pi.dev/docs/latest/quickstart) | 安装方式、基本运行方式、项目上下文入口、默认工具描述 |
| [Pi Docs: Prompt Templates](https://pi.dev/docs/latest/prompt-templates) | 模板位置、Markdown/frontmatter 格式、文件名到 slash command、参数替换语义 |
| [Pi Docs: Skills](https://pi.dev/docs/latest/skills) | skill 目录结构、`SKILL.md`、frontmatter、按需加载和 discovery 来源 |
| [Pi Docs: Extensions](https://pi.dev/docs/latest/extensions) | TypeScript extension、event hook、custom tool、command、UI 与生命周期能力 |
| [Pi Docs: Sessions](https://pi.dev/docs/latest/sessions) | session 相关命令、分支、恢复、fork/clone 等用户体验 |
| [Pi Docs: Session Format](https://pi.dev/docs/latest/session-format) | session 文件与 entry 类型，只能在引用具体字段时使用 |
| [Pi Docs: Providers](https://pi.dev/docs/latest/providers) | provider 与认证相关事实，模型列表和默认值易变 |
| [Pi Docs: Custom Models](https://pi.dev/docs/latest/models) | custom model 配置思路和 schema 边界 |
| [Pi Docs: SDK](https://pi.dev/docs/latest/sdk) | `createAgentSession()`、session manager、resource loader、custom tools 等 SDK 入口 |
| [Pi Docs: Packages](https://pi.dev/docs/latest/packages) | Pi packages 可声明 extensions、skills、prompt templates、themes，并可从 npm/git/local 来源安装 |
| [Pi News: New Home at Earendil](https://pi.dev/news/2026/5/7/pi-has-a-new-home) | GitHub 迁移到 `earendil-works/pi`，CLI package 为 `@earendil-works/pi-coding-agent` |

## 只能写成教学类比的内容

这些内容可以帮助理解，但不要写成“Pi 内部就是这样实现”：

- 本仓库的 `code.mjs` 只是不依赖真实 LLM 的教学 mock。
- `messages[]`、tool result、permission decision、session entry 的字段命名只在章节内自洽；真实字段以官方 docs 和源码为准。
- Mermaid 图是产品机制图，不是 Pi 源码调用图。
- 简化版 permission regex 只能说明风险类别，不能当作 shell 安全解析方案。
- provider adapter 示例只用于解释差异，不代表真实 `pi-ai` 的 wire protocol 实现。

## 高风险易过期点

- 包名、安装命令、默认模型、provider 列表、认证流程。
- extension event 名称、handler 返回 shape、`ctx` 能力。
- session format 的字段、entry 类型、fork/clone/compact 语义。
- package install/remove/update 命令和 settings 写入位置。
- skills frontmatter 字段、`allowed-tools` 等实验性或版本相关能力。

写到这些点时，章节应使用“官方文档当前描述为”“本章教学 mock 用”这类表达，避免一口咬死。

## 附件资料的处理方式

附件 `pi-agent-harness-学习指南.md` 适合作为选题地图，但不直接作为事实来源。它的价值是帮助确定学习路径：Why、架构分层、扩展体系、SDK 集成、生态案例。

附件中以下内容必须二次核验：

- GitHub star 数、社区活跃度、生态项目状态。
- 第三方文章对源码的解读。
- 播客、演讲、社区 fork 的判断性观点。
- 所有 npm 包名、CLI 命令、文档路径。

## 与 learn-claude-code 的关系

参考项目 `learn-claude-code` 的价值在课程产品设计，而不是具体内容：

- 总纲先统一心智模型。
- 章节按机制递进。
- 每章有一个可运行代码。
- 章节 README 不只是摘要，而是包含问题、机制、代码、边界和练习。

本仓库复用这种结构，但不照搬其他项目的非官方资料叙事。Pi 的重点是“极简、透明、可扩展”，所以章节从四工具 loop 开始，逐步扩到 context、prompt、skill、extension、session、model、permission、SDK 和 package。

## 推荐阅读顺序

1. 先读 Quickstart，建立 Pi 默认工具和项目上下文入口的直觉。
2. 再读 Prompt Templates、Skills、Extensions，理解 progressive disclosure。
3. 然后读 Sessions、Session Format、Providers、Custom Models，理解产品复杂度从哪里来。
4. 最后读 SDK 和 Packages，理解 Pi 如何从 CLI 变成可嵌入、可分发的 harness。
