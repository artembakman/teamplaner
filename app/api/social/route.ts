import {sameOrigin} from '@/server/security.mjs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/db/raw';
import {personalIcons,validBirthday,validDate,weekday} from '@/lib/calendar';
import {notifyEveryone,notifyTeam,notifyUsers} from '@/server/notifications.mjs';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>Response.json({error},{status});
const queueNotification=(send:()=>void)=>{try{send()}catch(error){console.error('Mitteilung konnte nicht vorgemerkt werden:',error)}};
export async function POST(req:Request){try{
 if(!sameOrigin(req))return fail('Anfrage nicht erlaubt.',403);
 const u=await getChatGPTUser();if(!u)return fail('Bitte anmelden.',401);
 const d=db(),me=await d.prepare('SELECT * FROM members WHERE id=?').bind(u.userId).first<any>();if(!me)return fail('Bitte zuerst registrieren.',403);
 const b:any=await req.json();if(!b||typeof b!=='object')return fail('Ungültige Anfrage.');
 if(b.action==='profile'){
 if(typeof b.team!=='string'||!await d.prepare('SELECT 1 FROM teams WHERE id=? AND is_assignable=1').bind(b.team).first()||!personalIcons.includes(b.icon)||typeof b.birthday!=='string'||!validBirthday(b.birthday)||![0,1].includes(b.reminders))return fail('Bitte Team, Symbol und einen gültigen Geburtstag wählen.');
 await d.prepare('UPDATE members SET team=?,icon=?,birthday=?,birthday_reminders=? WHERE id=?').bind(b.team,b.icon,b.birthday,b.reminders,u.userId).run();return Response.json({ok:true});}
 if(['teamday','cancelTeamday'].includes(b.action)){
 if(me.role!=='admin')return fail('Team-Tage werden von der Administration geplant.',403);
 if(b.action==='cancelTeamday'){
 if(typeof b.id!=='string')return fail('Ungültiger Team-Tag.');
 const old=await d.prepare('SELECT team,day FROM team_days WHERE id=?').bind(b.id).first<any>();if(!old)return fail('Team-Tag nicht gefunden.',404);
 await d.prepare('DELETE FROM team_days WHERE id=?').bind(b.id).run();
 queueNotification(()=>notifyTeam(old.team,{eventKey:`teamday-cancel:${b.id}:${new Date().toISOString()}`,code:'teamday_cancelled',body:`Der Team-Tag am ${old.day} wurde abgesagt.`}));return Response.json({ok:true});
 }
 const selectedTeam=typeof b.team==='string'?await d.prepare('SELECT id,name,is_assignable FROM teams WHERE id=?').bind(b.team).first<any>():null;
 if(!selectedTeam||!selectedTeam.is_assignable||b.team==='leitung'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.month))return fail('Bitte Team und Monat auswählen.');
 const selectedSite=typeof b.site==='string'?await d.prepare("SELECT id,label FROM booking_categories WHERE id=? AND requires_capacity=1").bind(b.site).first<any>():null;
 if(!validDate(b.day)||b.day.slice(0,7)!==b.month||[0,6].includes(weekday(b.day))||!selectedSite)return fail('Bitte einen Wochentag im ausgewählten Monat und einen Bürostandort wählen.');
 if(await d.prepare('SELECT day FROM holidays WHERE day=?').bind(b.day).first())return fail('An Feiertagen kann kein Team-Tag geplant werden.');
 const editing=typeof b.id==='string'&&b.id.length>0;
 const existing=editing?await d.prepare('SELECT id,team FROM team_days WHERE id=?').bind(b.id).first<any>():null;
 if(editing&&(!existing||existing.team!==b.team))return fail('Team-Tag nicht gefunden oder gehört zu einem anderen Team.',404);
 const duplicate=await d.prepare('SELECT id FROM team_days WHERE team=? AND day=? AND id<>?').bind(b.team,b.day,editing?b.id:'').first<any>();
 if(duplicate)return fail('Für dieses Team ist an diesem Datum bereits ein Team-Tag geplant.',409);
 const updated=new Date().toISOString();
 const teamDayId=editing?b.id:crypto.randomUUID();
 if(editing)await d.prepare('UPDATE team_days SET month=?,day=?,site=?,updated=? WHERE id=?').bind(b.month,b.day,b.site,updated,b.id).run();
 else await d.prepare('INSERT INTO team_days (id,team,month,day,site,updated) VALUES (?,?,?,?,?,?)').bind(teamDayId,b.team,b.month,b.day,b.site,updated).run();
 queueNotification(()=>notifyTeam(b.team,{eventKey:`teamday:${teamDayId}:${updated}`,code:'teamday_planned',body:`${selectedTeam.name} trifft sich am ${b.day} in ${selectedSite.label}.`}));return Response.json({ok:true});}
 if(b.action==='event'){
 const title=typeof b.title==='string'?b.title.trim():'';
 const eventSite=typeof b.site==='string'&&b.site!=='other'?await d.prepare("SELECT id FROM booking_categories WHERE id=? AND requires_capacity=1").bind(b.site).first<any>():null;
 if(!title||title.length>80||!validDate(b.day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)||!(b.site==='other'||eventSite))return fail('Bitte Titel, Datum, Uhrzeit und Ort vollständig angeben.');
 let eventId:string; const editing=Boolean(b.id); if(b.id){const e=await d.prepare('SELECT creator FROM events WHERE id=?').bind(b.id).first<any>();if(!e)return fail('Termin nicht gefunden.',404);if(e.creator!==u.userId&&me.role!=='admin')return fail('Du kannst nur eigene Termine bearbeiten.',403);
 eventId=b.id;await d.prepare('UPDATE events SET title=?,day=?,time=?,site=? WHERE id=?').bind(title,b.day,b.time,b.site,b.id).run();}
 else {eventId=crypto.randomUUID();await d.prepare('INSERT INTO events (id,creator,title,day,time,site) VALUES (?,?,?,?,?,?)').bind(eventId,u.userId,title,b.day,b.time,b.site).run();}
 queueNotification(()=>notifyEveryone({eventKey:`event:${eventId}:${new Date().toISOString()}`,code:editing?'event_updated':'event_created',body:`${title} · ${b.day}, ${b.time} Uhr`,url:'/'},u.userId));
 return Response.json({ok:true});}
 if(b.action==='cancelEvent'){
 const e=await d.prepare('SELECT creator,title,day FROM events WHERE id=?').bind(b.id).first<any>();if(!e)return fail('Termin nicht gefunden.',404);if(e.creator!==u.userId&&me.role!=='admin')return fail('Du kannst nur eigene Termine absagen.',403);
 const attendeeRows=await d.prepare('SELECT user_id FROM attendees WHERE event_id=?').bind(b.id).all<any>();await d.prepare('DELETE FROM events WHERE id=?').bind(b.id).run();queueNotification(()=>notifyUsers([...attendeeRows.results.map((x:any)=>x.user_id),e.creator].filter((x:string)=>x!==u.userId),{eventKey:`event-cancel:${b.id}:${new Date().toISOString()}`,code:'event_cancelled',body:`${e.title} am ${e.day} wurde abgesagt.`}));return Response.json({ok:true});}
 if(b.action==='rsvp'){
 if(typeof b.join!=='boolean')return fail('Ungültige Zusage.');if(!await d.prepare('SELECT id FROM events WHERE id=?').bind(b.id).first())return fail('Dieser Termin wurde abgesagt.',404);
 if(b.join)await d.prepare('INSERT OR IGNORE INTO attendees (event_id,user_id) VALUES (?,?)').bind(b.id,u.userId).run();else await d.prepare('DELETE FROM attendees WHERE event_id=? AND user_id=?').bind(b.id,u.userId).run();return Response.json({ok:true});}
 return fail('Unbekannte Aktion.');
 }catch(e){console.error(e);if(String(e).includes('team_days.team, team_days.day'))return fail('Für dieses Team ist an diesem Datum bereits ein Team-Tag geplant.',409);return fail('Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.',503)}}
