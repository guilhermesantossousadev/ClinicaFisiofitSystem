// Local-only V2.1 entry point. Never deploys, pushes or writes to the Vault.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {sourceDigest} from './ui-v2/source-digest.mjs';
const base='a0fef799cc8556e8458622da55a019f2611f5b05';
const evidence=resolve('docs/ui-ux-v2.1/evidence');mkdirSync(evidence,{recursive:true});
const checks=[];
function run(name,command,args,env={}) {
 const r=spawnSync(command,args,{encoding:'utf8',env:{...process.env,...env},maxBuffer:50e6});
 writeFileSync(resolve(evidence,name+'.log'),(r.stdout??'')+(r.stderr??''));
 checks.push({name,passed:r.status===0});console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`);
 if(r.status!==0)throw Error(`${name} failed; see docs/ui-ux-v2.1/evidence/${name}.log`);
}
let error;
try {
 const protectedPaths=['supabase','packages/contracts','apps/site','apps/portal/src/application','apps/portal/src/domain','apps/portal/src/infrastructure','apps/portal/src/presentation/auth','apps/portal/src/main.tsx','package-lock.json'];
 const changes=execFileSync('git',['diff',base,'--name-only','--',...protectedPaths],{encoding:'utf8'}).trim();
 if(changes)throw Error('Protected paths changed: '+changes);
 checks.push({name:'protected-paths-unchanged-from-exact-v2',passed:true});
 if(!process.argv.includes('--visual-only')) {
  run('typecheck','npm',['run','typecheck']);
  run('lint','npm',['run','lint']);
  run('design-system-lint','npm',['exec','eslint','packages/design-system/src']);
  // Node platform assertions require the assembled build.
  run('build','npm',['run','build']);
  run('vitest-and-node','npm',['test']);
 }
 if(process.env.FISIOFIT_V21_BASELINE_ROOT)run('visual-before','node',['scripts/ui-v2/browser.mjs','after'],{FISIOFIT_UI_ROOT:process.env.FISIOFIT_V21_BASELINE_ROOT,FISIOFIT_UI_OUTPUT:resolve(evidence,'before')});
 const baseline=JSON.parse(readFileSync(resolve(evidence,'before/result.json'),'utf8'));
 if(baseline.sourceDigest!=='e4b34da1ab11b30317501a55b556bf545a8b1123b3490f1bd9771d8c6e49ad67'||baseline.checks.some(c=>!c.passed))throw Error('Baseline is not the validated V2 or has failed checks');
 if(process.argv.includes('--reuse-visual')) {
  const r=JSON.parse(readFileSync(resolve(evidence,'after/result.json'),'utf8'));
  if(r.sourceDigest!==sourceDigest()||r.checks.some(c=>!c.passed))throw Error('Cannot reuse stale or failed V2.1 evidence');
  checks.push({name:'exact-source-visual-reused',passed:true});
 }else run('visual-after','node',['scripts/ui-v21/browser.mjs','after']);
 run('gallery','node',['scripts/ui-v21/report.mjs']);
 run('diff-check','git',['diff','--check']);
}catch(e){error=String(e);console.error(error);process.exitCode=1;}
const operational=Object.fromEntries(['before','after'].map(name=>{
 const file=resolve(evidence,'operational',name,'summary.json');return [name,existsSync(file)?JSON.parse(readFileSync(file,'utf8')).passed:false];
}));
const status=!error&&operational.before&&operational.after?'READY_FOR_REVIEW':'BLOCKED';
writeFileSync(resolve(evidence,'homologation.json'),JSON.stringify({status,uiChecksPassed:!error,error,base,sourceDigest:sourceDigest(),checks,operational,synthetic:true,published:false},null,2)+'\n');
if(status==='BLOCKED')process.exitCode=1;
console.log(`UI checks ${error?'FAIL':'PASS'}; full acceptance: ${status}. See RELEASE.md for operational limitations.`);
