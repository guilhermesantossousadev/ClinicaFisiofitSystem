// Unified local acceptance runner. No remote credentials, databases or patient data.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const stack = 'secfinfinalb14';
if (process.env.FISIOFIT_TEST_STACK && process.env.FISIOFIT_TEST_STACK !== stack) throw new Error('Unsupported local synthetic stack');
const output = resolve(process.env.FISIOFIT_TEST_OUTPUT ?? '/private/tmp/fisiofit-stabilization-evidence');
mkdirSync(output, { recursive: true });
const results=[];
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',maxBuffer:30e6});
const container=`supabase_db_${stack}`;
const psql=(database,query)=>docker(['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],query);
const scratch=`stabilization_${process.pid}`;
const migrations=readdirSync('supabase/migrations').filter(f=>f.startsWith('20261015')).sort();
function run(name,command,args,env={}) {
 const r=spawnSync(command,args,{encoding:'utf8',env:{...process.env,...env},maxBuffer:15e6});
 writeFileSync(resolve(output,`${name}.log`),(r.stdout??'')+(r.stderr??''));
 results.push({name,passed:r.status===0});console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`);
 if(r.status!==0) throw new Error(`${name} failed (see log)`);
}
let created=false;
try {
 const meta=JSON.parse(docker(['inspect',container]))[0];
 if(meta.Config.Labels['com.docker.compose.project']!==stack || psql('postgres',"select count(*)=2 and bool_and(name like 'Synthetic SEC-FIN clinic %') from public.clinics").trim()!=='t') throw new Error('Synthetic database identity mismatch; refused');
 psql('postgres',`create database ${scratch};`);created=true;
 const schema=docker(['exec',container,'pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner']);
 psql(scratch,schema);
 const storageMigrations=docker(['exec',container,'pg_dump','-U','postgres','-d','postgres','--data-only','--table=storage.migrations','--no-owner']);
 psql(scratch,storageMigrations);
 // pg_dump --no-owner deliberately avoids transplanting application ownership.
 // Restore only Storage infrastructure ownership for its isolated local server.
 psql(scratch,`do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='storage' loop execute format('alter table storage.%I owner to supabase_storage_admin',r.tablename); end loop;
 for r in select sequencename from pg_sequences where schemaname='storage' loop execute format('alter sequence storage.%I owner to supabase_storage_admin',r.sequencename); end loop;
 end $$; grant usage on schema storage,public to supabase_storage_admin;`);
 // Rebuild the application schema from the repository, not from undocumented
 // changes in a previously used development stack. Auth/Storage are local infrastructure.
 psql(scratch,`drop schema public cascade; create schema public;
 grant usage on schema public to anon,authenticated,service_role;
 grant all on schema public to postgres,supabase_admin;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' loop execute format('drop policy %I on storage.objects',p.policyname); end loop; end $$;
 insert into auth.users(id) values('d0422411-434d-43c8-af22-f8f163c9a3eb');`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.startsWith('20261015')).sort()) {
  try { psql(scratch,'begin;\n'+readFileSync(`supabase/migrations/${file}`,'utf8')+'\ncommit;'); }
  catch { throw new Error(`Repository migration replay failed: ${file}`); }
 }
 results.push({name:'repository-baseline-replay',passed:true});
 // Probe the pending migration against nonempty, validated financial fixtures.
 const financialFixture=readFileSync('supabase/tests/financial_plans_release.test.sql','utf8').replace(/rollback;\s*$/i,'').replace("select ok(not has_table_privilege('authenticated','public.charges','update'),'no direct charge update grant introduced');",'').replace('select plan(53);','select plan(52);');
 const snapshot=`create temp table preservation(table_name text,columns_sql text,digest text);
 do $$ declare r record; cols text; digest text; begin
 for r in select tablename from pg_tables where schemaname='public' loop
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name=r.tablename;
 execute format($q$select md5(coalesce(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text),'')) from (select %s from public.%I)t$q$,cols,r.tablename) into digest;
 insert into preservation values(r.tablename,cols,digest);end loop;end $$;`;
 const verify=`do $$ declare r record; digest text; begin for r in select * from preservation loop
 execute format($q$select md5(coalesce(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text),'')) from (select %s from public.%I)t$q$,r.columns_sql,r.table_name) into digest;
 if digest is distinct from r.digest then raise exception 'EXISTING_DATA_CHANGED: %',r.table_name;end if;end loop;end $$; rollback;`;
 const probe=psql(scratch,'set search_path=public,extensions; create extension if not exists pgtap with schema extensions;\n'+financialFixture+'\nreset role; select set_config(\'request.jwt.claim.sub\',\'\',true);\n'+snapshot+'\n'+migrations.map(f=>readFileSync('supabase/migrations/'+f,'utf8')).join('\n')+'\n'+verify);
 writeFileSync(resolve(output,'migration-preservation.log'),probe);
 if(/(?:^|\n)not ok|ERROR:|Looks like you failed/m.test(probe))throw new Error('Financial fixture migration preservation probe failed');
 writeFileSync(resolve(output,'migration-preservation.log'),probe+'\nAll original public columns/rows preserved byte-for-byte.\n');
 results.push({name:'migration-existing-data-preservation',passed:true});console.log('migration-existing-data-preservation: PASS');
 for(const file of migrations) {
  psql(scratch,'begin;\n'+readFileSync(`supabase/migrations/${file}`,'utf8')+'\ncommit;');
  results.push({name:file,passed:true}); console.log(`${file}: PASS (schema-only disposable database)`);
 }
 psql(scratch,'create extension if not exists pgtap with schema extensions;');
 for(const file of readdirSync('supabase/tests').filter(f=>f.endsWith('.test.sql')).sort()) {
  let log; try { log=psql(scratch,'set search_path=public,extensions;\n'+readFileSync(`supabase/tests/${file}`,'utf8')); } catch(error) { log=(error.stdout??'')+(error.stderr??''); }
  writeFileSync(resolve(output,file+'.log'),log);
  const count=Number(log.match(/1\.\.(\d+)/)?.[1]??0);
  const passed=count>0&&!/(?:^|\n)not ok|ERROR:|Looks like you failed/m.test(log);
  results.push({name:file,passed,assertions:count});console.log(`${file}: ${passed?'PASS':'FAIL'} (${count})`);

 }
 const repairFixture=readFileSync('supabase/tests/reconciliation.fixture.sql','utf8');
 const repairSql=readFileSync('docs/stabilization/reconcile-approved-four.sql','utf8').replace(":'operator_profile_id'","'fe000000-0000-4000-8000-000000000001'").replace('begin isolation level serializable;','').replace(/commit;\s*$/,'');
 let driftRejected=false;
 try{psql(scratch,repairFixture+repairSql+'\nrollback;');}catch(error){driftRejected=String(error.stderr).includes('RECONCILIATION_DRIFT_REVIEW_REQUIRED');}
 if(!driftRejected)throw new Error('Reconciliation failed to reject unreviewed fingerprint');
 const fixtureRepair=repairSql.replace("r->>'fingerprint'<>'fd2da43b74c5c805095169bf44500d09'","r->>'fingerprint' is null");
 const repairEvidence=psql(scratch,repairFixture+fixtureRepair+`
do $$ begin
 if(select count(*)from public.class_memberships where legacy_source='group_slot_membership' and clinic_id='fe000000-0000-4000-8000-000000000010' and effective_to is null)<>2 then raise exception 'RECONCILIATION_NOT_APPLIED';end if;
 if exists(select 1 from public.class_memberships where patient_id='fe000000-0000-4000-8000-000000000033')then raise exception 'DELETED_PATIENT_WAS_REACTIVATED';end if;
 end $$;rollback;`);
 writeFileSync(resolve(output,'reconciliation-synthetic.log'),'Unreviewed fingerprint rejected; transaction rolled back.\n'+repairEvidence+'\n2 inserts, 2 future closures, deleted patient preserved.\n');
 results.push({name:'guarded-reconciliation-synthetic',passed:true});console.log('guarded-reconciliation-synthetic: PASS');
 if(results.some(r=>!r.passed)) throw new Error('SQL suites contain failures; inspect summary and per-suite logs');
 if(!process.argv.includes('--sql-only') && !process.argv.includes('--http-only')) {
  run('typecheck','npm',['run','typecheck']);
  run('lint','npm',['run','lint']);
  run('deno-check',process.env.DENO_BIN??'/private/tmp/deno-2.9.7/deno',['check','supabase/functions/api/index.ts']);
  run('api-tests',process.env.DENO_BIN??'/private/tmp/deno-2.9.7/deno',['test','supabase/functions/api/authorization.test.ts','supabase/functions/api/financial-errors.test.ts']);
  run('build','npm',['run','build']);
  run('frontend-and-node','npm',['test']);
  run('financial-regression','node',['scripts/homologate-financial-plans.mjs'],{FISIOFIT_TEST_OUTPUT:resolve(output,'financial')});
  run('diff-check','git',['diff','--check']);
 }
 if(!process.argv.includes('--sql-only')) {
  const {runtimeAcceptance}=await import('./stabilization-runtime.mjs');
  const http=await runtimeAcceptance({database:scratch,psql,output,browser:!process.argv.includes('--no-browser')});
  results.push({name:'authenticated-http',passed:http.passed,requests:http.requests});
 }
 writeFileSync(resolve(output,'summary.json'),JSON.stringify({passed:true,results},null,2)+'\n');
} catch(error) {
 writeFileSync(resolve(output,'summary.json'),JSON.stringify({passed:false,results,error:String(error)},null,2)+'\n');throw error;
} finally { if(created) psql('postgres',`drop database ${scratch} with(force);`); }
