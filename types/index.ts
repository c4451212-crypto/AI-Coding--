import type * as schema from '@/lib/db/schema';

export type Company = typeof schema.companies.$inferSelect;
export type NewCompany = typeof schema.companies.$inferInsert;

export type ConfigEnum = typeof schema.configEnums.$inferSelect;
export type NewConfigEnum = typeof schema.configEnums.$inferInsert;

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;

export type UserPreference = typeof schema.userPreferences.$inferSelect;
export type NewUserPreference = typeof schema.userPreferences.$inferInsert;

export type Permission = typeof schema.permissions.$inferSelect;
export type NewPermission = typeof schema.permissions.$inferInsert;

export type Contract = typeof schema.contracts.$inferSelect;
export type NewContract = typeof schema.contracts.$inferInsert;

export type PaymentSchedule = typeof schema.paymentSchedules.$inferSelect;
export type NewPaymentSchedule = typeof schema.paymentSchedules.$inferInsert;

export type Reminder = typeof schema.reminders.$inferSelect;
export type NewReminder = typeof schema.reminders.$inferInsert;

export type ReminderConfirmation = typeof schema.reminderConfirmations.$inferSelect;
export type NewReminderConfirmation =
  typeof schema.reminderConfirmations.$inferInsert;

export type AuditLog = typeof schema.auditLogs.$inferSelect;
export type NewAuditLog = typeof schema.auditLogs.$inferInsert;

export type BackupConfig = typeof schema.backupConfig.$inferSelect;
export type NewBackupConfig = typeof schema.backupConfig.$inferInsert;

export type BackupLog = typeof schema.backupLogs.$inferSelect;
export type NewBackupLog = typeof schema.backupLogs.$inferInsert;

export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
