# Research Notes

> 目的：记录本仓库采用哪些资料、哪些事实已核验、哪些内容只当作参考。

## 已核验的官方资料

| 资料 | 用途 |
|---|---|
| [Pi GitHub: earendil-works/pi](https://github.com/earendil-works/pi) | 确认官方仓库、monorepo 包结构、MIT license、开发命令 |
| [Pi Docs: Overview](https://pi.dev/docs/latest) | 确认文档目录和 Pi 的定位 |
| [Pi Docs: Quickstart](https://pi.dev/docs/latest/quickstart) | 确认安装命令、认证方式、默认工具、AGENTS.md 加载 |
| [Pi Docs: Extensions](https://pi.dev/docs/latest/extensions) | 确认 TypeScript extension 的能力、位置、hook、tool、command |
| [Pi Docs: Skills](https://pi.dev/docs/latest/skills) | 确认 skill 的发现位置、结构、frontmatter、按需加载机制 |
| [Pi Docs: Prompt Templates](https://pi.dev/docs/latest/prompt-templates) | 确认 prompt template 的位置、格式、参数替换 |
| [Pi Docs: SDK](https://pi.dev/docs/latest/sdk) | 确认 `createAgentSession()`、ResourceLoader、tool、session、mode 等 SDK 入口 |
| [Pi News: New Home at Earendil](https://pi.dev/news/2026/5/7/pi-has-a-new-home) | 确认包名从 `@mariozechner/*` 迁移到 `@earendil-works/*` |

## 附件资料的处理方式

附件 `pi-agent-harness-学习指南.md` 适合作为选题地图，但里面有两类内容不能直接当作当前事实：

- GitHub star 数、版本号、生态项目活跃度会快速变化。
- 第三方文章、播客、社区 fork 适合帮助理解取舍，但不是权威 API 文档。

所以本仓库采用的事实规则是：

```text
官方文档 > 官方仓库 > 官方新闻 > 第三方拆解 > 社区案例
```

## 推荐阅读顺序

1. 先读官方 Quickstart，建立“Pi 默认给模型哪些手”的直觉。
2. 再读 Skills、Prompt Templates、Extensions，理解 progressive disclosure。
3. 然后读 SDK，理解 Pi 如何从 CLI 变成可嵌入引擎。
4. 最后看第三方文章和社区项目，用来观察“极简内核能长到哪里”。

## 与 learn-claude-code 的关系

参考项目 `learn-claude-code` 的价值在于课程产品设计：

- 总纲先统一心智模型。
- 章节按机制递进。
- 每章有一个可运行代码。
- 明确说明教学简化和生产差异。

本仓库复用这种结构，但内容不照搬。Pi 的重点是“极简、透明、可扩展”，所以章节从四工具 loop 开始，逐步扩到 context、prompt、skill、extension、session、SDK 和 package。
