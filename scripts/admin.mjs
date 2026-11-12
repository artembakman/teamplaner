import {migrate,rawDatabase} from '../server/database.mjs';
import {hashPassword} from '../server/security.mjs';
import {randomUUID} from 'node:crypto';
import {emitKeypressEvents} from 'node:readline';
const [command,rawAlias,team,role='member']=process.argv.slice(2);
function fail(s){console.error(s);process.exit(1);}
async function password(label){
 if(!process.stdin.isTTY)throw Error('Bitte interaktiv mit docker compose exec -it ausführen.');
 process.stdout.write(label);emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let s='';const onkey=(text,key)=>{if(key?.ctrl&&key.name==='c'){cleanup();reject(Error('Abgebrochen'));return;}if(key?.name==='return'){cleanup();resolve(s);return;}if(key?.name==='backspace'){s=s.slice(0,-1);return;}if(text&&!key?.ctrl&&!/[\x00-\x1f\x7f]/.test(text))s+=text;};function cleanup(){process.stdin.off('keypress',onkey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('keypress',onkey);});
}
try{
 migrate();const d=rawDatabase();
 if(command==='list'){console.table(d.prepare('SELECT m.alias,m.team,m.role,a.disabled FROM members m JOIN local_accounts a ON a.user_id=m.id ORDER BY m.alias').all());process.exit(0);}
 const alias=String(rawAlias||'').toUpperCase();if(!/^[A-Z0-9]{2,6}$/.test(alias))fail('Kürzel: 2–6 Buchstaben oder Ziffern.');
 const existing=d.prepare('SELECT * FROM local_accounts WHERE username=?').get(alias);
 if(command==='add'){
  if(existing)fail('Konto existiert bereits.');if(!d.prepare('SELECT 1 FROM teams WHERE id=? AND is_assignable=1').get(team)||!['admin','member'].includes(role))fail('Bitte eine vorhandene Team-ID und die Rolle admin oder member angeben. Team-IDs: '+d.prepare('SELECT id FROM teams WHERE is_assignable=1 ORDER BY sort_order').all().map(x=>x.id).join(', '));
  if(!d.prepare('SELECT 1 FROM local_accounts LIMIT 1').get()&&role!=='admin')fail('Das erste Konto muss die Rolle admin erhalten.');
 }else if(!existing)fail('Konto nicht gefunden.');
 if(command==='disable'||command==='enable'){
  if(command==='disable'){
   const me=d.prepare('SELECT role FROM members WHERE id=?').get(existing.user_id);
   const admins=d.prepare("SELECT COUNT(*) n FROM members m JOIN local_accounts a ON a.user_id=m.id WHERE m.role='admin' AND a.disabled=0").get().n;
   if(me.role==='admin'&&!existing.disabled&&admins<=1)fail('Das letzte aktive Administratorkonto darf nicht gesperrt werden.');
  }
  d.exec('BEGIN IMMEDIATE');try{d.prepare('UPDATE local_accounts SET disabled=? WHERE user_id=?').run(command==='disable'?1:0,existing.user_id);d.prepare('DELETE FROM local_sessions WHERE user_id=?').run(existing.user_id);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}
  console.log('Kontostatus geändert.');process.exit(0);
 }
 if(!['add','reset'].includes(command))fail('Aufruf: add KÜRZEL TEAM-ID [admin|member] | reset KÜRZEL | disable KÜRZEL | enable KÜRZEL | list');
 const first=await password('Neues Passwort (mind. 12 Zeichen, unsichtbar): '),second=await password('Wiederholen: ');
 if(first!==second)fail('Passwörter stimmen nicht überein.');const hash=hashPassword(first);
 d.exec('BEGIN IMMEDIATE');try{
  if(command==='add'){
   const id=randomUUID();d.prepare('INSERT INTO members(id,alias,role,created,team) VALUES(?,?,?,?,?)').run(id,alias,role,new Date().toISOString(),team);
   d.prepare('INSERT INTO local_accounts(user_id,username,password_hash) VALUES(?,?,?)').run(id,alias,hash);
   d.prepare('INSERT OR IGNORE INTO settings VALUES(1,?,0)').run(randomUUID());
   d.prepare("INSERT OR IGNORE INTO capacities VALUES('2000-01-01',6,6,'block')").run();
  }else{d.prepare('UPDATE local_accounts SET password_hash=? WHERE user_id=?').run(hash,existing.user_id);d.prepare('DELETE FROM local_sessions WHERE user_id=?').run(existing.user_id);}
  d.exec('COMMIT');
 }catch(e){d.exec('ROLLBACK');throw e;}
 console.log('Konto gespeichert. Passwort getrennt und sicher an die betreffende Person übergeben.');
}catch(e){fail(e.message);}
