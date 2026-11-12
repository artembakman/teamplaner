import {cookies} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {rawDatabase} from '@/server/database.mjs';
import {sameOrigin,verifyPassword,hashPassword,newSession,cookieName,cookieOptions} from '@/server/security.mjs';
export async function POST(req:Request){
 if(!sameOrigin(req))return new Response('Nicht erlaubt',{status:403});
 const u=await getChatGPTUser(true);if(!u)return new Response('Bitte anmelden',{status:401});
 const b=await req.json().catch(()=>null),d=rawDatabase();
 const a=d.prepare('SELECT password_hash FROM local_accounts WHERE user_id=?').get(u.userId) as any;
 if(!verifyPassword(b?.current,a?.password_hash))return Response.json({error:'Aktuelles Passwort stimmt nicht.'},{status:400});
 let hash;try{hash=hashPassword(b?.password);}catch{return Response.json({error:'Neues Passwort: 12–256 Zeichen.'},{status:400});}
 d.exec('BEGIN IMMEDIATE');try{d.prepare('UPDATE local_accounts SET password_hash=?,must_change_password=0 WHERE user_id=?').run(hash,u.userId);d.prepare('DELETE FROM local_sessions WHERE user_id=?').run(u.userId);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}
 (await cookies()).set(cookieName,newSession(u.userId),cookieOptions() as any);return Response.json({ok:true});
}
