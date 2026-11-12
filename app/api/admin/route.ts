import {randomBytes,randomUUID} from 'node:crypto';
import {sameOrigin,hashPassword} from '@/server/security.mjs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {rawDatabase} from '@/server/database.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>Response.json({error},{status});
const tempPassword=()=>randomBytes(18).toString('base64url');

export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return fail('Anfrage nicht erlaubt.',403);
  const user=await getChatGPTUser();if(!user)return fail('Bitte anmelden.',401);
  const d=rawDatabase(),me=d.prepare('SELECT role FROM members WHERE id=?').get(user.userId) as any;
  if(me?.role!=='admin')return fail('Nur Administratoren dürfen Mitglieder verwalten.',403);
  const b:any=await req.json().catch(()=>null);if(!b||typeof b!=='object')return fail('Ungültige Anfrage.');

  if(b.action==='createMember'){
   const alias=typeof b.alias==='string'?b.alias.trim().toUpperCase():'';
   if(!/^[A-Z0-9]{2,6}$/.test(alias))return fail('Das Kürzel muss 2–6 Buchstaben oder Ziffern enthalten.');
   if(!['admin','member'].includes(b.role))return fail('Bitte eine gültige Rolle auswählen.');
   const team=typeof b.team==='string'?d.prepare('SELECT id FROM teams WHERE id=? AND is_assignable=1').get(b.team):null;
   if(!team)return fail('Bitte ein vorhandenes Team auswählen.');
   if(d.prepare('SELECT 1 FROM local_accounts WHERE username=? COLLATE NOCASE').get(alias)||d.prepare('SELECT 1 FROM members WHERE alias=? COLLATE NOCASE').get(alias))return fail('Dieses Kürzel ist bereits vergeben.',409);
   const id=randomUUID(),initialPassword=tempPassword(),passwordHash=hashPassword(initialPassword),now=new Date().toISOString();
   d.exec('BEGIN IMMEDIATE');try{
    d.prepare('INSERT INTO members(id,alias,role,created,team) VALUES(?,?,?,?,?)').run(id,alias,b.role,now,b.team);
    d.prepare('INSERT INTO local_accounts(user_id,username,password_hash,must_change_password) VALUES(?,?,?,1)').run(id,alias,passwordHash);
    d.exec('COMMIT');
   }catch(e){d.exec('ROLLBACK');throw e;}
   return Response.json({ok:true,member:{id,alias,role:b.role,team:b.team},initialPassword},{headers:{'Cache-Control':'no-store'}});
  }

  if(b.action==='updateMember'){
   if(typeof b.userId!=='string'||!['admin','member'].includes(b.role))return fail('Ungültige Mitgliedsdaten.');
   const target=d.prepare('SELECT m.id,m.role,a.disabled FROM members m LEFT JOIN local_accounts a ON a.user_id=m.id WHERE m.id=?').get(b.userId) as any;
   if(!target)return fail('Mitglied nicht gefunden.',404);
   if(typeof b.team!=='string'||!d.prepare("SELECT 1 FROM teams WHERE id=? AND (is_assignable=1 OR id='open')").get(b.team))return fail('Bitte ein vorhandenes Team auswählen.');
   if(target.role==='admin'&&b.role==='member'&&target.disabled===0){
    const count=(d.prepare("SELECT COUNT(*) n FROM members m JOIN local_accounts a ON a.user_id=m.id WHERE m.role='admin' AND a.disabled=0").get() as any).n;
    if(count<=1)return fail('Das letzte Administratorkonto kann nicht herabgestuft werden.',409);
   }
   d.prepare('UPDATE members SET role=?,team=? WHERE id=?').run(b.role,b.team,b.userId);
   return Response.json({ok:true});
  }

  if(b.action==='resetPassword'){
   if(typeof b.userId!=='string')return fail('Ungültiges Mitglied.');
   const target=d.prepare('SELECT id,alias FROM members WHERE id=?').get(b.userId) as any;if(!target)return fail('Mitglied nicht gefunden.',404);
   const account=d.prepare('SELECT user_id FROM local_accounts WHERE user_id=?').get(target.id);if(!account)return fail('Für dieses Mitglied wurde kein Konto gefunden.',404);
   const initialPassword=tempPassword(),passwordHash=hashPassword(initialPassword);
   d.exec('BEGIN IMMEDIATE');try{
    d.prepare('UPDATE local_accounts SET password_hash=?,must_change_password=1 WHERE user_id=?').run(passwordHash,target.id);
    d.prepare('DELETE FROM local_sessions WHERE user_id=?').run(target.id);
    d.exec('COMMIT');
   }catch(e){d.exec('ROLLBACK');throw e;}
   return Response.json({ok:true,alias:target.alias,initialPassword},{headers:{'Cache-Control':'no-store'}});
  }

  if(b.action==='deleteMember'){
   if(typeof b.userId!=='string')return fail('Ungültiges Mitglied.');
   if(b.userId===user.userId)return fail('Du kannst dein eigenes Administratorkonto nicht löschen.',409);
   const target=d.prepare('SELECT m.id,m.alias,m.role,a.disabled FROM members m LEFT JOIN local_accounts a ON a.user_id=m.id WHERE m.id=?').get(b.userId) as any;if(!target)return fail('Mitglied nicht gefunden.',404);
   if(target.role==='admin'&&target.disabled===0){
    const count=(d.prepare("SELECT COUNT(*) n FROM members m JOIN local_accounts a ON a.user_id=m.id WHERE m.role='admin' AND a.disabled=0").get() as any).n;
    if(count<=1)return fail('Das letzte Administratorkonto kann nicht gelöscht werden.',409);
   }
   d.exec('BEGIN IMMEDIATE');try{
    d.prepare('DELETE FROM attendees WHERE user_id=? OR event_id IN (SELECT id FROM events WHERE creator=?)').run(target.id,target.id);
    d.prepare('DELETE FROM events WHERE creator=?').run(target.id);
    d.prepare('DELETE FROM bookings WHERE user_id=?').run(target.id);
    d.prepare('DELETE FROM allowances WHERE user_id=?').run(target.id);
    d.prepare('DELETE FROM local_sessions WHERE user_id=?').run(target.id);
    d.prepare('DELETE FROM local_accounts WHERE user_id=?').run(target.id);
    d.prepare('DELETE FROM members WHERE id=?').run(target.id);
    d.prepare('DELETE FROM login_attempts WHERE key=?').run('user:'+target.alias);
    d.exec('COMMIT');
   }catch(e){d.exec('ROLLBACK');throw e;}
   return Response.json({ok:true});
  }
  return fail('Unbekannte Aktion.');
 }catch(error){console.error('Admin-Aktion fehlgeschlagen:',error);return fail('Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',503);}
}
