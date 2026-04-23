CREATE TABLE IF NOT EXISTS `wecom_group_webhooks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `purpose_key` text NOT NULL,
  `display_name` text NOT NULL,
  `webhook_url` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `mention_all_default` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL,
  `updated_by` integer,
  FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `wecom_group_webhooks_purpose_unique` ON `wecom_group_webhooks` (`purpose_key`);
--> statement-breakpoint
INSERT OR IGNORE INTO `wecom_group_webhooks` (`purpose_key`, `display_name`, `webhook_url`, `is_active`, `mention_all_default`, `updated_at`)
VALUES
  ('FINANCE', '财务群', NULL, 1, 0, 1770000000000),
  ('HR', '人力资源群', NULL, 1, 0, 1770000000000),
  ('OPS', '经营管理群', NULL, 1, 0, 1770000000000),
  ('BOARD', '董事群', NULL, 1, 0, 1770000000000);
