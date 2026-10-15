// One local entry point. No deploy, remote SQL, real accounts or Vault writes.
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {sourceDigest} from './ui-v2/source-digest.mjs';
const baseline='8e9adda7f9b0198ae181add88fd1548d970750c9';
const cwd=process.cwd(),evidence=resolve('docs/ui-ux-v2/evidence'),temp=resolve(tmpdir(),`fisiofit-ui-v2-homologation-${process.pid}`);
mkdirSync(temp,{recursive:true});mkdirSync(evidence,{recursive:true});
const checks=[];
function run(name,command,args,env={}){const r=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,...env},maxBuffer:40e6});writeFileSync(resolve(temp,name+'.log'),(r.stdout??'')+(r.stderr??''));checks.push({name,passed:r.status===0,log:resolve(temp,name+'.log')});console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`);if(r.status!==0)throw Error(`${name} failed; see ${resolve(temp,name+'.log')}`);}
try{
 const changed=execFileSync('git',['diff',baseline,'--name-only','--','supabase','packages/contracts','apps/portal/src/application','apps/portal/src/domain','apps/portal/src/infrastructure','apps/site'],{encoding:'utf8'}).trim().split('\n').filter(path=>path&&!path.startsWith('supabase/tests/')).join('\n');
 if(changed)throw Error('Protected backend/domain/site paths changed: '+changed);
 checks.push({name:'protected-contracts-and-backend-unchanged',passed:true});
 if(!process.argv.includes('--visual-only')){
  run('typecheck','npm',['run','typecheck']);run('lint','npm',['run','lint']);run('design-system-lint','npm',['exec','eslint','packages/design-system/src']);run('build','npm',['run','build']);run('unit-contracts','npm',['test']);
 }
 if(!process.argv.includes('--no-baseline')){
  const base=resolve(temp,'baseline');mkdirSync(base,{recursive:true});const archive=execFileSync('git',['archive',baseline],{maxBuffer:50e6});const extracted=spawnSync('tar',['-x','-C',base],{input:archive});if(extracted.status!==0)throw Error('Baseline archive failed');const install=spawnSync('npm',['ci','--ignore-scripts'],{cwd:base,encoding:'utf8',maxBuffer:10e6});writeFileSync(resolve(temp,'baseline-install.log'),(install.stdout??'')+(install.stderr??''));if(install.status!==0)throw Error('Baseline dependency install failed; see '+resolve(temp,'baseline-install.log'));
  run('visual-before','node',['scripts/ui-v2/browser.mjs','before'],{FISIOFIT_UI_ROOT:base});
 }
 if(process.argv.includes('--reuse-visual')){const prior=JSON.parse(readFileSync(resolve(evidence,'after/result.json'),'utf8'));if(prior.sourceDigest!==sourceDigest()||prior.checks.some(c=>!c.passed))throw Error('Visual evidence is stale or failed; run without --reuse-visual');checks.push({name:'visual-after-exact-source-evidence-reused',passed:true,digest:prior.sourceDigest,checks:prior.checks.length,frames:prior.shots.length});}else run('visual-after','node',['scripts/ui-v2/browser.mjs','after']);
 if(!process.argv.includes('--visual-only')&&!process.argv.includes('--no-operational')){
  const output=resolve(temp,'operational');run('operational','node',['scripts/homologate-stabilization.mjs'],{FISIOFIT_TEST_OUTPUT:output,DENO_BIN:resolve('scripts/ui-v2/deno.sh'),DENO_DIR:process.env.DENO_DIR??'/private/tmp/fisiofit-hotfix-deno-final-20261014'});
  mkdirSync(resolve(evidence,'operational'),{recursive:true});for(const file of ['summary.json','browser-result.json','http-result.json'])writeFileSync(resolve(evidence,'operational',file),readFileSync(resolve(output,file)));
 }
 run('evidence-index','node',['scripts/ui-v2/report.mjs']);run('diff-check','git',['diff','--check']);
 writeFileSync(resolve(evidence,'homologation.json'),JSON.stringify({passed:true,baseline,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks,synthetic:true},null,2)+'\n');
 console.log('UI V2 homologation PASS. Open docs/ui-ux-v2/REVIEW.html.');
}catch(error){writeFileSync(resolve(temp,'failure.json'),JSON.stringify({error:String(error),checks},null,2));console.error(String(error));process.exitCode=1;}finally{rmSync(resolve(temp,'baseline'),{recursive:true,force:true});}
