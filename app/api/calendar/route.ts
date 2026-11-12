import {sameOrigin} from '@/server/security.mjs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/db/raw';
import {validDate,daysBetween,today} from '@/lib/calendar';
export const dynamic='force-dynamic';
const fail=(message:string,status=400)=>Response.json({error:message},{status});
const categoryKinds=['attendance','vacation','absence','dayoff'];
function normalizedCategory(b:any):any{
 if(typeof b.label!=='string'||typeof b.short_label!=='string'||!categoryKinds.includes(b.kind)||typeof b.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(b.color))return null;
 const label=b.label.trim().replace(/\s+/g,' '),shortLabel=b.short_label.trim();
 if(label.length<2||label.length>40||shortLabel.length<1||shortLabel.length>4)return null;
 const attendance=b.kind==='attendance';
 const requiresCapacity=attendance&&b.requiresCapacity===true;
 const countsForAttendance=attendance&&b.countsForAttendance===true;
 const countsForWecker=attendance&&b.countsForWecker===true;
 if(countsForWecker&&!countsForAttendance)return null;
 if(requiresCapacity&&(!Number.isInteger(b.places)||b.places<0||b.places>100))return null;
 if(b.capacityMode!==undefined&&!['block','warn'].includes(b.capacityMode))return null;
 return {label,shortLabel,kind:b.kind,color:b.color,requiresCapacity,countsForAttendance,countsForWecker,places:requiresCapacity?b.places:0,capacityMode:b.capacityMode==='warn'?'warn':'block'};
}
function categoryImpactPreview(d:any,id:string,next:any){
 const categories=d.prepare('SELECT id,kind,requires_capacity,counts_for_attendance,counts_for_wecker FROM booking_categories').all();
 const byId=new Map<string,any>(categories.map((c:any)=>[c.id,c]));
 const current=byId.get(id);if(!current)return null;
 const bookings=d.prepare("SELECT user_id,day,status FROM bookings WHERE day NOT IN (SELECT day FROM holidays) AND strftime('%w',day) NOT IN ('0','6') ORDER BY day").all();
 const categoryFor=(status:string,after:boolean)=>{const c=byId.get(status);return !c?null:(after&&status===id?{...next,counts_for_attendance:Number(next.countsForAttendance),counts_for_wecker:Number(next.countsForWecker)}:c)};
 const touched=new Set<string>(bookings.filter((b:any)=>b.status===id).map((b:any)=>`${b.user_id}|${b.day.slice(0,7)}`));
 const members=new Map<string,string>(d.prepare('SELECT id,alias FROM members').all().map((m:any)=>[m.id,m.alias] as [string,string]));
 const rules=new Map<string,number>(d.prepare('SELECT month,limit_percent FROM quota_rules').all().map((r:any)=>[r.month,r.limit_percent] as [string,number]));
 const quotaValue=(userId:string,month:string,after:boolean)=>{
  const matching=bookings.filter((b:any)=>b.user_id===userId&&b.day.startsWith(month));let n=0,w=0;
  for(const booking of matching){const c=categoryFor(booking.status,after);if(c?.kind==='attendance'&&Number(c.counts_for_attendance)===1)n++;if(Number(c?.counts_for_wecker)===1)w++;}
  const limit=rules.get(month)??rules.get('default')??60;return {attendance:n,wecker:w,percent:n?Math.round(w/n*100):0,over:n>0&&w/n>Number(limit)/100};
 };
 const quotaChanges=[];
 for(const key of touched){const [userId,month]=key.split('|');const before=quotaValue(userId,month,false),after=quotaValue(userId,month,true);if(before.attendance!==after.attendance||before.wecker!==after.wecker)quotaChanges.push({alias:members.get(userId)||userId,month,before,after});}
 const affectedUsers=[...new Set<string>(bookings.filter((b:any)=>b.status===id).map((b:any)=>String(b.user_id)))];
 const vacationOverages=[];
 if(next.kind==='vacation'||current.kind==='vacation'){
  const years=new Set<number>(bookings.filter((b:any)=>b.status===id).map((b:any)=>Number(b.day.slice(0,4))));
  for(const userId of affectedUsers)for(const year of years){
   const used=bookings.filter((b:any)=>b.user_id===userId&&Number(b.day.slice(0,4))===year&&categoryFor(b.status,true)?.kind==='vacation').length;
   const allowance=d.prepare('SELECT days FROM allowances WHERE user_id=? AND year=?').get(userId,year)?.days??0;
   if(used>allowance)vacationOverages.push({alias:members.get(userId)||userId,year,used,allowance});
  }
 }
 const capacityConflicts=[];
 if(next.requiresCapacity&&next.capacityMode==='block'){
  const dayCounts=new Map<string,number>();for(const b of bookings)if(b.status===id&&b.day>=today())dayCounts.set(b.day,(dayCounts.get(b.day)||0)+1);
  for(const [day,count] of dayCounts)if(count>next.places)capacityConflicts.push({day,count,places:next.places});
 }
 return {bookings:bookings.filter((b:any)=>b.status===id).length,affectedMembers:affectedUsers.length,affectedMonths:touched.size,quotaChanges,vacationOverages,capacityConflicts};
}
export async function GET(req:Request){try{
 const user=await getChatGPTUser();if(!user)return fail('Bitte anmelden.',401);
 const year=Number(new URL(req.url).searchParams.get('year')||new Date().getFullYear());if(!Number.isInteger(year)||year<2000||year>2099)return fail('Ungültiges Jahr.');
 const d=db();const me=await d.prepare('SELECT id,alias,role,team,icon,birthday,birthday_reminders FROM members WHERE id=?').bind(user.userId).first<any>();
 if(!me){const [c,teams]=await Promise.all([d.prepare('SELECT COUNT(*) n FROM members').first<any>(),d.prepare('SELECT id,name,color,sort_order,is_system,is_assignable FROM teams ORDER BY sort_order,name').all()]);return Response.json({me:null,first:c.n===0,teams:teams.results,year});}
 const currentDay=today();
 const [members,teams,bookings,caps,categoryCapacities,categories,settings,holidays,allowances,quotaRules,teamDays,events,attendees]=await Promise.all([
 d.prepare('SELECT id,alias,role,team,icon,birthday FROM members ORDER BY alias').all(),
 d.prepare('SELECT id,name,color,sort_order,is_system,is_assignable FROM teams ORDER BY sort_order,name').all(),
 d.prepare("SELECT user_id,day,CASE WHEN status='sick' AND user_id<>? AND ?<>'admin' THEN 'absent' ELSE status END status,CASE WHEN status='sick' AND user_id<>? AND ?<>'admin' THEN '' ELSE comment END comment FROM bookings WHERE day BETWEEN ? AND ? AND day NOT IN (SELECT day FROM holidays) AND strftime('%w',day) NOT IN ('0','6')").bind(user.userId,me.role,user.userId,me.role,`${year-1}-12-25`,`${year+1}-01-07`).all(),
 d.prepare('SELECT * FROM capacities ORDER BY effective').all(),d.prepare('SELECT * FROM category_capacities ORDER BY effective,category_id').all(),d.prepare('SELECT * FROM booking_categories ORDER BY sort_order,label').all(),d.prepare('SELECT * FROM settings WHERE id=1').first<any>(),d.prepare('SELECT * FROM holidays ORDER BY day').all(),d.prepare("SELECT * FROM allowances WHERE user_id=? OR ?='admin'").bind(user.userId,me.role).all(),d.prepare('SELECT * FROM quota_rules').all(),d.prepare('SELECT * FROM team_days ORDER BY day').all(),
 d.prepare('SELECT id,creator,title,day,time,site FROM events WHERE day>=? ORDER BY day,time').bind(currentDay).all(),
 d.prepare('SELECT event_id,user_id FROM attendees WHERE event_id IN (SELECT id FROM events WHERE day>=?)').bind(currentDay).all()]);
 return Response.json({me,members:members.results,teams:teams.results,bookings:bookings.results,capacities:caps.results,categoryCapacities:categoryCapacities.results,categories:categories.results,holidays:holidays.results,allowances:allowances.results,quotaRules:quotaRules.results,teamDays:teamDays.results,events:events.results,attendees:attendees.results,...(me.role==='admin'?{invite:settings?.invite}:{}),year},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return fail('Der Kalender konnte nicht geladen werden. Bitte erneut versuchen.',503)}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return fail('Anfrage nicht erlaubt.',403);
 const user=await getChatGPTUser();if(!user)return fail('Bitte anmelden.',401);
 const b:any=await req.json();if(!b||typeof b!=="object")return fail("Ungültige Anfrage.");const d=db();const me=await d.prepare('SELECT * FROM members WHERE id=?').bind(user.userId).first<any>();
 if(b.action==='register')return fail('Konten werden von der Administration angelegt.',403);
 if(!me)return fail('Bitte zuerst registrieren.',403);
 if(['createCategory','updateCategory','previewCategoryUpdate','deleteCategory'].includes(b.action)){
  if(me.role!=='admin')return fail('Nur Administratoren können Kategorien verwalten.',403);
  const next=normalizedCategory(b);
  if(['createCategory','updateCategory','previewCategoryUpdate'].includes(b.action)&&!next)return fail('Bitte Name, Kürzel, Kategorieart und die passenden Anwesenheits-, Wecker- und Platzregeln gültig ausfüllen.');
  if(b.action==='createCategory'){
   const base=next.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,25)||'status';let id=base,n=2;
   while(await d.prepare('SELECT 1 FROM booking_categories WHERE id=?').bind(id).first())id=`${base}-${n++}`;
   const order=(await d.prepare('SELECT COALESCE(MAX(sort_order),0)+10 n FROM booking_categories').first<any>()).n;
   if(next.countsForWecker&&await d.prepare('SELECT 1 FROM booking_categories WHERE counts_for_wecker=1').first())return fail('Es gibt bereits eine Kategorie, die den Wecker-Zähler bildet.',409);
   const queries=[d.prepare('INSERT INTO booking_categories(id,label,short_label,kind,color,sort_order,requires_capacity,counts_for_attendance,counts_for_wecker) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,next.label,next.shortLabel,next.kind,next.color,order,Number(next.requiresCapacity),Number(next.countsForAttendance),Number(next.countsForWecker))];
   if(next.requiresCapacity)queries.push(d.prepare('INSERT INTO category_capacities(category_id,effective,places,mode) VALUES(?,?,?,?)').bind(id,today(),next.places,next.capacityMode));
   await d.batch(queries);return Response.json({ok:true,id});
  }
  if(typeof b.id!=='string')return fail('Ungültige Kategorie.');
  const current=await d.prepare('SELECT * FROM booking_categories WHERE id=?').bind(b.id).first<any>();if(!current)return fail('Kategorie nicht gefunden.',404);
  if(b.action==='previewCategoryUpdate'){
   const preview=categoryImpactPreview(d,b.id,next);return preview?Response.json(preview):fail('Kategorie nicht gefunden.',404);
  }
  if(b.action==='deleteCategory'){
   if(current.id==='wecker')return fail('Wecker bleibt die Bezugsgröße der Monatsquote und kann nicht gelöscht werden.',409);
   const used=await d.prepare('SELECT 1 FROM bookings WHERE status=? UNION ALL SELECT 1 FROM team_days WHERE site=? UNION ALL SELECT 1 FROM events WHERE site=? LIMIT 1').bind(b.id,b.id,b.id).first();
   if(used)return fail('Die Kategorie kann nicht gelöscht werden, solange Buchungen oder Termine darauf verweisen.',409);
   if(current.requires_capacity&&(await d.prepare("SELECT COUNT(*) n FROM booking_categories WHERE requires_capacity=1").first<any>()).n<=1)return fail('Mindestens ein platzgebundener Standort muss bestehen bleiben.',409);
   if(current.kind==='vacation'&&(await d.prepare("SELECT COUNT(*) n FROM booking_categories WHERE kind='vacation'").first<any>()).n<=1)return fail('Mindestens eine Urlaubskategorie muss bestehen bleiben.',409);
   await d.prepare('DELETE FROM booking_categories WHERE id=?').bind(b.id).run();return Response.json({ok:true});
  }
  if(current.id==='wecker'&&(next.kind!=='attendance'||!next.requiresCapacity||!next.countsForAttendance||!next.countsForWecker))return fail('Wecker muss Anwesenheit, Platzbelegung und Wecker-Zähler bleiben.',409);
  if(next.countsForWecker&&current.id!=='wecker'&&await d.prepare('SELECT 1 FROM booking_categories WHERE counts_for_wecker=1 AND id<>?').bind(b.id).first())return fail('Es gibt bereits eine Kategorie, die den Wecker-Zähler bildet.',409);
  const currentCapacity=next.requiresCapacity?await d.prepare('SELECT places,mode FROM category_capacities WHERE category_id=? AND effective<=? ORDER BY effective DESC LIMIT 1').bind(b.id,today()).first<any>():null;
  const capacityChanged=next.requiresCapacity&&(!currentCapacity||Number(currentCapacity.places)!==next.places||currentCapacity.mode!==next.capacityMode);
  const changed=current.kind!==next.kind||Number(current.requires_capacity)!==Number(next.requiresCapacity)||Number(current.counts_for_attendance)!==Number(next.countsForAttendance)||Number(current.counts_for_wecker)!==Number(next.countsForWecker)||capacityChanged;
  const existingBookings=(await d.prepare('SELECT COUNT(*) n FROM bookings WHERE status=?').bind(b.id).first<any>()).n;
  if(changed&&existingBookings&&!b.confirmImpact)return fail('Bitte zuerst die Auswirkungs-Vorschau öffnen und die Änderung bestätigen.',409);
  if(next.requiresCapacity&&next.capacityMode==='block'){
   const conflicts=categoryImpactPreview(d,b.id,next)?.capacityConflicts||[];
   if(conflicts.length)return fail(`Die Platzbegrenzung wäre an ${conflicts.length} bereits gebuchten Tag(en) unterschritten. Wähle den Warnmodus oder erhöhe die Platzanzahl.`,409);
  }
  const statements=[d.prepare('UPDATE booking_categories SET label=?,short_label=?,kind=?,color=?,requires_capacity=?,counts_for_attendance=?,counts_for_wecker=? WHERE id=?').bind(next.label,next.shortLabel,next.kind,next.color,Number(next.requiresCapacity),Number(next.countsForAttendance),Number(next.countsForWecker),b.id)];
  if(next.requiresCapacity)statements.push(d.prepare('INSERT INTO category_capacities(category_id,effective,places,mode) VALUES(?,?,?,?) ON CONFLICT(category_id,effective) DO UPDATE SET places=excluded.places,mode=excluded.mode').bind(b.id,today(),next.places,next.capacityMode));
  await d.batch(statements);
  return Response.json({ok:true});
 }
 if(b.action==='createTeam'||b.action==='deleteTeam'||b.action==='updateTeamColor'){
  if(me.role!=='admin')return fail('Nur Administratoren können Teams verwalten.',403);
  if(b.action==='createTeam'){
   const name=typeof b.name==='string'?b.name.trim().replace(/\s+/g,' '):'';
   if(name.length<2||name.length>40)return fail('Der Teamname muss 2–40 Zeichen lang sein.');
   if(['team offen','gruppenleitung'].includes(name.toLocaleLowerCase('de-DE')))return fail('Dieser Name ist für die Systemzuordnung reserviert.');
   const id=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32);
   if(!/^[a-z][a-z0-9-]{1,31}$/.test(id)||['open','leitung'].includes(id))return fail('Aus diesem Namen kann kein gültiger Teamcode gebildet werden. Bitte einen anderen Namen wählen.');
   if(await d.prepare('SELECT 1 FROM teams WHERE id=? OR name=? COLLATE NOCASE').bind(id,name).first())return fail('Ein Team mit diesem Namen oder Teamcode existiert bereits.',409);
   const palette=['#7658a6','#16858a','#c36b36','#4d7d55','#b14e78','#5975a8','#77852e','#a45b48'];
   const count=(await d.prepare('SELECT COUNT(*) n FROM teams WHERE is_assignable=1 AND is_system=0').first<any>()).n;
   await d.prepare('INSERT INTO teams (id,name,color,sort_order,is_system,is_assignable) VALUES (?,?,?,?,0,1)').bind(id,name,palette[count%palette.length],50+count).run();
   return Response.json({ok:true,id});
  }
  if(b.action==='updateTeamColor'){
   if(typeof b.id!=='string'||typeof b.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(b.color))return fail('Bitte eine gültige Teamfarbe auswählen.');
   const result=await d.prepare('UPDATE teams SET color=? WHERE id=? AND is_system=0 AND is_assignable=1').bind(b.color,b.id).run();
   if(!result.meta.changes)return fail('Team nicht gefunden oder geschützt.',404);
   return Response.json({ok:true});
  }
  if(typeof b.id!=='string')return fail('Ungültiges Team.');
  const team=await d.prepare('SELECT id,name,is_system,is_assignable FROM teams WHERE id=?').bind(b.id).first<any>();
  if(!team)return fail('Team nicht gefunden.',404);
  if(team.is_system||!team.is_assignable)return fail('Systemzuordnungen können nicht entfernt werden.',409);
  await d.batch([d.prepare("UPDATE members SET team='open' WHERE team=?").bind(team.id),d.prepare('DELETE FROM team_days WHERE team=?').bind(team.id),d.prepare('DELETE FROM teams WHERE id=?').bind(team.id)]);
  return Response.json({ok:true,movedTo:'open'});
 }
 if(b.action==='book'){
 const target=b.userId||user.userId;if(target!==user.userId&&me.role!=='admin')return fail('Du kannst nur eigene Einträge ändern.',403);
 if(!await d.prepare('SELECT id FROM members WHERE id=?').bind(target).first())return fail('Mitarbeiter nicht gefunden.');
 if(!validDate(b.start)||!validDate(b.end)||b.end<b.start||(Date.parse(b.end)-Date.parse(b.start))/86400000>365)return fail('Bitte einen gültigen Zeitraum bis maximal ein Jahr angeben.');
 const selectedCategory=b.status==='clear'?null:await d.prepare('SELECT id,kind FROM booking_categories WHERE id=?').bind(b.status).first<any>();if(b.status!=='clear'&&!selectedCategory)return fail('Ungültiger Status.');
 const excluded=await d.prepare('SELECT day FROM holidays WHERE day BETWEEN ? AND ?').bind(b.start,b.end).all<any>();
 const off=selectedCategory?.kind==='vacation'?await d.prepare("SELECT day FROM bookings WHERE user_id=? AND status IN (SELECT id FROM booking_categories WHERE kind='dayoff') AND day BETWEEN ? AND ?").bind(target,b.start,b.end).all<any>():{results:[]};
 const ignore=new Set([...excluded.results,...off.results].map(x=>x.day));
 const days=daysBetween(b.start,b.end).filter(day=>!ignore.has(day));if(!days.length)return fail('Keine buchbaren Tage: Wochenenden, Feiertage und bei Urlaub auch Dienstfrei werden übersprungen.');
 const comment=typeof b.comment==='string'?b.comment.trim():'';if(comment.length>240)return fail('Der Kommentar darf höchstens 240 Zeichen lang sein.');
 const now=new Date().toISOString();await d.batch(days.map(day=>b.status==='clear'?d.prepare('DELETE FROM bookings WHERE user_id=? AND day=?').bind(target,day):d.prepare('INSERT INTO bookings (user_id,day,status,updated,comment) VALUES (?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET status=excluded.status,updated=excluded.updated,comment=excluded.comment').bind(target,day,b.status,now,comment)));
 return Response.json({ok:true,count:days.length});}
 if(b.action==='allowance'){
 const target=b.userId||user.userId;if(target!==user.userId&&me.role!=='admin')return fail('Nur das eigene Urlaubskontingent kann geändert werden.',403);
 if(!Number.isInteger(b.year)||b.year<2000||b.year>2099||!Number.isInteger(b.days)||b.days<0||b.days>366)return fail('Bitte ein Jahr und ein Kontingent von 0–366 ganzen Tagen angeben.');
 await d.prepare('INSERT INTO allowances (user_id,year,days) VALUES (?,?,?) ON CONFLICT(user_id,year) DO UPDATE SET days=excluded.days').bind(target,b.year,b.days).run();return Response.json({ok:true});
 }
 if(['holiday','removeHoliday','quota'].includes(b.action)){
 if(me.role!=='admin')return fail('Nur Administratoren können diese Regeln ändern.',403);
 if(b.action==='quota'){
 if(!(b.month==='default'||/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.month))||!Number.isInteger(b.limit)||b.limit<0||b.limit>100)return fail('Bitte einen gültigen Monat und eine Quote von 0–100 % angeben.');
 await d.prepare('INSERT INTO quota_rules (month,limit_percent) VALUES (?,?) ON CONFLICT(month) DO UPDATE SET limit_percent=excluded.limit_percent').bind(b.month,b.limit).run();return Response.json({ok:true});}
 if(!validDate(b.day))return fail('Bitte ein gültiges Datum angeben.');
 if(b.action==='holiday'){
 const name=String(b.name||'').trim();if(!name||name.length>80)return fail('Bitte einen Feiertagsnamen mit maximal 80 Zeichen angeben.');
 await d.prepare('INSERT INTO holidays (day,name) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET name=excluded.name').bind(b.day,name).run();
 }else await d.prepare('DELETE FROM holidays WHERE day=?').bind(b.day).run();
 return Response.json({ok:true});
 }
 if(b.action==='settings'){
 if(me.role!=='admin')return fail('Nur Administratoren können Einstellungen ändern.',403);
 if(!validDate(b.effective)||!Array.isArray(b.capacityChanges)||!['block','warn'].includes(b.mode))return fail('Bitte ein gültiges Gültigkeitsdatum und Verhalten angeben.');
 const capacityStatements:any[]=[];
 for(const c of b.capacityChanges){if(typeof c.categoryId!=='string'||!Number.isInteger(c.places)||c.places<0||c.places>100)return fail('Bitte alle Platzanzahlen mit 0–100 angeben.');const office=await d.prepare('SELECT id FROM booking_categories WHERE id=? AND requires_capacity=1').bind(c.categoryId).first();if(!office)return fail('Ein ausgewählter platzgebundener Standort existiert nicht mehr.');capacityStatements.push(d.prepare('INSERT INTO category_capacities(category_id,effective,places,mode) VALUES(?,?,?,?) ON CONFLICT(category_id,effective) DO UPDATE SET places=excluded.places,mode=excluded.mode').bind(c.categoryId,b.effective,c.places,b.mode));}
 if(capacityStatements.length)await d.batch(capacityStatements);return Response.json({ok:true});}
 return fail('Unbekannte Aktion.');
 }catch(e){const s=String(e);console.error(e);if(s.includes('VACATION_LIMIT'))return fail('Das Urlaubskontingent reicht nicht aus. Es wurde nichts geändert. Bitte unter Mein Urlaub das Jahreskontingent prüfen.',409);if(s.includes('ALLOWANCE_BELOW_BOOKINGS'))return fail('Das Kontingent darf nicht kleiner als der bereits erfasste Urlaub sein.',409);if(s.includes('HOLIDAY_REMOVE_LIMIT'))return fail('Dieser Feiertag kann nicht entfernt werden: Wieder zählende Urlaubstage würden ein Kontingent überschreiten. Bitte zuerst Urlaub oder Kontingent anpassen.',409);if(s.includes('NON_WORKING_DAY'))return fail('Feiertage und Wochenenden können nicht gebucht werden. Bitte neu laden.',409);if(s.includes('CAPACITY_FULL'))return fail('Mindestens ein Tag ist ausgebucht. Es wurde nichts geändert. Bitte anderen Standort wählen oder Free Zone als platzfreie Anwesenheit buchen.',409);if(s.includes('members.alias'))return fail('Dieses Kürzel ist bereits vergeben.',409);if(s.includes('CAPACITY_BELOW_BOOKINGS'))return fail('Die neue Kapazität unterschreitet bestehende Buchungen. Bitte Buchungen zuerst anpassen oder Warnmodus wählen.',409);return fail('Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.',503)}}
