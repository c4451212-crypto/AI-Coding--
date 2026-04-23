import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { db, runMigrations, sqlite } from '../lib/db/index';
import {
  companies,
  configEnums,
  permissions,
  userPreferences,
  users,
} from '../lib/db/schema';

async function seed() {
  console.log('[seed] running migrations + FTS5...');
  runMigrations();

  console.log('[seed] inserting companies...');
  const companyData = [
    { name: '母公司全称', shortName: '母', type: '母公司' as const },
    { name: '子公司A全称', shortName: '子A', type: '子公司' as const },
    { name: '子公司B全称', shortName: '子B', type: '子公司' as const },
    { name: '项目公司全称', shortName: '项目X', type: '项目公司' as const },
  ];

  for (const c of companyData) {
    await db.insert(companies).values(c).onConflictDoNothing({
      target: companies.shortName,
    });
  }

  console.log('[seed] inserting enums...');
  const enumData = [
    { category: 'contract_type', code: '租赁', name: '租赁', sortOrder: 1 },
    { category: 'contract_type', code: '人力', name: '人力资源', sortOrder: 2 },
    { category: 'contract_type', code: '外包', name: '业务外包', sortOrder: 3 },
    { category: 'contract_type', code: '合作', name: '商务合作', sortOrder: 4 },
    { category: 'contract_type', code: '采购', name: '采购供应', sortOrder: 5 },
    { category: 'contract_type', code: '销售', name: '销售合同', sortOrder: 6 },
    { category: 'contract_type', code: '其他', name: '其他类型', sortOrder: 99 },

    { category: 'party_role', code: '甲方', name: '甲方', sortOrder: 1 },
    { category: 'party_role', code: '乙方', name: '乙方', sortOrder: 2 },
    { category: 'party_role', code: '丙方', name: '丙方', sortOrder: 3 },
    { category: 'party_role', code: '丁方', name: '丁方', sortOrder: 4 },

    { category: 'currency', code: 'CNY', name: '人民币', sortOrder: 1 },
    { category: 'currency', code: 'USD', name: '美元', sortOrder: 2 },

    { category: 'contract_status', code: '草稿', name: '草稿', sortOrder: 1 },
    { category: 'contract_status', code: '审批中', name: '审批中', sortOrder: 2 },
    { category: 'contract_status', code: '生效', name: '生效', sortOrder: 3 },
    { category: 'contract_status', code: '履行中', name: '履行中', sortOrder: 4 },
    { category: 'contract_status', code: '即将到期', name: '即将到期', sortOrder: 5 },
    { category: 'contract_status', code: '已到期', name: '已到期', sortOrder: 6 },
    { category: 'contract_status', code: '已终止', name: '已终止', sortOrder: 7 },
    { category: 'contract_status', code: '已完结', name: '已完结', sortOrder: 8 },

    { category: 'return_status', code: '在库', name: '在库', sortOrder: 1 },
    { category: 'return_status', code: '已借出', name: '已借出', sortOrder: 2 },
    { category: 'return_status', code: '已归还', name: '已归还', sortOrder: 3 },
    { category: 'return_status', code: '逾期', name: '逾期', sortOrder: 4 },
  ] as const;

  for (const e of enumData) {
    await db
      .insert(configEnums)
      .values(e)
      .onConflictDoNothing({ target: [configEnums.category, configEnums.code] });
  }

  console.log('[seed] upserting admin user...');
  const passwordHash = bcrypt.hashSync('admin123', 10);

  await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash,
      name: '系统管理员',
      role: 'admin',
    })
    .onConflictDoNothing({ target: users.username });

  const adminRows = await db
    .select()
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const admin = adminRows[0];
  if (!admin) {
    throw new Error('admin user missing after upsert');
  }

  await db
    .insert(userPreferences)
    .values({ userId: admin.id })
    .onConflictDoNothing({ target: userPreferences.userId });

  const allCompanies = await db.select().from(companies);
  const viewCompanyIds = allCompanies.map((c) => c.id);

  const defaultAllowedPages = [
    '/',
    '/contracts',
    '/archives',
    '/reminders',
    '/settings',
  ];

  await db
    .insert(permissions)
    .values({
      userId: admin.id,
      viewCompanyIds: JSON.stringify(viewCompanyIds),
      allowedPages: JSON.stringify(defaultAllowedPages),
      canEditContracts: true,
      canDeleteContracts: true,
      canManageUsers: true,
      canBorrowPaper: true,
    })
    .onConflictDoNothing({ target: permissions.userId });

  console.log('[seed] done. admin / admin123');
}

seed()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    sqlite.close();
  });
