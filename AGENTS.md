# Project Instructions

面向人类 AI 产品经理和 agent 平台设计者，回复要精炼、通俗、结构清楚。

- 不要把 Pi 描述成“官方之外的魔法框架”；优先解释 harness、工具、上下文、权限、扩展这些产品机制。
- 涉及 Pi 当前包名、仓库地址、命令、文档路径时，先核验官方资料。
- 教学代码优先保持无外部依赖，除非章节明确在讲真实 Pi SDK 或 extension。
- 不调用外部模型 review 本仓库内容，除非人类明确授权。

## Claude Review 操作规范

- 调用 Claude 等外部模型 review 前，必须获得人类明确授权，并说明将发送的内容范围，例如完整 diff、指定文件、摘要或问题清单。
- 若 Claude CLI 未登录，或需要访问本机会话、浏览器 OAuth、系统权限，先暂停说明原因，再请求人类授权；不要静默绕行。
- 调用本机 Claude Code 做 code review 类任务时，默认使用 `claude -p "<prompt>" --model claude-opus-4-7 --effort xhigh`。
- Review prompt 默认要求输出：
  - `Findings`：按 P0/P1/P2 排序，包含文件、问题、影响、建议修复。
  - `Open Questions`：需要人类确认的问题。
  - `Verification`：建议本地验证命令。
- Claude 的结论必须由主 agent 逐条复核；不能未经本地验证就当成事实、最终质量结论或直接大范围改动依据。
- 对 Claude 提出的建议要区分三类：真实缺陷、需要文档澄清的边界问题、模型误判；修复后运行相关本地检查并向人类说明结果。
