'use client';

import {Fragment,useMemo} from 'react';
import {MessageSquareText} from 'lucide-react';
import ProfileSymbol from './profile-symbol';
import {labels,short,type Booking,type BookingCategory,type Member,type Team,type TeamDay} from '@/lib/calendar';

const format=(day:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('de-DE',{...options,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));

export default function TeamMonthRoster({categories,members,bookings,days,today,holidays,teamDays,teams,currentUserId,admin,onEdit}:{
 categories:BookingCategory[];members:Member[];bookings:Booking[];days:string[];today:string;holidays:{day:string;name:string}[];teamDays:TeamDay[];teams:Team[];currentUserId:string;admin:boolean;onEdit:(day:string,userId:string,readOnly?:boolean)=>void;
}){
 const teamMap=useMemo(()=>new Map(teams.map(team=>[team.id,team])),[teams]);
 const groups=useMemo(()=>{
  const byTeam=new Map<string,Member[]>();
  for(const member of members){const id=member.team||'open';const group=byTeam.get(id);if(group)group.push(member);else byTeam.set(id,[member]);}
  const extra=[...byTeam.keys()].filter(id=>id!=='open'&&!teamMap.has(id)).sort((a,b)=>a.localeCompare(b,'de'));
  return [...teams.map(team=>team.id),...extra,'open'].map(id=>({id,members:(byTeam.get(id)||[]).sort((a,b)=>a.alias.localeCompare(b.alias,'de'))})).filter(group=>group.members.length>0);
 },[members,teams,teamMap]);
 const bookingByMemberDay=useMemo(()=>{
  const index=new Map<string,Map<string,Booking>>();
  for(const booking of bookings){let memberDays=index.get(booking.user_id);if(!memberDays){memberDays=new Map();index.set(booking.user_id,memberDays);}memberDays.set(booking.day,booking);}
  return index;
 },[bookings]);
 const holidayByDay=useMemo(()=>new Map(holidays.map(holiday=>[holiday.day,holiday.name])),[holidays]);
 const name=(id:string)=>teamMap.get(id)?.name||(id==='open'?'Team offen':id);
 const color=(id:string)=>teamMap.get(id)?.color||'#849198';

 return <div className="team-month-scroll" role="region" aria-label="Monatsübersicht aller Teammitglieder; horizontal scrollen für weitere Tage" tabIndex={0}>
  <table className="team-month-table">
   <thead><tr><th className="month-person-sticky" scope="col">Mitarbeiter</th>{days.map(day=><th key={day} scope="col" className={(day===today?'current ':'')+([0,6].includes(new Date(day+'T12:00:00Z').getUTCDay())?'weekend':'')} title={format(day,{weekday:'long',day:'numeric',month:'long'})}><span>{Number(day.slice(8))}</span><small>{format(day,{weekday:'short'})}</small></th>)}</tr></thead>
   <tbody>{groups.map(group=><Fragment key={group.id}>
    <tr className="team-month-group" style={{'--team-color':color(group.id)} as React.CSSProperties}>
     <th className="month-person-sticky" scope="row"><span className="team-color-dot" style={{backgroundColor:color(group.id)}}/>{name(group.id)}</th>
     {days.map(day=>{const teamDay=teamDays.find(item=>item.team===group.id&&item.day===day);const site=teamDay&&categories.find(category=>category.id===teamDay.site);return <td key={day} className={teamDay?'team-month-teamday':''} title={teamDay?`Teamtag ${name(group.id)} · ${site?.label||teamDay.site}`:undefined}>{teamDay&&<span aria-hidden="true">🤝 {site?.short_label||short[teamDay.site]||teamDay.site}</span>}</td>})}
    </tr>
    {group.members.map(member=><tr className="team-month-member" key={member.id} style={{'--team-color':color(group.id)} as React.CSSProperties}>
     <th className="month-person-sticky" scope="row"><span className="month-person"><ProfileSymbol value={member.icon} size={22}/><span>{member.alias}{member.id===currentUserId&&<small>Du</small>}</span></span></th>
     {days.map(day=>{const booking=bookingByMemberDay.get(member.id)?.get(day);const category=booking&&categories.find(item=>item.id===booking.status);const holiday=holidayByDay.get(day);const weekend=[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());const editable=admin||member.id===currentUserId;const fullLabel=holiday?`Feiertag: ${holiday}`:weekend?'Wochenende':booking?category?.label||labels[booking.status]||booking.status:'Kein Eintrag';return <td key={day} className={(day===today?'current ':'')+(weekend?'weekend ':'')+(holiday?'holiday':'')}>
      <button type="button" className={'team-month-entry '+(booking?'has-entry':'empty-entry')} disabled={!editable||Boolean(holiday)||weekend} onClick={()=>onEdit(day,member.id,!admin&&member.id!==currentUserId)} title={`${member.alias} · ${format(day,{weekday:'long',day:'numeric',month:'long'})} · ${fullLabel}${booking?.comment?` · ${booking.comment}`:''}`} aria-label={`${member.alias}, ${format(day,{day:'numeric',month:'long'})}: ${fullLabel}${booking?.comment?`, Kommentar: ${booking.comment}`:''}`}>
       {booking?<><span className="team-month-status" style={category?{backgroundColor:`color-mix(in srgb, ${category.color} 18%, white)`,color:category.color}:undefined}>{category?.short_label||short[booking.status]||booking.status}</span>{booking.comment&&<MessageSquareText size={11} aria-label="Kommentar vorhanden"/>}</>:holiday?<span className="team-month-off">FT</span>:weekend?<span className="team-month-off">·</span>:editable?<span className="team-month-add">+</span>:<span className="team-month-off">—</span>}
      </button>
     </td>})}
    </tr>)}
   </Fragment>)}</tbody>
  </table>
 </div>;
}
