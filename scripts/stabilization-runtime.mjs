// Supporting module of homologate-stabilization.mjs. Isolated REST/Storage and
// a disposable database; Auth users exist only in the identified local stack.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function runtimeAcceptance({database,psql,output,browser=true}) {
 const stack='secfinfinalb14', host='http://127.0.0.1', source=`${host}:57321`, proxyOrigin=`${host}:57431`, api=`${proxyOrigin}/functions/v1/api/v1`;
 const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:5e6});
 const inspect=(name)=>JSON.parse(docker(['inspect',name]))[0];
 const rest=inspect(`supabase_rest_${stack}`), storage=inspect(`supabase_storage_${stack}`), runtime=inspect(`supabase_edge_runtime_${stack}`);
 for(const m of [rest,storage,runtime]) if(m.Config.Labels['com.docker.compose.project']!==stack) throw new Error('Local runtime identity mismatch');
 const envOf=(m)=>Object.fromEntries(m.Config.Env.map(s=>s.split(/=(.*)/s).slice(0,2)));
 const runtimeEnv=envOf(runtime), restEnv=envOf(rest), storageEnv=envOf(storage);
 const network=Object.keys(rest.NetworkSettings.Networks)[0];
 const names={rest:`fisiofit-stab-rest-${process.pid}`,storage:`fisiofit-stab-storage-${process.pid}`};
 const authHeaders={apikey:runtimeEnv.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${runtimeEnv.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'};
 const children=[],containers=[],users=[],events=[];let proxy;
 const id=n=>`fc000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const sql=q=>psql(database,q).trim();
 const assert=(condition,message)=>{if(!condition) throw new Error(message);};
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(url) {for(let n=0;n<300;n++){try{if((await fetch(url)).status<500)return;}catch{}await pause(100);}throw new Error(`Local service did not start on ${new URL(url).port}`);}
 function startContainer(name,meta,env,port) {
  const file=resolve(output,`${name}.env`);writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});
  try {docker(['run','--detach','--name',name,'--network',network,'--publish',`127.0.0.1:${port}:`+(name===names.rest?'3000':'5000'),'--env-file',file,meta.Config.Image]);containers.push(name);}
  catch {throw new Error(`Isolated container startup failed: ${name}`);} finally {rmSync(file,{force:true});}
 }
 function replaceDatabase(uri) {const u=new URL(uri);u.pathname=`/${database}`;return u.href;}
 async function auth(path,body) {const r=await fetch(`${source}/auth/v1/${path}`,{method:'POST',headers:authHeaders,body:JSON.stringify(body)});if(!r.ok)throw new Error(`Synthetic Auth failed: ${r.status}`);return r.json();}
 async function request(account,method,path,input,status=200,code,extra={}) {
  const r=await fetch(api+path,{method,headers:{authorization:`Bearer ${account?.token??'invalid'}`,'content-type':'application/json','idempotency-key':extra.key??randomUUID(),...extra.headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
  const json=await r.json();
  events.push({method,path:path.replace(/[a-f\d]{8}-[a-f\d-]{27,}/g,'[fixture]'),status:r.status,code:json.error?.code??null});
  if(r.status!==status||(code&&json.error?.code!==code))throw new Error(`${method} ${path.split('?')[0]} expected ${status}/${code??''}, got ${r.status}/${json.error?.code??''}`);
  return json.data;
 }
 try {
  assert(/^[a-z0-9_]+$/.test(database)&&database.startsWith('stabilization_'),'Disposable database required');
  restEnv.PGRST_DB_URI=replaceDatabase(restEnv.PGRST_DB_URI);
  startContainer(names.rest,rest,restEnv,57430);
  storageEnv.DATABASE_URL=replaceDatabase(storageEnv.DATABASE_URL);
  storageEnv.POSTGREST_URL=`http://${names.rest}:3000`;
  storageEnv.STORAGE_BACKEND='file';storageEnv.FILE_STORAGE_BACKEND_PATH='/var/lib/storage';
  startContainer(names.storage,storage,storageEnv,57432);
  try { await ready(`${host}:57430/`);await ready(`${host}:57432/status`); } catch (error) { for(const name of containers) { try { writeFileSync(resolve(output,name+'.log'),docker(['logs',name]).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'postgres://[local]')); } catch {} } throw error; }
  proxy=createServer(async(req,res)=>{
   const origin=req.headers.origin??`${host}:57435`;
   res.setHeader('access-control-allow-origin',origin);res.setHeader('access-control-allow-credentials','true');
   res.setHeader('access-control-allow-headers',req.headers['access-control-request-headers']??'authorization,apikey,content-type,x-client-info');res.setHeader('access-control-allow-methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
   if(req.method==='OPTIONS'&&!req.url.startsWith('/functions/')){res.writeHead(204);res.end();return;}
   try {
    let target;
    if(req.url.startsWith('/rest/v1'))target=`${host}:57430${req.url.slice(8)}`;
    else if(req.url.startsWith('/storage/v1'))target=`${host}:57432${req.url.slice(11)}`;
    else if(req.url.startsWith('/functions/v1'))target=`${host}:57434${req.url.slice(13)}`;
    else target=source+req.url;
    const parts=[];for await(const p of req)parts.push(p);const body=Buffer.concat(parts);
    // Explicit local fault injection for differential search tests; never alters responses.
    const query=new URL(req.url,proxyOrigin);
    if(query.pathname.endsWith('/patients')) {
     const key=query.searchParams.has('search')?'FISIOFIT_TEST_SEARCH_DELAY_MS':'FISIOFIT_TEST_LIST_DELAY_MS';
     const delay=Number(process.env[key]??0);if(!Number.isFinite(delay)||delay<0||delay>3000)throw new Error('Invalid synthetic delay');
     if(delay)await pause(delay);
    }
    const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];delete headers['transfer-encoding'];
    const response=await fetch(target,{method:req.method,headers,...(body.length?{body}:{})});
    for(const[k,v]of response.headers)if(!['content-encoding','content-length','transfer-encoding','connection','access-control-allow-origin','access-control-allow-credentials'].includes(k))res.setHeader(k,v);
    res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
   }catch{res.writeHead(502);res.end(JSON.stringify({error:{code:'LOCAL_PROXY_FAILED'}}));}
  });
  await new Promise((ok,fail)=>{proxy.once('error',fail);proxy.listen(57431,'127.0.0.1',ok);});
  const accounts={};
  for(const role of ['admin','manager','reception','professional','substitute','finance','denied','foreign']) {
   const email=`stabilization-${role}-${randomUUID()}@example.invalid`,password=randomBytes(20).toString('hex');
   const created=await auth('admin/users',{email,password,email_confirm:true});users.push(created.id);
   const login=await auth('token?grant_type=password',{email,password});accounts[role]={id:created.id,token:login.access_token,email,password};
  }
  sql(`begin;alter table public.clinics alter constraint clinics_owner_profile_fk deferrable initially deferred;
   insert into auth.users(id) values${users.map(u=>`('${u}')`).join(',')};
   insert into public.clinics(id,name,owner_profile_id,makeup_policy)values('${id(10)}','Synthetic HTTP stabilization','${accounts.admin.id}','{"eligible_statuses":["ABSENT_JUSTIFIED"],"no_show_action":"return"}'),('${id(11)}','Synthetic foreign HTTP','${accounts.foreign.id}',null);
   ${Object.entries(accounts).map(([role,a])=>`insert into public.profiles(id,clinic_id,name,role,status)values('${a.id}','${role==='foreign'?id(11):id(10)}','Synthetic ${role}','${['substitute'].includes(role)?'professional':['denied'].includes(role)?'reception':role==='foreign'?'admin':role}','active');`).join('\n')}
   insert into public.units(id,clinic_id,name)values('${id(20)}','${id(10)}','Synthetic unit A'),('${id(21)}','${id(10)}','Synthetic unit B'),('${id(22)}','${id(11)}','Synthetic foreign unit');
   ${Object.entries(accounts).filter(([r])=>!['admin','foreign'].includes(r)).map(([role,a])=>`insert into public.profile_units(profile_id,unit_id)values('${a.id}','${role==='substitute'?id(21):id(20)}');`).join('\n')}
   insert into public.profile_units(profile_id,unit_id)values('${accounts.reception.id}','${id(21)}'),('${accounts.manager.id}','${id(21)}');
   ${Object.entries(accounts).filter(([r])=>!['admin','foreign','denied'].includes(r)).flatMap(([role,a])=>{const modules=role==='finance'?['finance','enrollments']:role==='reception'?['agenda','patients','enrollments']:['professional','substitute'].includes(role)?['agenda','patients','records']:['agenda','patients','records','finance','enrollments','settings','dashboard','users'];return modules.map(m=>`insert into public.profile_permissions(profile_id,module,can_view,can_edit)values('${a.id}','${m}',true,true);`);}).join('\n')}
   insert into public.professionals(id,clinic_id,name,profile_id)values('${id(40)}','${id(10)}','Synthetic primary','${accounts.professional.id}'),('${id(41)}','${id(10)}','Synthetic substitute','${accounts.substitute.id}'),('${id(42)}','${id(10)}','Synthetic parallel',null);
   insert into public.professional_units(professional_id,unit_id)values('${id(40)}','${id(20)}'),('${id(41)}','${id(21)}'),('${id(42)}','${id(20)}');
   insert into public.patients(id,clinic_id,primary_unit_id,name)values('${id(30)}','${id(10)}','${id(20)}','Synthetic Alpha'),('${id(31)}','${id(10)}','${id(21)}','Synthetic Beta'),('${id(32)}','${id(10)}','${id(20)}','Synthetic Gamma');
   insert into public.patients(id,clinic_id,primary_unit_id,name)select ('fc000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'${id(10)}','${id(20)}','Synthetic search '||lpad(n::text,3,'0')from generate_series(1,110)n;
   commit;`);
  const wrapper=resolve(output,'serve-candidate.ts');
  const apiEntry=process.env.FISIOFIT_TEST_API_ROOT?pathToFileURL(resolve(process.env.FISIOFIT_TEST_API_ROOT,'supabase/functions/api/index.ts')).href:new URL('../supabase/functions/api/index.ts',import.meta.url).href;
  writeFileSync(wrapper,`const serve=Deno.serve;Deno.serve=((handler:unknown)=>serve({hostname:'127.0.0.1',port:57434},(async(req:Request)=>{if(new URL(req.url).pathname.endsWith('/clinical-records')&&new URL(req.url).searchParams.get('patientId')==='${id(30)}')await new Promise(r=>setTimeout(r,1000));return (handler as (r:Request)=>Response)(req);})as never))as typeof Deno.serve;await import(${JSON.stringify(apiEntry)});`);
  const deno=spawn(process.env.DENO_BIN??'/private/tmp/deno-2.9.7/deno',['run','--no-check','--node-modules-dir=none','--allow-env','--allow-read','--allow-net',wrapper],{env:{...process.env,DENO_DIR:process.env.DENO_DIR??'/private/tmp/fisiofit-hotfix-deno-final-20261014',SUPABASE_URL:proxyOrigin,SUPABASE_ANON_KEY:runtimeEnv.SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:runtimeEnv.SUPABASE_SERVICE_ROLE_KEY,APP_ORIGIN:`${host}:57435`,FISIOFIT_READ_ONLY_SMOKE:'false'},stdio:['ignore','ignore','ignore']});children.push(deno);await ready(`${host}:57434/api/v1/health`);
  const A=accounts.admin,R=accounts.reception,P=accounts.professional,F=accounts.finance;
  await request(null,'GET','/patients',undefined,401,'UNAUTHENTICATED');
  await request(accounts.denied,'GET','/calendar-items?unitId='+id(20)+'&from=2026-10-15T00:00:00Z&to=2026-10-16T00:00:00Z',undefined,403,'MODULE_FORBIDDEN');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const day=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
  const weekDays=[1,2,3,4,5];
  const group=await request(R,'POST','/group-slots',{unit_id:id(20),professional_id:id(40),name:'Synthetic operating class',weekdays:weekDays,starts_at:'08:00',starts_on:today,duration_minutes:60,capacity:1},201);
  const groups=await request(R,'GET','/group-slots');const classId=groups.find(g=>g.id===group.id)?.class_id;assert(classId,'Legacy command did not link Class');
  await request(R,'POST',`/group-slots/${group.id}/members`,{patient_id:id(30),starts_at:today,weekdays:weekDays},201);
  await request(R,'POST',`/group-slots/${group.id}/members`,{patient_id:id(32),starts_at:today,weekdays:weekDays},201);
  const calendarPath=`/calendar-items?unitId=${id(20)}&from=${today}T00:00:00-03:00&to=${day(7)}T00:00:00-03:00`;
  const calendar=await request(R,'GET',calendarPath);const occurrence=calendar.items.find(o=>o.class?.id===classId&&o.startAt.startsWith(today));assert(occurrence?.occupancy===2,'Calendar occupancy disagrees with persisted roster');
  const filtered=await request(R,'GET',calendarPath+`&patientId=${id(31)}`);assert(filtered.items.length===0,'Patient calendar filter returned unrelated classes');
  const daily=await request(P,'GET',`/attendance/daily?unitId=${id(20)}&date=${today}`);assert(daily.slots[0]?.members.length===2,'Daily attendance does not use occurrence roster');
  const preflight=await fetch(api+`/class-occurrences/${occurrence.id}/attendance/${id(30)}`,{method:'OPTIONS',headers:{origin:`${host}:57435`,'access-control-request-method':'PUT','access-control-request-headers':'authorization,apikey,content-type'}});
  assert(preflight.headers.get('access-control-allow-methods')?.includes('PUT'),'Browser CORS blocks PUT');events.push({method:'OPTIONS',status:preflight.status,check:'PUT preflight'});
  await request(P,'PUT',`/class-occurrences/${occurrence.id}/attendance/${id(30)}`,{status:'ABSENT_JUSTIFIED',notes:'Synthetic notice'},200);
  const attendance=await request(P,'GET',`/class-occurrences/${occurrence.id}/attendance`);const row=attendance.items.find(p=>p.patient_id===id(30));assert(row.notes==='Synthetic notice'&&row.version===1,'Notes/version missing in HTTP response');
  await request(P,'PUT',`/class-occurrences/${occurrence.id}/attendance/${id(30)}`,{status:'PRESENT',notes:'Synthetic notice',expectedVersion:1,reason:'Synthetic correction'},200);
  await request(P,'PUT',`/class-occurrences/${occurrence.id}/attendance/${id(30)}`,{status:'ABSENT_JUSTIFIED',notes:'Synthetic notice',expectedVersion:1,reason:'Stale correction'},409,'ATTENDANCE_VERSION_CONFLICT');
  const concurrentStatuses=['ABSENT_JUSTIFIED','LATE'];
  const corrections=await Promise.all(concurrentStatuses.map(async status=>{const response=await fetch(api+`/class-occurrences/${occurrence.id}/attendance/${id(30)}`,{method:'PUT',headers:{authorization:`Bearer ${P.token}`,'content-type':'application/json'},body:JSON.stringify({status,notes:'Synthetic notice',expectedVersion:2,reason:'Synthetic simultaneous correction'})});events.push({method:'PUT',status:response.status,check:'concurrent attendance'});return {status:response.status,body:await response.json(),attendanceStatus:status};}));
  assert(corrections.filter(r=>r.status===200).length===1&&corrections.filter(r=>r.status===409&&r.body.error?.code==='ATTENDANCE_VERSION_CONFLICT').length===1,'Concurrent attendance did not reject stale version');
  assert(sql(`select a.status from public.attendances a join public.occurrence_participants p on p.id=a.occurrence_participant_id where p.class_occurrence_id='${occurrence.id}' and p.patient_id='${id(30)}'`)===corrections.find(r=>r.status===200).attendanceStatus,'Concurrent attendance response differs from database');
  const history=await request(P,'GET',`/class-occurrences/${occurrence.id}/attendance`);assert(history.items.find(p=>p.patient_id===id(30)).history.length===2,'Correction history not returned');
  await request(F,'GET','/patients?includeOperational=true',undefined,403,'FORBIDDEN');
  await request(P,'GET','/charges',undefined,403,'FORBIDDEN');
  await request(accounts.foreign,'GET',`/class-occurrences/${occurrence.id}`,undefined,404,'CLASS_OCCURRENCE_NOT_FOUND');
  const search=await request(R,'GET','/patients?page=1&pageSize=100&search=Synthetic%20search%20110');assert(search.items[0]?.name==='Synthetic search 110','Search cannot reach patient after first 100');
  const page2=await request(R,'GET','/patients?page=2&pageSize=100');assert(page2.total===113&&page2.items.length===13,'Patient pagination lost rows');
  const plans=await request(A,'POST','/plans',{name:'Synthetic monthly',kind:'monthly',duration_days:30,sessions_included:8,price_cents:22000},201);
  const enrollment=await request(A,'POST','/enrollments',{patient_id:id(30),unit_id:id(20),plan_id:plans.id,group_slot_id:group.id,starts_at:today,due_day:5},201);
  assert(sql(`select count(*)from public.class_memberships where class_id='${classId}' and patient_id='${id(30)}'`)==='1','Enrollment duplicated an existing Class membership');
  const terms=await request(R,'GET','/enrollment-price-terms');assert(Array.isArray(terms)&&sql(`select contract_amount_cents from public.enrollments where id='${enrollment.id}'`)==='22000','Price terms list or persisted contract snapshot is not executable');
  const charges=await request(R,'GET','/charges');const charge=charges.find(c=>c.enrollment_id===enrollment.id);
  const paymentInput={charge_id:charge.id,amount_cents:10000,method:'pix',paid_at:new Date().toISOString()},key=randomUUID();
  const attempts=await Promise.all([request(F,'POST','/payments',paymentInput,201,undefined,{key}),request(F,'POST','/payments',paymentInput,201,undefined,{key})]);assert(attempts[0].id===attempts[1].id,'Concurrent payment duplicated');
  assert(sql(`select paid_cents from public.charges where id='${charge.id}'`)==='10000','Payment response did not persist correct balance');
  await request(R,'POST','/payments',paymentInput,403,'FORBIDDEN');
  await request(A,'POST',`/enrollments/${enrollment.id}/rollback`,{reason:'Synthetic rollback preserves receipt'},409,'ENROLLMENT_HAS_PAYMENTS');
  const ledger=JSON.parse(sql(`select row_to_json(f)from public.financial_entries f where payment_id='${attempts[0].id}'`));
  await request(F,'DELETE',`/financial-entries/${ledger.id}`,undefined,409,'PAYMENT_LEDGER_IMMUTABLE');
  await request(A,'PATCH',`/professionals/${id(42)}`,{profile_id:accounts.professional.id},409,'PROFESSIONAL_PROFILE_ALREADY_LINKED');
  const recordA=await request(A,'POST','/clinical-records',{patient_id:id(30),professional_id:id(40),unit_id:id(20),kind:'evolution',payload:{text:'SYNTHETIC_ALPHA_PRIVATE'}},201);
  const recordB=await request(A,'POST','/clinical-records',{patient_id:id(31),professional_id:id(41),unit_id:id(21),kind:'evolution',payload:{text:'SYNTHETIC_BETA_PRIVATE'}},201);
  await request(P,'POST',`/clinical-records/${recordA.id}/sign`,{},200);
  await request(P,'POST',`/clinical-records/${recordA.id}/sign`,{},200);
  assert(sql(`select status from public.clinical_records where id='${recordA.id}'`)==='signed','Signing did not persist');
  await request(F,'GET',`/clinical-records?patientId=${id(30)}`,undefined,403,'FORBIDDEN');
  await request(R,'GET',`/attachments?patientId=${id(30)}`,undefined,403,'MODULE_FORBIDDEN');
  const upload=await request(P,'POST','/attachments/upload-url',{patient_id:id(30),entity_type:'patient',entity_id:id(30),filename:'synthetic.txt.pdf',content_type:'application/pdf',size_bytes:14},201);
  const uploaded=await fetch(`${proxyOrigin}/storage/v1/object/upload/sign/clinical-files/${upload.path}?token=${encodeURIComponent(upload.token)}`,{method:'PUT',headers:{'content-type':'application/pdf','x-upsert':'false'},body:'%PDF-synthetic'});assert(uploaded.ok,`Synthetic file upload failed: ${uploaded.status}`);
  const signed=await request(P,'GET',`/attachments/${upload.attachment.id}/download-url`);const url=signed.signedUrl.replace(/http:\/\/[^/]+/,proxyOrigin);const file=await fetch(url);assert(file.ok&&(await file.text())==='%PDF-synthetic','Signed attachment did not open actual stored bytes');
  const deniedFile=await fetch(`${proxyOrigin}/storage/v1/object/authenticated/clinical-files/${upload.path}`,{headers:{apikey:runtimeEnv.SUPABASE_ANON_KEY,Authorization:`Bearer ${R.token}`}});assert(!deniedFile.ok,'Reception bypassed clinical module through known Storage path');
  await request(accounts.foreign,'GET',`/attachments/${upload.attachment.id}/download-url`,undefined,404,'ATTACHMENT_NOT_FOUND');
  const template=await request(A,'POST','/record-templates',{name:'Synthetic template',kind:'evolution',schema:{}},201);
  await request(A,'DELETE',`/record-templates/${template.id}`,undefined,200);assert(sql(`select active from public.record_templates where id='${template.id}'`)==='f','Template soft delete failed');
  const dashboard=await request(A,'GET',`/dashboard?unitId=${id(20)}`);assert(dashboard.appointments.some(x=>x.id===occurrence.id),'Dashboard omits Class occurrence');
  if(browser) {const {browserAcceptance}=await import('./stabilization-browser.mjs');await browserAcceptance({proxyOrigin,anonKey:runtimeEnv.SUPABASE_ANON_KEY,account:A,financeAccount:F,output,children,sql,calendarAccounts:process.env.FISIOFIT_TEST_CALENDAR==='1'?{reception:R,professional:P}:undefined,fixture:{unit:id(20),unitB:id(21),professionalB:id(41),patientA:id(30),patientB:id(31),recordA:recordA.id,recordB:recordB.id}});}
  const result={passed:true,requests:events.length,events,actualStorageBytesVerified:true,concurrentPaymentIdempotency:true,database:'disposable repository-migration schema',browser};
  writeFileSync(resolve(output,'http-result.json'),JSON.stringify(result,null,2)+'\n');console.log(`HTTP acceptance PASS (${events.length} requests; actual Auth/RLS/Storage, synthetic data).`);return result;
 } finally {
  for(const c of children) c.kill('SIGTERM');
  if(proxy)await new Promise(r=>proxy.close(r));
  for(const name of containers.reverse())try{docker(['rm','--force','--volumes',name]);}catch{}
  for(const user of users)await fetch(`${source}/auth/v1/admin/users/${user}`,{method:'DELETE',headers:authHeaders});
 }
}
