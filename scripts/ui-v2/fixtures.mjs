// Entirely synthetic visual fixtures; never shared with the application bundle.
export const unit='f2000000-0000-4000-8000-000000000001';
export const pro='f2000000-0000-4000-8000-000000000002';
export const patient='f2000000-0000-4000-8000-000000000003';
export const plan='f2000000-0000-4000-8000-000000000004';
export const enrollment='f2000000-0000-4000-8000-000000000005';
export const group='f2000000-0000-4000-8000-000000000006';
export const occ='f2000000-0000-4000-8000-000000000007';
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}), month=today.slice(0,7);
const p={id:patient,name:'Paciente Sintética Aurora',primary_unit_id:unit,phone:'(31) 90000-0011',email:'aurora@example.invalid',active:true,plan_name:'Mensal · 2x por semana',group_name:'Pilates • manhã',address:{city:'Cidade Sintética',state:'MG'},created_at:today+'T12:00:00Z'};
const p2={...p,id:'f2000000-0000-4000-8000-000000000013',name:'Paciente Sintética Beatriz',phone:'(31) 90000-0012'};
const plans=[{id:plan,name:'Mensal · 2x por semana',duration_days:30,sessions_included:8,price_cents:24000,kind:'monthly',active:true},{id:plan+'a',name:'Trimestral · 2x por semana',duration_days:90,sessions_included:24,price_cents:65000,kind:'package',active:true}];
const prof={id:pro,name:'Profissional Sintética Clara',profile_id:'test-profile',unit_ids:[unit],active:true,council:'Registro sintético',specialty:'Pilates'};
const slot={id:group,name:'Pilates • manhã',unit_id:unit,professional_id:pro,service_id:'service-1',weekdays:[1,2,3,4,5],starts_at:'08:00',duration_minutes:50,capacity:7,active:true,starts_on:'2026-01-01',professionals:prof,units:{name:'Unidade Sintética Centro'}};
const e={id:enrollment,patient_id:patient,plan_id:plan,unit_id:unit,starts_at:'2026-01-01',ends_at:'2027-12-31',due_day:10,status:'active',contract_amount_cents:24000,discount_cents:2000,surcharge_cents:0,sessions_used:2,updated_at:today+'T12:00:00Z',patients:p,patient:p,plans:plans[0],units:{name:'Unidade Sintética Centro'}};
const charge={id:'charge-1',patient_id:patient,enrollment_id:enrollment,unit_id:unit,amount_cents:22000,paid_cents:10000,balance_cents:12000,due_at:month+'-10',coverage_from:month+'-01',coverage_to:month+'-28',status:'partial',description:'Pilates — mensalidade',patients:p};
const item={id:occ,sourceType:'CLASS_OCCURRENCE',sourceId:occ,unitId:unit,startAt:today+'T08:00:00-03:00',endAt:today+'T08:50:00-03:00',status:'planned',title:slot.name,professional:prof,plannedProfessional:prof,class:{id:group,name:slot.name},occupancy:2,capacity:7};
const participant={patient:{id:patient,name:p.name,active:true},source:'membership',sourceType:'membership',source_type:'membership',patient_id:patient,membershipId:'member-1',isMakeup:false};
const rows={
 '/units':[{id:unit,name:'Unidade Sintética Centro',phone:'(31) 90000-0010',active:true},{id:unit+'b',name:'Unidade Sintética Norte',active:true}],
 '/professionals':[prof],'/professional-profiles':[{id:'test-profile',name:prof.name}],'/services':[{id:'service-1',name:'Pilates clínico',duration_minutes:50,price_cents:12000,active:true}],'/rooms':[{id:'room-1',name:'Sala de Pilates',unit_id:unit,capacity:7,active:true}],'/plans':plans,
 '/enrollments':[e],'/enrollment-price-terms':[], '/charges':[charge],'/payments':[{id:'payment-1',charge_id:charge.id,patient_id:patient,amount_cents:10000,method:'pix',paid_at:today+'T12:00:00Z'}],'/group-slots':[slot],'/group-slot-memberships':[{id:'member-1',patient_id:patient,group_slot_id:group,enrollment_id:enrollment,weekdays:[1,3,5],starts_on:'2026-01-01',active:true,patients:p}],
 '/appointments':[], '/record-templates':[{id:'template-1',name:'Avaliação de Pilates',kind:'assessment',active:true}],
 '/clinical-records':[{id:'record-1',patient_id:patient,professional_id:pro,unit_id:unit,kind:'evolution',status:'draft',payload:{text:'Evolução inteiramente sintética para homologação visual.'},created_at:today+'T12:00:00Z'}],'/attachments':[],
 '/financial-entries':[{id:'entry-1',kind:'income',description:'Receita sintética',amount_cents:22000,category:'Pilates',competence_date:today},{id:'entry-2',kind:'expense',description:'Despesa sintética',amount_cents:8000,category:'Operação',competence_date:today}],
 '/commissions':[{id:'commission-1',professional_id:pro,amount_cents:3000,basis:'payment',status:'pending'}],
 '/users':[{id:'user-1',name:'Colaboradora Sintética',email:'colaboradora@example.invalid',role:'reception',active:true,profile_units:[{unit_id:unit}],profile_permissions:[{module:'patients',can_view:true,can_edit:true}]}],
 '/privacy/requests':[], '/privacy/incidents':[], '/privacy/audit':[], '/audit-logs':[], '/privacy-requests':[], '/privacy-incidents':[],
 '/imports':[{id:'batch-1',filename:'pacientes-sinteticos.csv',status:'completed',created_at:today+'T12:00:00Z',rollback_at:today+'T12:00:00Z'}],
 '/makeup-credits':[{id:'credit-1',patient_name:p2.name,source_date:today,state:'eligible',legacy:false}],
 '/makeup-policy':{eligible_statuses:['ABSENT_JUSTIFIED'],no_show_action:'review'},
 '/notifications':[{id:'notice-1',template_key:'agenda.substituted',payload:{start_at:today+'T08:00:00-03:00'},read_at:null}],
};
export function fixture(path,query,method,body){
 if(path==='/me')return {profile:{name:'Administradora Sintética',role:'admin'}};
 if(path==='/dashboard')return {activePatients:2,appointmentsToday:1,overdueCharges:1,overdueAmountCents:12000,receivedMonthCents:10000,paidExpensesMonthCents:8000,dueCharges:[charge],appointments:[{id:occ,status:'planned',starts_at:item.startAt,services:{name:slot.name},professionals:prof,units:{name:'Unidade Sintética Centro'}}]};
 if(path==='/patients')return {items:[p,p2].filter(x=>!query.get('search')||x.name.toLowerCase().includes(query.get('search').toLowerCase())),total:2,page:1,pageSize:20};
 if(/\/patients\/[^/]+\/responsibles$/.test(path))return [{id:'responsible-1',name:'Responsável Sintético',phone:'(31) 90000-0014',relationship:'Familiar'}];
 if(/\/patients\/[^/]+\/consents$/.test(path))return [{id:'consent-1',purpose:'treatment',granted:true,created_at:today+'T12:00:00Z'}];
 if(path.endsWith('/timeline'))return {appointments:[],enrollments:[e],charges:[charge],records:[],events:[]};
 if(path==='/calendar-items')return {items:[item]};
 if(path==='/attendance/daily')return {slots:[{...slot,members:[{id:'member-1',occurrence_id:occ,patient_id:patient,patients:p,attendance:null},{id:'member-2',occurrence_id:occ,patient_id:p2.id,patients:p2,attendance:{status:'present',version:1}}]}],makeups:[]};
 if(path.endsWith('/available-participants'))return {items:[p2]};
 if(path.endsWith('/attendance')&&path.includes('class-occurrences'))return {occurrence:{id:occ,status:'planned'},items:[{patient_id:patient,patient_name:p.name,patient_active:true,attendance_id:null,attendance_status:null,notes:null,history:[]}]};
 if(path===`/class-occurrences/${occ}`)return {occurrence:{id:occ,classes:{name:slot.name},start_at:item.startAt,end_at:item.endAt,status:'planned',planned_professional_id:pro,plannedProfessional:prof,units:{name:'Unidade Sintética Centro'}},participants:[participant],occupancy:1};
 if(path.endsWith('/plan-change/preview'))return {token:'synthetic-preview',new_plan_name:plans[1].name,new_amount_cents:65000,cancel_charge_ids:[],proposed_charges:[{coverage_from:'2026-11-01',coverage_to:'2027-01-29',amount_cents:65000}],charges:[charge]};
 if(path==='/reports/annual'){const keys=['realizedIncomeCents','realizedExpenseCents','expectedIncomeCents','expectedExpenseCents'];return {months:Array.from({length:12},(_,i)=>({month:`2026-${String(i+1).padStart(2,'0')}-01`,...Object.fromEntries(keys.map((k,j)=>[k,(i+1)*(j%2?1000:2000)]))})),totals:Object.fromEntries(keys.map((k,j)=>[k,78*(j%2?1000:2000)]))};}
 if(method!=='GET')return {id:'synthetic-created',...body};
 if(path in rows)return rows[path];
 return [];
}
