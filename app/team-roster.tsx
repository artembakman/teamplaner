'use client';
import {Fragment,useEffect,useMemo,useState} from 'react';
import {ChevronDown,ChevronRight,MessageSquareText,Plus} from 'lucide-react';
import {TableCell,TableRow} from '@/components/ui/table';
import ProfileSymbol from '@/app/profile-symbol';
import {labels,short,type Booking,type Member,type Team,type TeamDay,type Data} from '@/lib/calendar';

function TeamBadge({status,categories}:{status:string;categories:Data['categories']}){
 const category=categories.find(c=>c.id===status);
 const full=category?.label||labels[status]||status,compact=category?.short_label||short[status]||status;
 return <span className={'status team-status '+status} aria-label={full} style={category?{backgroundColor:`color-mix(in srgb, ${category.color} 16%, white)`,color:category.color}:undefined}><span className="status-full-label">{full}</span><span className="status-compact-label">{compact}</span></span>;
}

export default function TeamRoster({categories,members,bookings,week,today,holidays,teamDays,teams,currentUserId,admin,onEdit,collapseRequest}:{
 categories:Data['categories'];members:Member[];bookings:Booking[];week:string[];today:string;holidays:{day:string;name:string}[];teamDays:TeamDay[];teams:Team[];currentUserId:string;admin:boolean;onEdit:(day:string,userId:string,readOnly?:boolean)=>void;
 collapseRequest:{id:number;collapsed:boolean;teamIds:string[]}|null;
}){
 const teamMap=useMemo(()=>new Map(teams.map(team=>[team.id,team])),[teams]);
 const groups=useMemo(()=>{
  const membersByTeam=new Map<string,Member[]>();
  for(const member of members){const id=member.team||'open';const group=membersByTeam.get(id);if(group)group.push(member);else membersByTeam.set(id,[member]);}
  const extra=[...membersByTeam.keys()].filter(id=>id!=='open'&&!teamMap.has(id)).sort((a,b)=>a.localeCompare(b,'de'));
  const ids=[...teams.map(team=>team.id),...extra,'open'];
  return ids.map(id=>({id,members:(membersByTeam.get(id)||[]).sort((a,b)=>a.alias.localeCompare(b.alias,'de'))})).filter(group=>group.members.length>0);
 },[members,teams,teamMap]);
 const bookingByMemberDay=useMemo(()=>{
  const index=new Map<string,Map<string,Booking>>();
  for(const booking of bookings){let days=index.get(booking.user_id);if(!days){days=new Map();index.set(booking.user_id,days);}days.set(booking.day,booking);}
  return index;
 },[bookings]);
 const holidayByDay=useMemo(()=>new Map(holidays.map(holiday=>[holiday.day,holiday])),[holidays]);
 const [collapsedGroups,setCollapsedGroups]=useState<Set<string>>(()=>new Set());
 useEffect(()=>{if(collapseRequest)setCollapsedGroups(collapseRequest.collapsed?new Set(collapseRequest.teamIds):new Set())},[collapseRequest]);
 const toggleGroup=(id:string)=>setCollapsedGroups(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
 const color=(id:string)=>teamMap.get(id)?.color||'#849198';
 const name=(id:string)=>teamMap.get(id)?.name||(id==='open'?'Team offen':id);
 return <>
  {groups.map(group=><Fragment key={group.id}>
   <TableRow className="team-group-row" style={{'--team-color':color(group.id)} as React.CSSProperties}>
    <TableCell className="team-group-name" style={{backgroundColor:`color-mix(in srgb, ${color(group.id)} 14%, white)`,color:`color-mix(in srgb, ${color(group.id)} 70%, #162d32)`}}><button type="button" className="team-group-toggle" aria-expanded={!collapsedGroups.has(group.id)} aria-label={`${collapsedGroups.has(group.id)?'Team ausklappen':'Team einklappen'}: ${name(group.id)}`} onClick={()=>toggleGroup(group.id)}>{collapsedGroups.has(group.id)?<ChevronRight size={15}/>:<ChevronDown size={15}/>}<span className="team-group-title">{name(group.id)}</span></button></TableCell>
    {week.map(day=><TableCell key={day} className="team-group-day" style={{backgroundColor:`color-mix(in srgb, ${color(group.id)} 8%, white)`}}>{teamDays.filter(teamDay=>teamDay.team===group.id&&teamDay.day===day).map(teamDay=>{const site=categories.find(category=>category.id===teamDay.site);return <span key={teamDay.id} className="teamday-marker teamday-row-marker" aria-label={`Teamtag ${name(group.id)}: ${site?.label||teamDay.site}`} title={`Teamtag · ${site?.label||teamDay.site}`}><span aria-hidden="true">🤝</span><span className="teamday-location-full">{site?.label||teamDay.site}</span><span className="teamday-location-short">{site?.short_label||site?.label||teamDay.site}</span></span>})}</TableCell>)}
   </TableRow>
   {!collapsedGroups.has(group.id)&&group.members.map(member=><TableRow key={member.id} className="team-member-row" style={{'--team-color':color(group.id)} as React.CSSProperties}>
    <TableCell className="person-col" style={{boxShadow:`inset 3px 0 ${color(group.id)}`}}><div className="person"><span className={'avatar '+(member.id===currentUserId?'self':'')}><ProfileSymbol value={member.icon} size={27}/></span><span>{member.alias}{member.birthday===today.slice(5)&&<span title="Hat heute Geburtstag"> 🎂</span>}{member.id===currentUserId&&<small>Du</small>}{member.role==='admin'&&<small>Admin</small>}</span></div></TableCell>
    {week.map(day=>{const booking=bookingByMemberDay.get(member.id)?.get(day),holiday=holidayByDay.get(day),teamDay=teamDays.find(item=>item.team===group.id&&item.day===day),bookingCategory=booking?categories.find(category=>category.id===booking.status):undefined,wrongPlace=Boolean(teamDay&&booking&&booking.status!==teamDay.site&&(bookingCategory?.requires_capacity||booking?.status==='home'));const plannedSite=teamDay?categories.find(category=>category.id===teamDay.site)?.label||teamDay.site:'';return <TableCell key={day} style={{backgroundColor:`color-mix(in srgb, ${color(group.id)} 4%, white)`}} className={(day===today?'today-cell ':'')+(teamDay?'teamday-cell ':'')+(wrongPlace?'teamday-location-mismatch':'')}><button className={'day-entry '+(!booking?'unplanned':'')} onClick={()=>onEdit(day,member.id,!admin&&member.id!==currentUserId)} title={wrongPlace?`Falscher Standort für den Teamtag · geplant: ${plannedSite}`:booking?.comment?booking.comment:undefined} aria-label={`${member.alias}, ${day}: ${booking?bookingCategory?.label||labels[booking.status]:'Kein Eintrag'}${wrongPlace?`, Teamtag: geplant ${plannedSite}`:''}${booking?.comment?`, Kommentar: ${booking.comment}`:''}`}>{booking?<><TeamBadge status={booking.status} categories={categories}/>{booking.comment&&<MessageSquareText className="booking-comment-icon" size={13} aria-label="Kommentar vorhanden"/>}</>:holiday?<span className="holiday-label">{holiday.name}</span>:<><Plus size={14}/><span>Planen</span></>}</button></TableCell>})}
   </TableRow>)}
  </Fragment>)}
 </>;
}
