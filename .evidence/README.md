# .evidence — Pi 源码事实清单

`pi-evidence.json` 是本仓库所有 `file:line` 引用的上游来源,用于让"对应真实 Pi"声明可被第三方复核。

## 内容

- `piHead`:提取时 Pi monorepo 的 git commit。
- `npmLatest`:提取时 `@earendil-works/pi-coding-agent` 的 npm 版本。
- `evidence[]`:13 个模块,每个含 `confirmedFacts`(带 file:line + 逐字 quote)、`apiSignatures`、`volatileFacts`(高风险易过期事实的当前值)、`teachingOnly`、`notFound`(常被当 Pi 事实但 checkout 里找不到的项)。

## 生成方式

1. 只读浅 clone 官方 monorepo:`git clone --depth 1 https://github.com/earendil-works/pi.git`
   (规范名为 `earendil-works/pi-mono`;`/pi` 为可用别名。)
2. 对 13 个模块各跑一个只读 agent,读官方 `packages/coding-agent/docs/*.md` + 真实 `src`,
   提取带 `path:line` 引用与逐字 quote 的事实。
3. 汇总为本 JSON。

## 对应 commit

- 提取自 Pi monorepo HEAD `dbb9911a547f697229e4e90c9a071794db315e5e`(2026-05-30)。
- npm `@earendil-works/pi-coding-agent@0.78.0`(`legacy-node20: 0.74.2`)。
- **所有 file:line 仅对该 commit 有效**;Pi 更新后需重新提取并更新本文件的 commit 标记。

## 已知边界

- `piHead` 字段已校正为真实 checkout `dbb9911a`(2026-05-30)。早期版本曾误填任务启动时的占位 commit `3c7e1a9f`;`pi-evidence.json` 正文里若仍有个别提取笔记提到 `3c7e1a9f`,一律以 `dbb9911a` 为准。
- `notFound` 列出的是无法在该 checkout 定位的项,写章节时不得当作已确认事实。
