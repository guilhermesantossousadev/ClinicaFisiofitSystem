// Local-only, deterministic, identical projection for V2.1/V2.2 comparisons.
import { fixture as inherited, unit, pro, patient } from '../ui-v2/fixtures.mjs';
export { unit };
export const date = '2026-10-15';
const person = (id, name) => ({id,name,active:true,unit_ids:[unit]});
export const people = [person(pro,'Clara · Fisioterapia'),person('pro-2','Marina · Pilates'),person('pro-3','Rafael · Reabilitação')];
const room = {id:'room-1',name:'Sala de Pilates',unit_id:unit,active:true};
export const items = [];
function add(id,day,start,end,who,title,status='planned',extra={}) {items.push({id,sourceId:id,sourceType:'CLASS_OCCURRENCE',unitId:unit,startAt:`${day}T${start}:00-03:00`,endAt:`${day}T${end}:00-03:00`,status,title,professional:people[who],plannedProfessional:people[who],room,capacity:7,occupancy:3,class:{id:'class-'+id,name:title},...extra});}
for (const [i,day] of ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16'].entries()) {
 add('morning-'+i,day,'06:30','07:20',0,'Pilates · despertar');
 add('class-'+i,day,'08:00','08:50',0,'Pilates · equilíbrio');
 add('parallel-'+i,day,'08:00','09:00',1,'Pilates · movimento');
 add('therapy-'+i,day,'10:15','11:00',2,'Fisioterapia individual','confirmed',{sourceType:'APPOINTMENT',patient:{id:patient,name:'Paciente sintético'},occupancy:null});
 add('afternoon-'+i,day,'15:00','15:50',1,'Pilates · funcional');
}
add('substitution',date,'09:15','10:05',0,'Pilates · força','planned',{actualProfessional:people[1],professional:people[1]});
add('simultaneous',date,'08:15','08:45',0,'Sessão paralela autorizada');
add('cancelled',date,'11:00','11:50',2,'Pilates · postura','cancelled');
add('rescheduled',date,'13:30','14:20',1,'Pilates · aula remarcada');
add('early',date,'05:15','05:45',2,'Sessão excepcional cedo');
add('late',date,'21:30','22:15',0,'Sessão excepcional noturna');
const participants=[{patient:{id:patient,name:'Paciente Sintética Aurora',active:true},source:'MEMBERSHIP'}, {patient:{id:'patient-2',name:'Paciente Sintética Beatriz',active:true},source:'MAKEUP'}, {patient:{id:'patient-3',name:'Paciente Sintética Cecília',active:true},source:'MANUAL'}];
export function fixture(path,query,method,body, scenario='normal', role='admin') {
 if(path==='/me')return {profile:{name:'Equipe sintética',role,profile_permissions:['agenda','patients','enrollments','finance','records','dashboard'].map(module=>({module,can_view:true,can_edit:scenario!=='readonly'}))}};
 if(path==='/professionals')return role==='professional'?[people[0]]:people;
 if(path==='/rooms')return [room,{...room,id:'room-2',name:'Sala de Fisioterapia'}];
 if(path==='/calendar-items')return {items:scenario==='empty'||query.get('unitId')!==unit?[]:items.filter(i=> Date.parse(i.startAt)<Date.parse(query.get('to'))&&Date.parse(i.endAt)>Date.parse(query.get('from'))&&(role!=='professional'||i.professional.id===pro))};
 const match=path.match(/^\/class-occurrences\/([^/]+)(\/attendance)?$/);
 if(match&&method==='GET') {
  const item=items.find(i=>i.id===match[1]);if(!item)return null;
  if(match[2])return {items:participants.map((p,index)=>({patient_id:p.patient.id,patient_name:p.patient.name,patient_active:true,source_type:index===1?'makeup_reservation':'membership',attendance_id:index===0?'record-1':null,attendance_status:index===0?'PRESENT':null,notes:null,version:index===0?1:null,history:index===0?[{before_status:'LATE',after_status:'PRESENT',reason:'Correção sintética',created_at:date+'T12:00:00Z'}]:[]}))};
  return {occurrence:{id:item.id,classes:{name:item.title},start_at:item.startAt,end_at:item.endAt,status:item.status,plannedProfessional:item.plannedProfessional,actualProfessional:item.actualProfessional??null,planned_professional_id:item.plannedProfessional.id,actual_professional_id:item.actualProfessional?.id??null,rooms:room,effective_capacity:7,local_start_time:item.startAt.slice(11,19),local_end_time:item.endAt.slice(11,19),local_date:item.id==='rescheduled'?'2026-10-14':date,exception_date:item.id==='rescheduled'?date:null},participants,occupancy:participants.length};
 }
 return inherited(path,query,method,body);
}
