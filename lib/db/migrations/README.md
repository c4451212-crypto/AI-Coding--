# Drizzle migrations

- `lib/db/migrations/0000_init.sql`：初始化全量表结构（由项目维护）。
- `lib/db/migrations/meta/_journal.json`：`drizzle-orm` 迁移执行所需的 journal。
- **FTS5**：`contracts_fts` 与触发器由 `lib/db/index.ts` 的 `initFTS5()` 创建（在 `runMigrations()` 末尾调用）。

> 若你本地曾生成过旧版 `dev.db` 且字段不一致，建议先删除 `dev.db` 再执行 `npm run seed`。
