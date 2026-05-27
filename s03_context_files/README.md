# s03 Context Files

## 核心问题

项目知识应该放在哪里？

Pi 支持 context files：全局和项目级的 `AGENTS.md` / `CLAUDE.md` 会在启动时进入上下文。它们适合放稳定规则，不适合塞所有资料。

## 学完你应该理解

- Context file 是常驻知识，要短、稳、可执行。
- 易变资料应该放进 docs 或 skill，需要时再加载。
- 项目级规则可以覆盖或补充全局规则。

## 运行

```bash
node s03_context_files/code.mjs
```

## 对应 Pi

真实 Pi 会从 `~/.pi/agent/AGENTS.md`、父目录到当前目录的 `AGENTS.md` / `CLAUDE.md` 收集上下文。修改后通常需要 `/reload` 或重启。
