const roosters:Record<string,{body:string;wing:string;tail:string;name:string}>={
 'rooster-copper':{body:'#C66546',wing:'#F5C39D',tail:'#6E3441',name:'Kupfer'},
 'rooster-gold':{body:'#D8A528',wing:'#FFE18C',tail:'#875D18',name:'Gold'},
 'rooster-green':{body:'#299B78',wing:'#9DDFC0',tail:'#17614E',name:'Grün'},
 'rooster-blue':{body:'#5682D3',wing:'#B4D0FF',tail:'#304676',name:'Blau'},
 'rooster-violet':{body:'#9464BB',wing:'#D8B5ED',tail:'#563A77',name:'Violett'},
};

export default function ProfileSymbol({value,size=24}:{value:string;size?:number}){
 const rooster=roosters[value];
 if(!rooster)return <span aria-hidden="true" className="profile-symbol-emoji">{value}</span>;
 return <svg aria-hidden="true" className="profile-symbol-svg" width={size} height={size} viewBox="0 0 48 48" fill="none">
  <path d="M15 24C12 20 7 18 5 13c5 0 10 2 13 6-2-6-1-11 3-14 3 4 4 9 3 14 5-4 10-5 15-3-3 5-7 8-13 9" fill={rooster.tail}/>
  <path d="M11 25c1-7 7-12 15-12 7 0 12 4 13 10l5 2-5 3c-1 8-8 13-17 12-9-1-14-7-11-15Z" fill={rooster.body}/>
  <path d="M17 29c4-5 12-6 18-1-2 6-11 9-18 1Z" fill={rooster.wing}/>
  <circle cx="31" cy="15" r="7" fill={rooster.body}/>
  <path d="M25 9c-2-5 2-6 4-3 2-5 6-3 6 0 4-2 6 2 3 5-4 2-9 2-13-2Z" fill="#D94D48"/>
  <path d="m37 14 8 3-8 3" fill="#F1A335"/>
  <circle cx="33" cy="14" r="1.2" fill="#21393E"/>
  <path d="m21 39-1 5m8-5 1 5m-10 0h4m4 0h4" stroke="#B96B32" strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}

export const roosterColorName=(value:string)=>roosters[value]?.name;
