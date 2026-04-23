import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const companyTypeEnum = ['母公司', '子公司', '项目公司'] as const;
export type CompanyType = (typeof companyTypeEnum)[number];

export const userRoleEnum = [
  'admin',
  'archivist',
  'manager',
  'finance',
  'hr',
  'viewer',
] as const;
export type UserRole = (typeof userRoleEnum)[number];

/**
 * companies：公司主体（母/子/项目公司等）
 */
export const companies = sqliteTable(
  'companies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    type: text('type', { enum: companyTypeEnum }).notNull(),
    creditCode: text('credit_code'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    shortNameIdx: uniqueIndex('companies_short_name_unique').on(t.shortName),
  }),
);

/**
 * config_enums：动态枚举（合同类型、币种、状态等）
 */
export const configEnums = sqliteTable(
  'config_enums',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    category: text('category').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    categoryCodeUnique: uniqueIndex('config_enums_category_code_unique').on(
      t.category,
      t.code,
    ),
    categoryIdx: index('config_enums_category_active_sort_idx').on(
      t.category,
      t.isActive,
      t.sortOrder,
    ),
  }),
);

/**
 * users：系统用户（账号体系）
 */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    wecomUserid: text('wecom_userid'),
    role: text('role', { enum: userRoleEnum }).notNull().default('viewer'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    usernameUnique: uniqueIndex('users_username_unique').on(t.username),
  }),
);

/**
 * user_preferences：用户偏好（列表列顺序、分页大小等）
 */
export const userPreferences = sqliteTable(
  'user_preferences',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listColumns: text('list_columns')
      .notNull()
      .default(
        '["sign_date","company_id","contract_no","title","contract_type","total_amount","end_date","status"]',
      ),
    listPageSize: integer('list_page_size').notNull().default(30),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userUnique: uniqueIndex('user_preferences_user_id_unique').on(t.userId),
  }),
);

/**
 * permissions：细粒度权限（按公司可见性 + 能力开关）
 */
export const permissions = sqliteTable(
  'permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    viewCompanyIds: text('view_company_ids'), // JSON: number[]
    allowedPages: text('allowed_pages'), // JSON: string[] (路由前缀)
    canEditContracts: integer('can_edit_contracts', { mode: 'boolean' })
      .notNull()
      .default(false),
    canDeleteContracts: integer('can_delete_contracts', { mode: 'boolean' })
      .notNull()
      .default(false),
    canManageUsers: integer('can_manage_users', { mode: 'boolean' })
      .notNull()
      .default(false),
    canBorrowPaper: integer('can_borrow_paper', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userUnique: uniqueIndex('permissions_user_id_unique').on(t.userId),
  }),
);

/**
 * contracts：合同主表（金额：分；日期：timestamp）
 */
export const contracts = sqliteTable(
  'contracts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contractNo: text('contract_no').notNull(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id),
    title: text('title').notNull(),
    contractType: text('contract_type').notNull(),
    subject: text('subject'),

    partyRole: text('party_role'),
    partyCompany: text('party_company'),
    partyPerson: text('party_person'),
    partyContact: text('party_contact'),

    signDate: integer('sign_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
    totalAmount: integer('total_amount').notNull(), // 分
    currency: text('currency').notNull().default('CNY'),

    primaryHandler: text('primary_handler').references(() => users.username),
    currentHolder: text('current_holder').references(() => users.username),

    status: text('status').notNull().default('草稿'),

    storageLocation: text('storage_location'),
    borrower: text('borrower').references(() => users.username),
    borrowDate: integer('borrow_date', { mode: 'timestamp' }),
    expectedReturnDate: integer('expected_return_date', { mode: 'timestamp' }),
    returnStatus: text('return_status').notNull().default('在库'),

    scanFilePath: text('scan_file_path'),
    scanFileSize: integer('scan_file_size'),
    scanUploadedAt: integer('scan_uploaded_at', { mode: 'timestamp' }),

    lastReminderSent: integer('last_reminder_sent', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    contractNoUnique: uniqueIndex('contracts_contract_no_unique').on(
      t.contractNo,
    ),
    companyIdx: index('contracts_company_id_idx').on(t.companyId),
    statusIdx: index('contracts_status_idx').on(t.status),
    endDateIdx: index('contracts_end_date_idx').on(t.endDate),
    holderIdx: index('contracts_current_holder_idx').on(t.currentHolder),
    typeIdx: index('contracts_contract_type_idx').on(t.contractType),
  }),
);

/** FTS5 虚拟表名（由 initFTS5 创建） */
export const contractsFtsName = 'contracts_fts' as const;

