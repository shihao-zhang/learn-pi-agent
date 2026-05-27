# s05 Skills

## 核心问题

复杂能力怎么“用到时再加载”？

Skill 是一个带 `SKILL.md` 的能力包。系统提示词里通常只放 name 和 description，完整说明、脚本、参考资料等在任务匹配时再读取。

## 学完你应该理解

- Skill 是 progressive disclosure：先暴露目录，用到再展开。
- 好 description 决定模型能否在正确时机加载 skill。
- Skill 适合封装领域工作流，不适合替代项目规则。

## 运行

```bash
node s05_skills/code.mjs
```

## 对应 Pi

真实 Pi 会发现 `.pi/skills/`、`.agents/skills/`、全局 skills 和 package skills。本仓库的样例是 [.pi/skills/repo-review/SKILL.md](../.pi/skills/repo-review/SKILL.md)。
