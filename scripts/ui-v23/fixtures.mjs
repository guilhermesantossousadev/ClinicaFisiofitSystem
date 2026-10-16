import {fixture as previous, unit, patient, pro, occ} from '../ui-v2/fixtures.mjs';
export {unit, patient, pro, occ};
export const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
export function syntheticFixture() {
  let role='admin', read=false;
  const query=new URLSearchParams();
  const patients=structuredClone(previous('/patients',query,'GET',{}).items);
  const records=[
    {id:'record-assessment',patient_id:patient,professional_id:pro,unit_id:unit,kind:'assessment',status:'signed',created_at:today+'T10:00:00Z',signed_at:today+'T10:10:00Z',payload:{complaint:'Queixa inteiramente sintética para testar a leitura da avaliação.',current_history:'História sintética. Nenhuma informação clínica real.',exam_detail:'Exame físico fictício registrado para homologação.',functional_diagnosis:'Diagnóstico funcional sintético.',treatment_plan:'Plano sintético de mobilidade e acompanhamento.'}},
    {id:'record-evolution',patient_id:patient,professional_id:pro,unit_id:unit,kind:'evolution',status:'draft',created_at:today+'T12:00:00Z',payload:{text:'Evolução sintética da sessão. Boa resposta à atividade simulada.',exercises:['Mobilidade','Equilíbrio'],observations:'Conduta sintética para revisão visual.'}},
  ];
  const notices=[{id:'notice-1',template_key:'agenda.substituted',payload:{occurrence_id:occ,unit_id:unit,start_at:today+'T08:00:00-03:00'},read_at:null}];
  const allowed={reception:['dashboard','agenda','patients','enrollments'],professional:['dashboard','agenda','patients','records'],finance:['dashboard','enrollments','finance','reports'],manager:['dashboard','agenda','patients','enrollments','records','finance','reports','imports','users','settings','privacy'],admin:[]};
  return {
    setRole(value){role=value;},
    handle(path,query,method,body){
      if(path==='/me')return {profile:{name:'Equipe Sintética '+role,role,profile_permissions:(allowed[role]??[]).map(module=>({module,can_view:true,can_edit:true}))}};
      if(path==='/patients'&&method==='POST'){const row={...body,id:crypto.randomUUID(),active:true};patients.push(row);return row;}
      if(path==='/patients'){const items=patients.filter(p=>!query.get('search')||p.name.toLocaleLowerCase().includes(query.get('search').toLocaleLowerCase()));return {items,total:items.length,page:1,pageSize:20};}
      if(path==='/clinical-records'&&method==='POST'){const row={...body,id:crypto.randomUUID(),status:'draft',created_at:new Date().toISOString()};records.push(row);return row;}
      if(path==='/clinical-records')return records.filter(row=>row.patient_id===query.get('patientId'));
      if(path.endsWith('/sign')){const row=records.find(row=>path.includes(row.id));if(row){row.status='signed';row.signed_at=new Date().toISOString();}return row;}
      if(path==='/attachments')return query.get('patientId')===patient?[{id:'synthetic-file',filename:'avaliacao-sintetica.pdf',size_bytes:4096,content_type:'application/pdf'}]:[];
      if(path==='/notifications')return notices.map(item=>({...item,read_at:read?today:null}));
      if(path==='/notifications/notice-1/read'){read=body.read;return {id:'notice-1'};}
      if(path==='/users')return previous(path,query,method,body).map(row=>({...row,status:'active'}));
      if(path==='/privacy/requests')return [{id:'privacy-1',requester_name:'Titular Sintético',kind:'access',status:'pending',due_at:today}];
      if(path==='/privacy/incidents')return [{id:'incident-1',title:'Simulação de incidente',description:'Incidente inteiramente fictício para homologação de interface.',severity:'low',status:'closed',discovered_at:today+'T12:00:00Z'}];
      if(path==='/audit')return [{id:'audit-1',action:'create',entity_type:'patients',user_id:'operador-sintetico',occurred_at:today+'T12:00:00Z'}];
      if(path==='/imports/workbook')return body.dryRun?{dryRun:true,total:2,accepted:1,issues:[{row:3,sheet:'synthetic-patients',reason:'Campo obrigatório ausente: name'}]}:{imported:1,issues:[{row:3,reason:'Campo obrigatório ausente: name'}]};
      if(path==='/imports/notion')return {dryRun:body.dryRun,accepted:1,total:1,issues:[]};
      const result=structuredClone(previous(path,query,method,body));
      // Match actual v82 list contracts: charge names come through enrollments;
      // payments identify their charge, rather than carrying patient_id.
      if(path==='/charges')return result.map(({patients: _patient,...row})=>row);
      if(path==='/payments')return result.map(({patient_id: _id,...row})=>row);
      return result;
    },
  };
}
