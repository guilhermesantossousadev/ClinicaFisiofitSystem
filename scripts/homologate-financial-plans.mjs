// One release acceptance battery. Only the identified local synthetic stack is used.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output=resolve(process.env.FISIOFIT_TEST_OUTPUT ?? '/private/tmp/fisiofit-plans-homologation');
mkdirSync(output,{recursive:true});
const results=[];
function run(name,cmd,args,env={}) {
  const result=spawnSync(cmd,args,{encoding:'utf8',env:{...process.env,...env},maxBuffer:8e6});
  const log=(result.stdout??'')+(result.stderr??''); writeFileSync(resolve(output,`${name}.log`),log);
  const passed=result.status===0;
  results.push({name,passed}); console.log(`${name}: ${passed?'PASS':'FAIL'}`);
  if(!passed) throw new Error(`${name} failed; inspect ${resolve(output,`${name}.log`)}`);
  return log;
}
const stack=process.env.FISIOFIT_TEST_STACK ?? 'secfinfinalb14';
if(stack!=='secfinfinalb14') throw new Error('Only the previously identified synthetic stack is supported');
const container=`supabase_db_${stack}`;
const scratch=`release007_acceptance_${process.pid}`;
const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,maxBuffer:20e6});
const psql=(db,input)=>docker(['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],input);
let created=false;
try {
  run('typecheck','npm',['run','typecheck']);
  run('lint','npm',['run','lint']);
  run('frontend-directed','npm',['run','test','-w','@fisiofit/portal','--','src/application/portal/monthlyPaymentControl.test.ts','src/application/portal/planControl.test.ts','src/application/portal/paymentPlans.test.ts','src/presentation/modules/MonthlyPayments.test.tsx','src/presentation/modules/PlanCatalog.test.tsx']);
  run('api-directed',process.env.DENO_BIN ?? '/private/tmp/deno-2.9.7/deno',['test','supabase/functions/api/financial-errors.test.ts','supabase/functions/api/authorization.test.ts'],{DENO_DIR:process.env.DENO_DIR??'/private/tmp/fisiofit-hotfix-deno-final-20261014'});
  const meta=JSON.parse(docker(['inspect',container]))[0];
  if(meta.Config.Labels['com.docker.compose.project']!==stack||psql('postgres',"select count(*)=2 and bool_and(name like 'Synthetic SEC-FIN clinic %') from public.clinics;").trim()!=='t') throw new Error('Synthetic identity mismatch');
  // Isolate SQL tests from the HTTP stack. Clone schema only (no patient/auth data),
  // restore the affected RPCs from 001–006, then apply the final 007 file in full.
  psql('postgres',`create database ${scratch};`);created=true;
  const schema=docker(['exec',container,'pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner']);
  psql(scratch,schema);
  psql(scratch,`drop table public.enrollment_price_terms cascade;
    drop function public.save_enrollment_before_financial_release(jsonb,uuid,uuid);
    drop function if exists public.set_enrollment_contract_terms(uuid,timestamptz,integer,integer,date,text,uuid);
    drop function public.require_enrollment_financial_editor();
    drop function public.adjust_charge_amount(uuid,integer,integer,integer,text,uuid);
    drop function public.enrollment_amount_at(uuid,date,date);
    drop function public.preview_enrollment_plan_change(uuid,uuid,date);
    drop function public.change_enrollment_plan(uuid,uuid,date,text,text,uuid);
    drop function public.save_plan(jsonb,uuid,uuid);`);
  const baseline=readFileSync('supabase/migrations/202610130002_enrollment_contract_amount.sql','utf8');
  psql(scratch,baseline.slice(baseline.indexOf('create or replace function public.set_enrollment_contract_amount')));
  psql(scratch,readFileSync('supabase/migrations/202610130005_financial_reception_permissions.sql','utf8'));
  psql(scratch,'begin;\n'+readFileSync('supabase/migrations/202610140007_financial_plans_release.sql','utf8')+'\ncommit;');
  const sqlOutput=psql(scratch,readFileSync('supabase/tests/financial_plans_release.test.sql','utf8'));
  writeFileSync(resolve(output,'sql-directed.log'),sqlOutput);
  if(/not ok|ERROR:|failed/i.test(sqlOutput)) throw new Error('SQL assertions failed');
  const count=sqlOutput.match(/1\.\.(\d+)/)?.[1];
  if(!count) throw new Error('SQL acceptance did not finish');
  results.push({name:'migration007-and-sql',passed:true,assertions:Number(count)});console.log(`migration007-and-sql: PASS (${count} assertions)`);
  run('http-directed','node',['scripts/homologate-financial-plans-http.mjs']);
  run('build','npm',['run','build']);
  run('publication-ci-tests','npm',['test']);
  run('diff-check','git',['diff','--check']);
  writeFileSync(resolve(output,'summary.json'),JSON.stringify({passed:true,results},null,2)+'\n');
  console.log(`Release acceptance PASS. Evidence: ${output}`);
} catch(error) {
  writeFileSync(resolve(output,'summary.json'),JSON.stringify({passed:false,results,error:String(error)},null,2)+'\n');throw error;
} finally {
  if(created) psql('postgres',`drop database ${scratch} with(force);`);
}
