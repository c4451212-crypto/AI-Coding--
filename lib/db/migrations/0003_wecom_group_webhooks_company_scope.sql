-- SQLite: rebuild table to change uniqueness from (purpose_key) -> (company_id, purpose_key)
CREATE TABLE IF NOT EXISTS `wecom_group_webhooks_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company_id` integer DEFAULT 0 NOT NULL,
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
INSERT INTO `wecom_group_webhooks_new`
  (`company_id`, `purpose_key`, `display_name`, `webhook_url`, `is_active`, `mention_all_default`, `updated_at`, `updated_by`)
SELECT
  0 as `company_id`,
  `purpose_key`,
  `display_name`,
  `webhook_url`,
  `is_active`,
  `mention_all_default`,
  `updated_at`,
  `updated_by`
FROM `wecom_group_webhooks`;
--> statement-breakpoint
DROP TABLE `wecom_group_webhooks`;
--> statement-breakpoint
ALTER TABLE `wecom_group_webhooks_new` RENAME TO `wecom_group_webhooks`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `wecom_group_webhooks_company_purpose_unique`
ON `wecom_group_webhooks` (`company_id`, `purpose_key`);
