# wjglxt（文件管理系统）

Next.js 14（App Router）+ TypeScript + Tailwind + shadcn/ui + Drizzle + SQLite（`better-sqlite3`）项目骨架，面向绿联 NAS Docker 部署（`output: 'standalone'`）。

## 本地开发

```bash
cd wjglxt
npm install
npm run seed
npm run dev
```

### 验证

- 打开 `http://localhost:3000`：应看到看板页，并能看到 **Button / Card / Badge** 等 shadcn 组件渲染
- 打开 `http://localhost:3000/login`：使用 `admin / admin123` 登录后应回到看板
- 打开 `http://localhost:3000/api/health`：返回 JSON `status: ok`
- 打开 `http://localhost:3000/api/companies`：未登录应 `401`；登录后应返回 4 家公司
- 打开 `http://localhost:3000/api/configs?category=contract_type`：登录后返回合同类型枚举列表

### 第二步（数据库 + 基础 API）

- **迁移 + FTS5**：`npm run seed` 会执行 `runMigrations()`（Drizzle migrate + `initFTS5()`）
- **种子数据**：4 家公司 + 基础枚举 + `admin` 用户（密码 `admin123`）
- **认证**：`POST /api/auth/login` 写入 HttpOnly Cookie：`token`
- **中间件**：未登录访问页面会跳转 `/login`；未登录访问 `/api/*`（除白名单）返回 `401`

## 数据库（骨架）

- Schema：`lib/db/schema.ts`
- Drizzle Kit：`drizzle.config.ts`
- FTS5 示例 SQL：`lib/db/migrations/0001_contracts_fts5.sql`（需自行接入执行策略）

> 注意：本仓库的 `.env.local` 用于本地开发；生产环境请使用 `.env.example` 为模板自行注入环境变量。

## Docker（骨架）

```bash
cd wjglxt
docker compose up --build
```

默认会把 `./data` 挂载到容器 `/data`，并把 `./public/uploads` 挂载到 `/data/uploads`（与需求文档中的 compose 示例一致）。

## 目录结构

按 `app/(dashboard)` 路由组、`components/*`、`lib/*`、`scripts/cron-jobs.js` 等组织；业务逻辑尚未实现。
