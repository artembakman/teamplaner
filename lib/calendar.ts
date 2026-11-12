export const statuses = ['wecker','strassen','home','sick','vacation','training','free','off','absent'] as const;
export type Status = typeof statuses[number] | 'absent';
export const labels:Record<string,string>={wecker:'Wecker',strassen:'Strassen',home:'Home Office',sick:'Krankheit',vacation:'Urlaub',training:'Schulung',free:'Free Zone',absent:'Abwesend',off:'Dienstfrei',clear:'Eintrag entfernen'};
export const short:Record<string,string>={wecker:'WE',strassen:'ST',home:'HO',sick:'AB',vacation:'UR',training:'SC',free:'FZ',absent:'AB',off:'DF'};
export type Member={id:string;alias:string;role:string;team:string;icon:string;birthday:string;birthday_reminders:number};
export type Team={id:string;name:string;color:string;sort_order:number;is_system:number;is_assignable:number};
export type Booking={user_id:string;day:string;status:string;comment?:string};
export type Capacity={effective:string;wecker:number;strassen:number;mode:string};
export type BookingCategory={id:string;label:string;short_label:string;kind:'attendance'|'vacation'|'absence'|'dayoff';color:string;sort_order:number;requires_capacity:number;counts_for_attendance:number;counts_for_wecker:number};
export type CategoryCapacity={category_id:string;effective:string;places:number;mode:string};
export type Data={me:Member|null;members:Member[];teams:Team[];bookings:Booking[];capacities:Capacity[];categories:BookingCategory[];categoryCapacities:CategoryCapacity[];invite?:string;first?:boolean;year:number;teamDays:TeamDay[];events:SocialEvent[];attendees:{event_id:string;user_id:string}[];holidays:{day:string;name:string}[];allowances:{user_id:string;year:number;days:number}[];quotaRules:{month:string;limit_percent:number}[]};
export function iso(d:Date){return d.toISOString().slice(0,10)}
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Luxembourg'}).format(new Date())}
export function add(day:string,n:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)}
export function daysOfMonth(month:string){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Ungültiger Monat.');const [year,monthNumber]=month.split('-').map(Number);const count=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();return Array.from({length:count},(_,i)=>add(`${month}-01`,i))}
export function weekday(day:string){return new Date(day+'T12:00:00Z').getUTCDay()}
export function daysBetween(start:string,end:string){const out:string[]=[];for(let d=start;d<=end;d=add(d,1)){if(![0,6].includes(weekday(d)))out.push(d);if(out.length>270)throw Error('Zeitraum zu groß.');}return out}
export function capacityAt(c:Capacity[],day:string):Capacity{return [...c].sort((a,b)=>b.effective.localeCompare(a.effective)).find(x=>x.effective<=day)||{effective:'2000-01-01',wecker:6,strassen:6,mode:'block'}}
export function categoryCapacityAt(c:CategoryCapacity[],id:string,day:string){return [...c].filter(x=>x.category_id===id&&x.effective<=day).sort((a,b)=>b.effective.localeCompare(a.effective))[0]||{category_id:id,effective:'2000-01-01',places:0,mode:'block'}}
export function quota(entries:Booking[],id:string,month:string,limit=60,categories:BookingCategory[]=[]){const e=entries.filter(x=>x.user_id===id&&x.day.startsWith(month));const categoryById=new Map(categories.map(c=>[c.id,c]));const w=e.filter(x=>Number(categoryById.get(x.status)?.counts_for_wecker)===1).length;const countable=new Set(categories.filter(c=>c.kind==='attendance'&&Number(c.counts_for_attendance)===1).map(c=>c.id));if(!categories.length)['wecker','strassen','home'].forEach(x=>countable.add(x));const n=e.filter(x=>countable.has(x.status)).length;return {w,n,percent:n?Math.round(w/n*100):0,over:n>0&&w/n>limit/100}}
export function validDate(s:unknown):s is string{return typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&iso(new Date(s))===s}

export function quotaLimit(rules:{month:string;limit_percent:number}[],month:string){return rules.find(r=>r.month===month)?.limit_percent??rules.find(r=>r.month==="default")?.limit_percent??60}

// Bevorzugte Reihenfolge der bisherigen Teams; weitere Teams folgen alphabetisch nach ihrer Sortierung.
export const teamOrder=['nostro','wp','lagerstellen','networks','leitung'] as const;
export const personalIconOptions=[
 {value:'🙂',label:'🙂 Lächeln'},{value:'🦊',label:'🦊 Fuchs'},{value:'🚲',label:'🚲 Fahrrad'},
 {value:'☕',label:'☕ Kaffee'},{value:'🌻',label:'🌻 Sonnenblume'},{value:'🐼',label:'🐼 Panda'},
 {value:'🎧',label:'🎧 Musik'},{value:'🚀',label:'🚀 Rakete'},{value:'🐱',label:'🐱 Katze'},
 {value:'🌊',label:'🌊 Welle'},{value:'⚽',label:'⚽ Fußball'},{value:'📚',label:'📚 Bücher'},
 {value:'⛳',label:'⛳ Golf'},{value:'🏌️',label:'🏌️ Golfspieler'},
 {value:'🐔',label:'🐔 Huhn'},{value:'🐣',label:'🐣 Küken im Ei'},
 {value:'rooster-copper',label:'🐓 Hahn · Kupfer'},{value:'rooster-gold',label:'🐓 Hahn · Gold'},
 {value:'rooster-green',label:'🐓 Hahn · Grün'},{value:'rooster-blue',label:'🐓 Hahn · Blau'},
 {value:'rooster-violet',label:'🐓 Hahn · Violett'},
 {value:'👩🏻‍🦰',label:'👩🏻‍🦰 Avatar · rote Haare, hell'},{value:'👩🏼‍🦰',label:'👩🏼‍🦰 Avatar · rote Haare, hell-mittel'},
 {value:'👩🏽‍🦰',label:'👩🏽‍🦰 Avatar · rote Haare, mittel'},
 {value:'👩🏻',label:'👩🏻 Avatar · dunkle Haare, hell'},{value:'👩🏽',label:'👩🏽 Avatar · dunkle Haare, mittel'},
 {value:'👩🏼‍🦳',label:'👩🏼‍🦳 Avatar · graue Haare'},
 {value:'🧑🏻‍🦱',label:'🧑🏻‍🦱 Avatar · Locken, hell'},{value:'🧑🏼‍🦱',label:'🧑🏼‍🦱 Avatar · Locken, hell-mittel'},
 {value:'🧑🏽‍🦱',label:'🧑🏽‍🦱 Avatar · Locken, mittel'},
 {value:'🧑🏻‍🦰',label:'🧑🏻‍🦰 Avatar · rote Haare, hell'},
 {value:'🧑🏽‍🦰',label:'🧑🏽‍🦰 Avatar · rote Haare, mittel'},
 {value:'👨🏻‍🦱',label:'👨🏻‍🦱 Avatar · Locken, hell'},{value:'👨🏽‍🦱',label:'👨🏽‍🦱 Avatar · Locken, mittel'},
 {value:'👨🏻‍🦰',label:'👨🏻‍🦰 Avatar · rote Haare, hell'},
 {value:'👨🏽‍🦰',label:'👨🏽‍🦰 Avatar · rote Haare, mittel'}
];
export const personalIcons=personalIconOptions.map(icon=>icon.value);
export type TeamDay={id:string;team:string;month:string;day:string;site:string;updated:string};
export type SocialEvent={id:string;creator:string;title:string;day:string;time:string;site:string};
export function validBirthday(value:string){return value===''||(/^\d{2}-\d{2}$/.test(value)&&validDate('2000-'+value))}
export function birthdayAhead(value:string,from:string){if(!value)return null;for(let i=0;i<=3;i++){const day=add(from,i);if(day.slice(5)===value)return {day,days:i}}return null}
