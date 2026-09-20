<h1>宏观智眸</h1>

## 启动项目

### 环境要求
- Node.js `20.19.0`
- pnpm `9.15.0`

### 首次启动
```bash
corepack enable
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

### 切换分支后
```bash
pnpm install --frozen-lockfile
```

如果 `package.json`、`pnpm-lock.yaml`、`.nvmrc` 或 `.npmrc` 在目标分支有变化，仓库会在切分支后提示你重新同步依赖。

### 依赖一致性规则
- 只允许使用 `pnpm`
- 只保留 `pnpm-lock.yaml`
- 禁止提交 `package-lock.json` / `yarn.lock`
- 安装依赖统一使用 `pnpm install --frozen-lockfile`
- CI 会强制校验 `lint`、`type-check`、`build`

## 简介

采用 `ECMAScript` 模块（`ESM`）规范来编写和组织代码，使用了最新的 `Vue3`、`Vite`、`Element-Plus`、`TypeScript`、`Pinia`、`Tailwindcss` 等主流技术开发

## `Git` 提交规范

- `feat` 增加新功能
- `fix` 修复问题/BUG
- `style` 代码风格相关无影响运行结果的
- `perf` 优化/性能提升
- `refactor` 重构
- `revert` 撤销修改
- `test` 测试相关
- `docs` 文档/注释
- `chore` 依赖更新/脚手架配置修改等
- `workflow` 工作流改进
- `ci` 持续集成
- `types` 类型定义文件更改
- `wip` 开发中
