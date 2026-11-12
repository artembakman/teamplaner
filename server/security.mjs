import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {rawDatabase} from './database.mjs';
export const cookieName='bueroplan_session';
export function appOrigin(){
 const raw=process.env.APP_ORIGIN;if(!raw)throw Error('APP_ORIGIN fehlt');
 const u=new URL(raw);
 if(u.origin!==raw||!['http:','https:'].includes(u.protocol))throw Error('APP_ORIGIN muss eine Origin ohne abschließenden Schrägstrich sein.');
 if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('HTTP ist nur für lokale Tests erlaubt.');
 return raw;
}
export function sameOrigin(req){return req.headers.get('origin')===appOrigin();}
export function hashPassword(password){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Passwort: 12–256 Zeichen.');
 const salt=randomBytes(16).toString('hex');
 return `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>256)return false;
 const [method,salt,expected]=String(stored).split('$');
 if(method!=='scrypt'||!salt||!expected)return false;
 const actual=scryptSync(password,salt,64),target=Buffer.from(expected,'hex');
 return target.length===actual.length&&timingSafeEqual(target,actual);
}
const digest=value=>createHash('sha256').update(value).digest('hex');
export function sessionUser(token,allowPasswordChange=false){
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 return rawDatabase().prepare(`SELECT a.user_id FROM local_sessions s JOIN local_accounts a ON a.user_id=s.user_id
 WHERE s.token_hash=? AND s.expires>? AND a.disabled=0 AND (?=1 OR a.must_change_password=0)`).get(digest(token),Date.now(),Number(allowPasswordChange))?.user_id||null;
}
export function newSession(userId){
 const d=rawDatabase(),token=randomBytes(32).toString('hex');
 d.prepare('DELETE FROM local_sessions WHERE expires<?').run(Date.now());
 d.prepare('INSERT INTO local_sessions VALUES(?,?,?)').run(digest(token),userId,Date.now()+12*3600*1000);return token;
}
export function endSession(token){if(token)rawDatabase().prepare('DELETE FROM local_sessions WHERE token_hash=?').run(digest(token));}
export function loginAllowed(username,ip){
 const d=rawDatabase(),now=Date.now();d.prepare('DELETE FROM login_attempts WHERE until<?').run(now);
 const keys=['user:'+username,'ip:'+digest(ip)];
 return keys.every(key=>Number(d.prepare('SELECT count FROM login_attempts WHERE key=?').get(key)?.count||0)<(key.startsWith('user:')?10:50));
}
export function recordAttempt(username,ip){
 const d=rawDatabase();for(const key of ['user:'+username,'ip:'+digest(ip)])d.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,Date.now()+15*60000);
}
export function cookieOptions(){return {httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/',maxAge:12*3600};}
