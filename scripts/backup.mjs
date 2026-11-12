import {backup,DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
export async function makeBackup(){
 const source=process.env.DATABASE_PATH||resolve('data/bueroplan.sqlite');if(!existsSync(source))throw Error('Noch keine Datenbank vorhanden.');
 const dir=process.env.BACKUP_DIR||resolve('backups');mkdirSync(dir,{recursive:true,mode:0o700});
 const file=resolve(dir,'bueroplan-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite'),temp=file+'.partial';
 const d=new DatabaseSync(source,{readOnly:true});
 try{await backup(d,temp);const check=new DatabaseSync(temp,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup-Prüfung fehlgeschlagen.');}finally{check.close();}chmodSync(temp,0o600);renameSync(temp,file);return file;}catch(e){if(existsSync(temp))unlinkSync(temp);throw e;}finally{d.close();}
}
if(process.argv[1]?.endsWith('/backup.mjs'))console.log(await makeBackup());
