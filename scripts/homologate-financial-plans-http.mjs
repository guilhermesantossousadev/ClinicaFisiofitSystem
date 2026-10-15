// Synthetic local HTTP acceptance. Does not read production credentials or data.
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const stack = process.env.FISIOFIT_TEST_STACK ?? 'secfinfinalb14';
if (stack !== 'secfinfinalb14') throw new Error('Only the identified synthetic local stack is allowed');
const db = `supabase_db_${stack}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 2e6 });
const sql = (query) => execFileSync('docker', ['exec','-i',db,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', maxBuffer: 2e6 }).trim();
const runtime = JSON.parse(docker('inspect', `supabase_edge_runtime_${stack}`))[0];
const dbMeta = JSON.parse(docker('inspect',db))[0];
if (runtime.Config.Labels['com.docker.compose.project'] !== stack || dbMeta.Config.Labels['com.docker.compose.project'] !== stack) throw new Error('Local stack identity mismatch');
if (sql("select count(*)=2 and bool_and(name like 'Synthetic SEC-FIN clinic %') from public.clinics") !== 't') throw new Error('Expected synthetic database required');
// Install the exact candidate function bodies in this synthetic stack only.
// The full migration is separately verified in a disposable schema-only database.
const candidateSql = readFileSync(new URL('../supabase/migrations/202610140007_financial_plans_release.sql',import.meta.url),'utf8');
const functions = [...candidateSql.matchAll(/create(?: or replace)? function public\.[\s\S]*?\$\$;/g)].map((m)=>m[0].replace(/^create function /,'create or replace function '));
if(functions.length!==11 || sql("select to_regclass('public.enrollment_price_terms') is not null")!=='t') throw new Error('Expected local financial 007 schema required');
sql('begin;\n'+functions.join('\n')+"\nrevoke all on public.enrollment_price_terms from anon,authenticated; grant select on public.enrollment_price_terms to authenticated; commit;");
const runtimeEnv = Object.fromEntries(runtime.Config.Env.map((s) => s.split(/=(.*)/s).slice(0,2)));
const origin = 'http://127.0.0.1:57321';
const apiOrigin = 'http://127.0.0.1:57428/api/v1';
const out = resolve(process.env.FISIOFIT_TEST_OUTPUT ?? '/private/tmp/fisiofit-plans-homologation');
mkdirSync(out, { recursive: true });
let server;
const userIds = [];
const events = [];
const id = (n) => `f8000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function authRequest(path, data) {
  const response = await fetch(`${origin}/auth/v1/${path}`, { method: 'POST', headers: { apikey: runtimeEnv.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${runtimeEnv.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const json = await response.json(); if (!response.ok) throw new Error(`Synthetic auth ${path}: ${response.status}`); return json;
}
async function request(token, method, path, input, expectedStatus, expectedCode) {
  const response = await fetch(`${apiOrigin}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const result = await response.json();
  if (response.status !== expectedStatus || (expectedCode && result.error?.code !== expectedCode)) throw new Error(`${method} ${path}: expected ${expectedStatus}/${expectedCode ?? ''}, received ${response.status}/${result.error?.code ?? ''}`);
  events.push({ method, path: path.replace(/[a-f\d]{8}-[a-f\d-]{27,}/g,'[fixture]'), status: response.status, code: result.error?.code ?? null });
  return result.data;
}
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  const accounts = {};
  for (const role of ['finance','reception','readonly','outside','foreign']) {
    const email = `plans-release-${role}-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString('hex');
    const created = await authRequest('admin/users', { email, password, email_confirm: true });
    userIds.push(created.id);
    const login = await authRequest('token?grant_type=password', { email, password });
    accounts[role] = { id: created.id, token: login.access_token };
  }
  // Fixture IDs and synthetic account UUIDs only. No real patient data.
  sql(`begin;
  alter table public.clinics alter column owner_profile_id drop not null;
  insert into public.clinics(id,name) values('${id(10)}','Synthetic release007 HTTP clinic'),('${id(11)}','Synthetic release007 foreign clinic');
  insert into public.units(id,clinic_id,name) values('${id(20)}','${id(10)}','Synthetic release007 unit'),('${id(21)}','${id(10)}','Synthetic release007 outside unit'),('${id(22)}','${id(11)}','Synthetic release007 foreign unit');
  ${Object.entries(accounts).map(([role,a]) => `insert into public.profiles(id,clinic_id,name,role,status) values('${a.id}','${role==='foreign'?id(11):id(10)}','Synthetic release007 ${role}','${['reception','readonly'].includes(role)?'reception':'finance'}','active');
  insert into public.profile_units(profile_id,unit_id) values('${a.id}','${role==='outside'?id(21):role==='foreign'?id(22):id(20)}');
  insert into public.profile_permissions(profile_id,module,can_view,can_edit) values('${a.id}','enrollments',true,${role!=='readonly'}),('${a.id}','finance',${!['reception','readonly'].includes(role)},${!['reception','readonly'].includes(role)});`).join('\n')}
  update public.clinics set owner_profile_id='${accounts.finance.id}' where id='${id(10)}';
  update public.clinics set owner_profile_id='${accounts.foreign.id}' where id='${id(11)}';
  alter table public.clinics alter column owner_profile_id set not null;
  insert into public.patients(id,clinic_id,primary_unit_id,name) values('${id(30)}','${id(10)}','${id(20)}','Synthetic release007 patient');
  commit;`);
  const wrapper = resolve(out,'serve.ts');
  writeFileSync(wrapper, `const serve = Deno.serve; Deno.serve = ((handler: unknown) => serve({hostname:'127.0.0.1',port:57428},handler as never)) as typeof Deno.serve; await import(${JSON.stringify(new URL('../supabase/functions/api/index.ts',import.meta.url).href)});`);
  const deno = process.env.DENO_BIN ?? '/private/tmp/deno-2.9.7/deno';
  server = spawn(deno,['run','--no-check','--node-modules-dir=none','--allow-env','--allow-net','--allow-read',wrapper], { env: { ...process.env, DENO_DIR: process.env.DENO_DIR ?? '/private/tmp/fisiofit-hotfix-deno-final-20261014', SUPABASE_URL: origin, SUPABASE_ANON_KEY: runtimeEnv.SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: runtimeEnv.SUPABASE_SERVICE_ROLE_KEY }, stdio: ['ignore','ignore','ignore'] });
  let healthy=false;
  for(let n=0;n<450;n++) { try { healthy=(await fetch(`${apiOrigin}/health`)).ok; } catch {} if(healthy) break; await new Promise((r)=>setTimeout(r,100)); }
  assert(healthy,'Candidate API did not start');
  const finance=accounts.finance.token, reception=accounts.reception.token;
  const plans=[];
  for (const duration of [30,90,180]) for (const frequency of [1,2,3]) plans.push(await request(finance,'POST','/plans',{name:'Synthetic plan',kind:duration===30?'monthly':'package',duration_days:duration,sessions_included:duration/30*frequency*4,price_cents:duration===30&&frequency===2?22000:duration*100+frequency},201));
  const oldPlan=plans.find(p=>p.duration_days===30&&p.sessions_included===8), newPlan=plans.find(p=>p.duration_days===90&&p.sessions_included===24);
  const now=new Date(); const month=(offset)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1)).toISOString().slice(0,10);
  const enrollment=await request(finance,'POST','/enrollments',{patient_id:id(30),unit_id:id(20),plan_id:oldPlan.id,starts_at:month(0),due_day:5},201);
  let charge=JSON.parse(sql(`select row_to_json(c) from public.charges c where enrollment_id='${enrollment.id}'`));
  charge=await request(reception,'PATCH',`/charges/${charge.id}/amount`,{expected_amount_cents:22000,expected_paid_cents:0,amount_cents:26600,reason:'Synthetic prepare discrepancy fixture'},200);
  await request(finance,'POST','/payments',{charge_id:charge.id,amount_cents:22000,method:'pix',paid_at:new Date().toISOString()},201);
  const receiptsBefore=sql(`select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where charge_id='${charge.id}'; select jsonb_agg(to_jsonb(f) order by f.id) from public.financial_entries f where clinic_id='${id(10)}'`);
  const adjusted=await request(reception,'PATCH',`/charges/${charge.id}/amount`,{expected_amount_cents:26600,expected_paid_cents:22000,amount_cents:22000,reason:'Synthetic reviewed contracted amount'},200);
  assert(adjusted.amount_cents===22000&&adjusted.paid_cents===22000&&adjusted.status==='paid','266/220 correction invariant failed');
  assert(receiptsBefore===sql(`select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where charge_id='${charge.id}'; select jsonb_agg(to_jsonb(f) order by f.id) from public.financial_entries f where clinic_id='${id(10)}'`),'Receipts or ledger changed');
  await request(finance,'PATCH',`/plans/${oldPlan.id}`,{price_cents:25000},200);
  await request(finance,'POST','/plans',{name:'Duplicate',kind:'monthly',duration_days:30,sessions_included:8,price_cents:22000},409,'PLAN_COMBINATION_EXISTS');
  const future=await request(finance,'POST','/charges',{patient_id:id(30),unit_id:id(20),enrollment_id:enrollment.id,description:'Synthetic future',due_at:month(1),coverage_from:month(1),coverage_to:new Date(new Date(`${month(2)}T00:00:00Z`).getTime()-86400000).toISOString().slice(0,10)},201);
  assert(future.amount_cents===22000&&future.paid_cents===0,'Future charge ignored contract or invented payment');
  await request(reception,'PATCH',`/enrollments/${enrollment.id}/contract-amount`,{expected_updated_at:enrollment.updated_at,expected_amount_cents:22000,amount_cents:24000,effective_from:month(1),reason:'Synthetic incompatible future contract'},409,'CONTRACT_HAS_FUTURE_CHARGES');
  await request(reception,'PATCH',`/enrollments/${enrollment.id}/contract-amount`,{expected_updated_at:'2000-01-01T00:00:00Z',expected_amount_cents:22000,amount_cents:24000,effective_from:month(2),reason:'Synthetic stale contract revision'},409,'CONTRACT_AMOUNT_CONFLICT');
  const updated=await request(reception,'PATCH',`/enrollments/${enrollment.id}/contract-amount`,{expected_updated_at:enrollment.updated_at,expected_amount_cents:22000,amount_cents:24000,effective_from:month(2),reason:'Synthetic future contract terms'},200);
  await request(accounts.readonly.token,'PATCH',`/charges/${future.id}/amount`,{expected_amount_cents:22000,expected_paid_cents:0,amount_cents:21000,reason:'Synthetic permission denied adjustment'},403,'MODULE_FORBIDDEN');
  await request(reception,'POST','/payments',{charge_id:future.id,amount_cents:100,method:'pix',paid_at:new Date().toISOString()},403,'FORBIDDEN');
  await request(reception,'PATCH',`/plans/${oldPlan.id}`,{price_cents:99999},403,'FORBIDDEN');
  await request(accounts.outside.token,'POST',`/enrollments/${enrollment.id}/plan-change/preview`,{plan_id:newPlan.id,effective_from:month(1)},403,'UNIT_FORBIDDEN');
  await request(accounts.foreign.token,'POST',`/enrollments/${enrollment.id}/plan-change/preview`,{plan_id:newPlan.id,effective_from:month(1)},404,'ENROLLMENT_NOT_FOUND');
  const input={plan_id:newPlan.id,effective_from:month(1)};
  const preview=await request(reception,'POST',`/enrollments/${enrollment.id}/plan-change/preview`,input,200);
  await request(reception,'POST',`/enrollments/${enrollment.id}/plan-change`,{...input,expected_token:'0'.repeat(32),reason:'Synthetic stale preview rejection'},409,'CONTRACT_AMOUNT_CONFLICT');
  const changed=await request(reception,'POST',`/enrollments/${enrollment.id}/plan-change`,{...input,expected_token:preview.token,reason:'Synthetic confirmed reception plan change'},200);
  assert(sql(`select status from public.charges where id='${future.id}'`)==='cancelled','Future charge not explicitly cancelled');
  const successorCharge=JSON.parse(sql(`select row_to_json(c) from public.charges c where enrollment_id='${changed.enrollment.id}'`));
  assert(successorCharge.amount_cents===newPlan.price_cents&&successorCharge.paid_cents===0,'New charge does not follow selected plan');
  assert(receiptsBefore===sql(`select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where charge_id='${charge.id}'; select jsonb_agg(to_jsonb(f) order by f.id) from public.financial_entries f where clinic_id='${id(10)}'`),'Plan change changed real receipts or financial ledger');
  const result={ passed:true, requests:events.length, events, correction:{due_cents:adjusted.amount_cents,received_cents:adjusted.paid_cents,balance_cents:adjusted.amount_cents-adjusted.paid_cents}, receiptAndLedgerPreserved:true, futureChargeFollowsPlan:true, fixtureCleanup:'Only release007 synthetic fixture clinic and accounts removed in finally.' };
  writeFileSync(resolve(out,'http-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(`HTTP acceptance PASS: ${events.length} requests; correction 22000/22000/0; receipts and ledger unchanged.`);
} finally {
  server?.kill('SIGTERM');
  // These exact fixture scopes are created by this script; cleanup is atomic.
  if(sql(`select exists(select 1 from public.clinics where id='${id(10)}' and name='Synthetic release007 HTTP clinic')`)==='t') {
    sql(`begin;
      alter table public.audit_events disable trigger audit_append_only;
      delete from public.audit_events where clinic_id in('${id(10)}','${id(11)}');
      alter table public.audit_events enable trigger audit_append_only;
      delete from public.enrollment_price_terms where clinic_id='${id(10)}';
      delete from public.financial_entries where clinic_id='${id(10)}';
      delete from public.payments where clinic_id='${id(10)}';
      delete from public.charges where clinic_id='${id(10)}';
      delete from public.enrollments where clinic_id='${id(10)}';
      delete from public.plans where clinic_id='${id(10)}';
      delete from public.patients where clinic_id='${id(10)}';
      alter table public.clinics alter column owner_profile_id drop not null;
      update public.clinics set owner_profile_id=null where id in('${id(10)}','${id(11)}');
      delete from public.profile_permissions where profile_id in(select id from public.profiles where clinic_id in('${id(10)}','${id(11)}'));
      delete from public.profile_units where profile_id in(select id from public.profiles where clinic_id in('${id(10)}','${id(11)}'));
      delete from public.profiles where clinic_id in('${id(10)}','${id(11)}');
      delete from public.units where clinic_id in('${id(10)}','${id(11)}');
      delete from public.clinics where id in('${id(10)}','${id(11)}');
      alter table public.clinics alter column owner_profile_id set not null;
      commit;`);
  }
  for(const userId of userIds) await fetch(`${origin}/auth/v1/admin/users/${userId}`,{method:'DELETE',headers:{apikey:runtimeEnv.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${runtimeEnv.SUPABASE_SERVICE_ROLE_KEY}`}});
}
