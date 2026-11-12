import {makeBackup} from './backup.mjs';
import {readdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
while(true){
 try{const file=await makeBackup();console.log('Backup erstellt:',file);
 const dir=process.env.BACKUP_DIR||resolve('backups');const files=readdirSync(dir).filter(f=>/^bueroplan-.*\.sqlite$/.test(f)).sort().reverse();
 for(const f of files.slice(14))unlinkSync(resolve(dir,f));
 }catch(e){console.error('Backup fehlgeschlagen:',e.message);}
 await new Promise(r=>setTimeout(r,24*3600*1000));
}
