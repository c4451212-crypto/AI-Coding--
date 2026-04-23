/* eslint-disable no-console */
import cron from 'node-cron';

import {
  sendContractExpiringReminders,
  sendGeneralReminders,
  sendPaymentBudgetReminders,
  sendPaymentDueReminders,
} from '@/lib/services/reminder-sender';

function now() {
  return new Date().toISOString();
}

async function run(name: string, fn: () => Promise<void>) {
  console.log(`[${now()}] [cron] start ${name}`);
  try {
    await fn();
    console.log(`[${now()}] [cron] done ${name}`);
  } catch (e) {
    console.error(`[${now()}] [cron] failed ${name}`, e);
  }
}

console.log(`[${now()}] [cron] service started`);

cron.schedule('*/5 * * * *', () => run('general-reminders', sendGeneralReminders), {
  timezone: 'Asia/Shanghai',
});

cron.schedule('0 9 * * *', () => run('contract-expiring', sendContractExpiringReminders), {
  timezone: 'Asia/Shanghai',
});

cron.schedule('0 9 * * *', () => run('payment-budget', sendPaymentBudgetReminders), {
  timezone: 'Asia/Shanghai',
});

cron.schedule('5 9 * * *', () => run('payment-due', sendPaymentDueReminders), {
  timezone: 'Asia/Shanghai',
});

process.stdin.resume();

