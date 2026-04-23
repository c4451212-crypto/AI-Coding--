/* eslint-disable no-console */
/**
 * 独立定时任务入口（node-cron）
 *
 * 容器启动后常驻，按计划执行：
 * - 通用提醒（每 5 分钟）
 * - 合同到期提醒（每日 09:00）
 * - 付款预算提醒（每日 09:00）
 * - 付款执行提醒（每日 09:05）
 */

const cron = require('node-cron');

const sender = require('./reminder-sender');

function now() {
  return new Date().toISOString();
}

async function run(name, fn) {
  console.log(`[${now()}] [cron] start ${name}`);
  try {
    await fn();
    console.log(`[${now()}] [cron] done ${name}`);
  } catch (e) {
    console.error(`[${now()}] [cron] failed ${name}`, e);
  }
}

console.log(`[${now()}] [cron] service started`);

// 每 5 分钟检查一次通用提醒（按 remindDate + remindTime 到点发送）
cron.schedule('*/5 * * * *', () => run('general-reminders', sender.sendGeneralReminders), {
  timezone: 'Asia/Shanghai',
});

// 每日 09:00 合同到期提醒
cron.schedule('0 9 * * *', () => run('contract-expiring', sender.sendContractExpiringReminders), {
  timezone: 'Asia/Shanghai',
});

// 每日 09:00 付款预算提醒（到期前 30 天）
cron.schedule('0 9 * * *', () => run('payment-budget', sender.sendPaymentBudgetReminders), {
  timezone: 'Asia/Shanghai',
});

// 每日 09:05 付款执行提醒（到期前 7 天，需 payment_schedules.status = 待支付）
cron.schedule('5 9 * * *', () => run('payment-due', sender.sendPaymentDueReminders), {
  timezone: 'Asia/Shanghai',
});

process.on('SIGTERM', () => {
  console.log(`[${now()}] [cron] SIGTERM received, shutting down`);
  try {
    sender.close();
  } catch {
    // ignore
  }
  process.exit(0);
});

process.stdin.resume();
