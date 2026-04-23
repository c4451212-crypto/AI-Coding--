/* eslint-disable no-console */
const Database = require('better-sqlite3');

const db = new Database('./dev.db');

const tables = db
  .prepare("select name from sqlite_master where type='table' order by name")
  .all()
  .map((r) => r.name);

const out = { tables };

try {
  out.userCount = db.prepare('select count(*) as c from users').get().c;
  out.companyCount = db.prepare('select count(*) as c from companies').get().c;
  out.enumCount = db.prepare('select count(*) as c from config_enums').get().c;
  out.admin = db
    .prepare('select id,username,name,role,is_active from users where username=?')
    .get('admin');
} catch (e) {
  out.error = String(e && e.message ? e.message : e);
}

console.log(JSON.stringify(out, null, 2));
db.close();

