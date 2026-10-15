// Reproduce the historical expiry condition deterministically in the disposable
// transaction. Production functions and their clocks remain untouched.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function probeExpiredFixtures({psql,database,output}){
 const expected=[32,33,34,35,36,37,38,43,44],runs=[];
 const marker="select lives_ok($$select public.manage_makeup_credit((select id from ids where key='creditA'),'reserve'";
 const expire=`reset role;
-- Only the synthetic target timestamps: no functions, guards, grants or rules change.
update public.class_occurrences set start_at=now()-interval '2 days',end_at=now()-interval '1 day'
 where id in(select id from ids where key in('todayMakeup','todayMakeup2'));
set local role authenticated;
`;
 for(const [label,ref]of [['base','8e9adda7f9b0198ae181add88fd1548d970750c9'],['v2','029eee4e1c9fbe5b3b5b659e66ee085d94b0272b']]){
  const source=execFileSync('git',['show',`${ref}:supabase/tests/operational_stabilization.test.sql`],{encoding:'utf8'});
  if(!source.includes(marker))throw new Error('Expiry probe fixture anchor missing');
  const controlled=source.replace('begin;','begin;\nset local timezone=\'America/Sao_Paulo\';').replace(marker,()=>expire+marker);
  const log=psql(database,'set search_path=public,extensions;\n'+controlled);
  const failed=[...log.matchAll(/^not ok (\d+) - /gm)].map(m=>Number(m[1]));
  writeFileSync(resolve(output,`expired-${label}.sql.log`),log);
  if(JSON.stringify(failed)!==JSON.stringify(expected))throw new Error(`Expiry probe ${label}: unexpected failures ${failed}`);
  runs.push({label,ref,originalFixtureDigest:createHash('sha256').update(source).digest('hex'),expectedFailedAssertions:failed,passed:true});
 }
 const result={passed:true,scope:'negative fixture probe: expected expiry rejection and its cascade, not a green full suite',productionRulesChanged:false,runs};
 writeFileSync(resolve(output,'expired-fixture-probe.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
