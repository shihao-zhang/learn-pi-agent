# s11 Pi Packages

## 核心问题

当 prompts、skills、extensions 多起来，如何分发？

Pi package 把这些资源打包，通过 npm、git 或本地路径安装。它让团队可以共享一套 agent 工作流，而不是每个人手工复制 `.pi/` 目录。

## 学完你应该理解

- Package 是资源分发机制，不等于 npm library。
- Extension 有代码执行能力，安装前必须 review。
- package manifest 要清楚声明导出的 prompts、skills、extensions、themes。

## 参考文件

见 [package.example.json](package.example.json)。

## 运行

```bash
node s11_packages/code.mjs
```

这个 demo 会读取样例 manifest，检查它是否声明了 Pi resources 和必要 peer dependencies。

## 对应 Pi

官方文档说明：Pi packages 可以声明 `extensions`、`skills`、`prompts`、`themes`；依赖应放在 `dependencies`，Pi 核心包作为 peer dependency 使用。
