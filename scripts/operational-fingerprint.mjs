// Evidence only: hash sources and disposable-schema definitions, never credentials.
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {sourceDigest} from './ui-v2/source-digest.mjs';

export function treeDigest(root,include=()=>true){
 const files=[];
 function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=resolve(dir,item.name);if(item.isDirectory())walk(file);else if(include(file))files.push(file);}}
 walk(root);const hash=createHash('sha256');
 for(const file of files.sort()){hash.update(relative(root,file));hash.update('\0');hash.update(readFileSync(file));hash.update('\0');}
 return hash.digest('hex');
}
export function recordOperationalFingerprint({psql,database,output}){
 const apiRoot=resolve(process.env.FISIOFIT_TEST_API_ROOT??process.cwd());
 const uiRoot=resolve(process.env.FISIOFIT_TEST_UI_ROOT??process.cwd());
 const db=JSON.parse(psql(database,`select json_build_object(
 'version',current_setting('server_version'),
 'clock',now(),'clinic_date',(now() at time zone 'America/Sao_Paulo')::date,
 'original_noon_ended',((now() at time zone 'America/Sao_Paulo')::date+time '12:00') at time zone 'America/Sao_Paulo'<now(),
 'original_13h_ended',((now() at time zone 'America/Sao_Paulo')::date+time '13:00') at time zone 'America/Sao_Paulo'<now(),
 'functions', (select md5(string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
 'columns',(select md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''),E'\\n' order by table_name,ordinal_position)) from information_schema.columns where table_schema='public'))`).trim());
 const record={capturedAt:new Date().toISOString(),frontendDigest:sourceDigest(uiRoot),apiDigest:treeDigest(resolve(apiRoot,'supabase/functions/api'),p=>p.endsWith('.ts')&&!p.endsWith('.test.ts')),migrationsDigest:treeDigest(resolve('supabase/migrations')),fixturesDigest:treeDigest(resolve('supabase/tests')),runnerDigest:treeDigest(resolve('scripts'),p=>/\/(homologate-stabilization|stabilization-browser|stabilization-runtime)\.mjs$/.test(p)),db,readOnlySmoke:false,conditions:{listDelayMs:Number(process.env.FISIOFIT_TEST_LIST_DELAY_MS??0),searchDelayMs:Number(process.env.FISIOFIT_TEST_SEARCH_DELAY_MS??0),cpuRate:Number(process.env.FISIOFIT_TEST_CPU_RATE??1)},synthetic:true};
 writeFileSync(resolve(output,'environment.json'),JSON.stringify(record,null,2)+'\n');
 return record;
}
