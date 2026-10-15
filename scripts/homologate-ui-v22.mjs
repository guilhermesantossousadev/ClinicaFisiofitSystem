// Local review only. Never deploys, publishes, pushes or synchronizes memory.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const evidence=resolve('docs/ui-ux-v2.2/evidence');mkdirSync(evidence,{recursive:true});
const base='62936e604370170593e344a2cf466cf32efddc5a';
function run(name,cmd,args,env={}){const r=spawnSync(cmd,args,{encoding:'utf8',env:{...process.env,...env},maxBuffer:50e6});writeFileSync(resolve(evidence,name+'.log'),(r.stdout??'')+(r.stderr??''));if(r.status!==0)throw Error(name+' failed; see evidence log');console.log(name+': PASS');}
try{
 const protectedChanges=execFileSync('git',['diff',base,'--name-only','--','supabase','packages/contracts','apps/site','apps/portal/src/domain','apps/portal/src/application','apps/portal/src/infrastructure','apps/portal/src/presentation/auth','apps/portal/src/main.tsx','package-lock.json'],{encoding:'utf8'}).trim();if(protectedChanges)throw Error('Protected files changed: '+protectedChanges);
 if(!process.argv.includes('--report-only')){
  const baseline=process.env.FISIOFIT_V22_BASELINE_ROOT??'/private/tmp/fisiofit-ui-ux-v2.1-20261015';
  if(execFileSync('git',['-C',baseline,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==base)throw Error('Baseline must be exact V2.1');
  run('typecheck','npm',['run','typecheck']);run('lint','npm',['run','lint']);run('design-system-lint','npm',['exec','eslint','packages/design-system/src']);run('build','npm',['run','build']);run('tests','npm',['test']);
  run('visual-before','node',['scripts/ui-v22/browser.mjs','before'],{FISIOFIT_UI_ROOT:baseline});run('visual-after','node',['scripts/ui-v22/browser.mjs','after']);
  if(process.argv.includes('--operational')){
   run('operational-before','node',[resolve('scripts/homologate-stabilization.mjs'),'--http-only'],{FISIOFIT_TEST_UI_ROOT:baseline,FISIOFIT_TEST_API_ROOT:baseline,FISIOFIT_TEST_OUTPUT:resolve(evidence,'operational/before'),FISIOFIT_TEST_CALENDAR:'0'});
   run('operational-after','node',['scripts/homologate-stabilization.mjs','--http-only'],{FISIOFIT_TEST_OUTPUT:resolve(evidence,'operational/after'),FISIOFIT_TEST_CALENDAR:'1'});
  }
 }
 run('gallery','node',['scripts/ui-v22/report.mjs']);run('diff-check','git',['diff','--check']);
}catch(error){console.error(String(error));process.exitCode=1;}
