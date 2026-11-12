import {cookies} from 'next/headers';
import {rawDatabase} from '@/server/database.mjs';
import {sameOrigin,verifyPassword,newSession,cookieName,cookieOptions,loginAllowed,recordAttempt} from '@/server/security.mjs';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'Anfrage nicht erlaubt.'},{status:403});
 const b=await req.json().catch(()=>null);const username=String(b?.username||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{2,6}$/.test(username)||typeof b?.password!=='string'||b.password.length>256)return Response.json({error:'Kürzel oder Passwort ungültig.'},{status:400});
 const ip=req.headers.get('x-real-ip')||'local';
 if(!loginAllowed(username,ip))return Response.json({error:'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.'},{status:429});
 recordAttempt(username,ip);
 const a=rawDatabase().prepare('SELECT * FROM local_accounts WHERE username=?').get(username) as any;
 // Fixed valid scrypt hash for a constant-time-ish unknown-user verification path.
 const dummy='scrypt$00000000000000000000000000000000$'+'00'.repeat(64);
 const correct=verifyPassword(b.password,a?.password_hash||dummy);
 if(!correct||!a||a.disabled)return Response.json({error:'Kürzel oder Passwort ungültig.'},{status:401});
 rawDatabase().prepare('DELETE FROM login_attempts WHERE key=?').run('user:'+username);
 (await cookies()).set(cookieName,newSession(a.user_id),cookieOptions() as any);
 return Response.json({ok:true,mustChangePassword:Boolean(a.must_change_password)},{headers:{'Cache-Control':'no-store'}});
}