/**
 * payment_schedules：付款节点（百分比存万分之一*10000 的整数：30% -> 300000；金额：分）
 */
export const paymentSchedules = sqliteTable(
  'payment_schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contractId: integer('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    nodeName: text('node_name').notNull(),
    percentage: integer('percentage'), // 30% -> 3000（百分比 * 100，保留两位小数精度）
    amount: integer('amount').notNull(), // 分
    dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
    actualDate: integer('actual_date', { mode: 'timestamp' }),
    status: text('status').notNull().default('待预算'),
    voucherPath: text('voucher_path'),
    remindedBudget: integer('reminded_budget', { mode: 'boolean' })
      .notNull()
      .default(false),
    remindedPayment: integer('reminded_payment', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    contractIdx: index('payment_schedules_contract_id_idx').on(t.contractId),
    dueDateIdx: index('payment_schedules_due_date_idx').on(t.dueDate),
  }),
);

/**
 * reminders：通用提醒（用户自定义）
 */
export const reminders = sqliteTable(
  'reminders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description'),
    creatorId: integer('creator_id')
      .notNull()
      .references(() => users.id),
    remindDate: integer('remind_date', { mode: 'timestamp' }).notNull(),
    remindTime: text('remind_time').notNull().default('09:00'),
    recipients: text('recipients').notNull(), // JSON: string[]
    relatedContractId: integer('related_contract_id').references(
      () => contracts.id,
      { onDelete: 'set null' },
    ),
    status: text('status').notNull().default('待发送'),
    wecomMsgId: text('wecom_msg_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    dateStatusIdx: index('reminders_remind_date_status_idx').on(
      t.remindDate,
      t.status,
    ),
  }),
);

/**
 * reminder_confirmations：提醒确认（“确认收到”）
 */
export const reminderConfirmations = sqliteTable(
  'reminder_confirmations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reminderId: integer('reminder_id')
      .notNull()
      .references(() => reminders.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  },
  (t) => ({
    reminderUserUnique: uniqueIndex('reminder_confirmations_unique').on(
      t.reminderId,
      t.userId,
    ),
  }),
);

/**
 * audit_logs：审计日志（写操作留痕）
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: integer('target_id'),
    details: text('details'), // JSON
    ipAddress: text('ip_address'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userCreatedIdx: index('audit_logs_user_created_idx').on(
      t.userId,
      t.createdAt,
    ),
  }),
);

/**
 * backup_config：备份配置（本地路径/COS 等）
 */
export const backupConfig = sqliteTable('backup_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  localEnabled: integer('local_enabled', { mode: 'boolean' }).notNull().default(false),
  localPath: text('local_path'),
  scheduleTime: text('schedule_time').notNull().default('03:00'),
  keepCount: integer('keep_count').notNull().default(7),
  cosEnabled: integer('cos_enabled', { mode: 'boolean' }).notNull().default(false),
  cosSecretId: text('cos_secret_id'),
  cosSecretKey: text('cos_secret_key'),
  cosBucket: text('cos_bucket'),
  cosRegion: text('cos_region'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedBy: integer('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

/**
 * backup_logs：备份执行记录
 */
export const backupLogs = sqliteTable('backup_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename'),
  path: text('path'),
  size: integer('size'),
  status: text('status'),
  errorMsg: text('error_msg'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * wecom_group_webhooks：企业微信群机器人 Webhook（按用途绑定）
 *
 * purposeKey：FINANCE / HR / OPS / BOARD（固定枚举，便于代码路由）
 */
export const wecomGroupWebhookPurposeEnum = ['FINANCE', 'HR', 'OPS', 'BOARD'] as const;
export type WecomGroupWebhookPurpose = (typeof wecomGroupWebhookPurposeEnum)[number];

export const wecomGroupWebhooks = sqliteTable(
  'wecom_group_webhooks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** 0 表示全局默认；非 0 表示仅该公司主体生效 */
    companyId: integer('company_id').notNull().default(0),
    purposeKey: text('purpose_key', { enum: wecomGroupWebhookPurposeEnum }).notNull(),
    displayName: text('display_name').notNull(),
    webhookUrl: text('webhook_url'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    mentionAllDefault: integer('mention_all_default', { mode: 'boolean' })
      .notNull()
      .default(false),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    companyPurposeUnique: uniqueIndex('wecom_group_webhooks_company_purpose_unique').on(
      t.companyId,
      t.purposeKey,
    ),
  }),
);

export const schema = {
  companies,
  configEnums,
  users,
  userPreferences,
  permissions,
  contracts,
  paymentSchedules,
  reminders,
  reminderConfirmations,
  auditLogs,
  backupConfig,
  backupLogs,
  wecomGroupWebhooks,
};
