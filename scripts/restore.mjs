// Run ONLY as a one-off container while app and backup services are stopped.
import {DatabaseSync} from 'node:sqlite';
import {copyFileSync,existsSync,unlinkSync,chmodSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
const file=process.argv[2],target=process.env.DATABASE_PATH||resolve('data/bueroplan.sqlite');
if(!file||process.argv[3]!=='--confirm'){console.error('restore.mjs /backups/DATEI.sqlite --confirm; vorher App und Backup stoppen!');process.exit(1);}
const check=new DatabaseSync(file,{readOnly:true});
try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup beschädigt.');check.prepare('SELECT user_id FROM local_accounts LIMIT 1').get();}finally{check.close();}
const temp=target+'.restore';copyFileSync(file,temp);chmodSync(temp,0o600);
const d=new DatabaseSync(temp);d.exec('DELETE FROM local_sessions; DELETE FROM login_attempts; PRAGMA wal_checkpoint(TRUNCATE);');d.close();
for(const suffix of ['-wal','-shm'])if(existsSync(target+suffix))unlinkSync(target+suffix);
renameSync(temp,target);console.log('Datenbank wiederhergestellt. Alle Sitzungen abgemeldet.');
