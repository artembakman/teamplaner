import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
let connection;
export function rawDatabase(){
 if(connection)return connection;
 const path=process.env.DATABASE_PATH||resolve('data/bueroplan.sqlite');
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 connection=new DatabaseSync(path);
 connection.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 return connection;
}
export function migrate(){
 const d=rawDatabase();
 d.exec('CREATE TABLE IF NOT EXISTS _selfhost_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL)');
 for(const name of readdirSync(resolve('drizzle')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
  const sql=readFileSync(resolve('drizzle',name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const old=d.prepare('SELECT hash FROM _selfhost_migrations WHERE name=?').get(name);
  if(old){if(old.hash!==hash)throw Error('Bereits angewendete Migration verändert: '+name);continue;}
  d.exec('BEGIN IMMEDIATE');
  try{d.exec(sql);d.prepare('INSERT INTO _selfhost_migrations VALUES(?,?)').run(name,hash);d.exec('COMMIT');}
  catch(e){d.exec('ROLLBACK');throw e;}
 }
 d.exec(`CREATE TABLE IF NOT EXISTS local_accounts (
 user_id TEXT PRIMARY KEY REFERENCES members(id), username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
 must_change_password INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS local_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES local_accounts(user_id) ON DELETE CASCADE, expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS local_sessions_expiry ON local_sessions(expires);
 CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);`);
 const accountColumns=d.prepare('PRAGMA table_info(local_accounts)').all().map(row=>row.name);
 if(!accountColumns.includes('must_change_password'))d.exec('ALTER TABLE local_accounts ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}
class Statement {
 constructor(sql,values=[]){this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.sql,values);}
 first(){return rawDatabase().prepare(this.sql).get(...this.values)||null;}
 all(){return {results:rawDatabase().prepare(this.sql).all(...this.values)};}
 run(){const r=rawDatabase().prepare(this.sql).run(...this.values);return {meta:{changes:Number(r.changes)}};}
}
export const adapter={
 prepare(sql){return new Statement(sql);},
 batch(statements){const d=rawDatabase();d.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s.run());d.exec('COMMIT');return r;}catch(e){d.exec('ROLLBACK');throw e;}}
};
