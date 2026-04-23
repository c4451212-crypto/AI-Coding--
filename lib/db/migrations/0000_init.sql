CREATE TABLE IF NOT EXISTS `companies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `short_name` text NOT NULL,
  `type` text NOT NULL,
  `credit_code` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `companies_short_name_unique` ON `companies` (`short_name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `name` text NOT NULL,
  `wecom_userid` text,
  `role` text DEFAULT 'viewer' NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `list_columns` text DEFAULT '["sign_date","company_id","contract_no","title","contract_type","total_amount","end_date","status"]' NOT NULL,
  `list_page_size` integer DEFAULT 30 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `view_company_ids` text,
  `can_edit_contracts` integer DEFAULT 0 NOT NULL,
  `can_delete_contracts` integer DEFAULT 0 NOT NULL,
  `can_manage_users` integer DEFAULT 0 NOT NULL,
  `can_borrow_paper` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `permissions_user_id_unique` ON `permissions` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `config_enums` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category` text NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `config_enums_category_code_unique` ON `config_enums` (`category`, `code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `config_enums_category_active_sort_idx` ON `config_enums` (`category`, `is_active`, `sort_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `contract_no` text NOT NULL,
  `company_id` integer NOT NULL,
  `title` text NOT NULL,
  `contract_type` text NOT NULL,
  `subject` text,
  `party_role` text,
  `party_company` text,
  `party_person` text,
  `party_contact` text,
  `sign_date` integer,
  `end_date` integer NOT NULL,
  `total_amount` integer NOT NULL,
  `currency` text DEFAULT 'CNY' NOT NULL,
  `primary_handler` text,
  `current_holder` text,
  `status` text DEFAULT '草稿' NOT NULL,
  `storage_location` text,
  `borrower` text,
  `borrow_date` integer,
  `expected_return_date` integer,
  `return_status` text DEFAULT '在库' NOT NULL,
  `scan_file_path` text,
  `scan_file_size` integer,
  `scan_uploaded_at` integer,
  `last_reminder_sent` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`primary_handler`) REFERENCES `users` (`username`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`current_holder`) REFERENCES `users` (`username`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`borrower`) REFERENCES `users` (`username`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `contracts_contract_no_unique` ON `contracts` (`contract_no`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contracts_company_id_idx` ON `contracts` (`company_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contracts_status_idx` ON `contracts` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contracts_end_date_idx` ON `contracts` (`end_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contracts_current_holder_idx` ON `contracts` (`current_holder`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contracts_contract_type_idx` ON `contracts` (`contract_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_schedules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `contract_id` integer NOT NULL,
  `sequence` integer NOT NULL,
  `node_name` text NOT NULL,
  `percentage` integer,
  `amount` integer NOT NULL,
  `due_date` integer NOT NULL,
  `actual_date` integer,
  `status` text DEFAULT '待预算' NOT NULL,
  `voucher_path` text,
  `reminded_budget` integer DEFAULT 0 NOT NULL,
  `reminded_payment` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_schedules_contract_id_idx` ON `payment_schedules` (`contract_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_schedules_due_date_idx` ON `payment_schedules` (`due_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reminders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `creator_id` integer NOT NULL,
  `remind_date` integer NOT NULL,
  `remind_time` text DEFAULT '09:00' NOT NULL,
  `recipients` text NOT NULL,
  `related_contract_id` integer,
  `status` text DEFAULT '待发送' NOT NULL,
  `wecom_msg_id` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`related_contract_id`) REFERENCES `contracts` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reminders_remind_date_status_idx` ON `reminders` (`remind_date`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reminder_confirmations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reminder_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `confirmed_at` integer,
  FOREIGN KEY (`reminder_id`) REFERENCES `reminders` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `reminder_confirmations_unique` ON `reminder_confirmations` (`reminder_id`, `user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer,
  `action` text NOT NULL,
  `target_type` text,
  `target_id` integer,
  `details` text,
  `ip_address` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_user_created_idx` ON `audit_logs` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `backup_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `local_enabled` integer DEFAULT 0 NOT NULL,
  `local_path` text,
  `schedule_time` text DEFAULT '03:00' NOT NULL,
  `keep_count` integer DEFAULT 7 NOT NULL,
  `cos_enabled` integer DEFAULT 0 NOT NULL,
  `cos_secret_id` text,
  `cos_secret_key` text,
  `cos_bucket` text,
  `cos_region` text,
  `updated_at` integer NOT NULL,
  `updated_by` integer,
  FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `backup_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `filename` text,
  `path` text,
  `size` integer,
  `status` text,
  `error_msg` text,
  `created_at` integer NOT NULL
);
