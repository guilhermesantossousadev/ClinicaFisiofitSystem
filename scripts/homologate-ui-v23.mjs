// Review artifact generator and local quality checks. Does not deploy or synchronize memory.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sourceDigest} from './ui-v2/source-digest.mjs';
const base='f256de6369f98567fabaf9139658c6de8e4af517';
const evidence=resolve('docs/ui-ux-v2.3/evidence');mkdirSync(evidence,{recursive:true});
const qualityPath=resolve(evidence,'quality.json');
if(process.argv.includes('--graph')) {
  const result=spawnSync('graphify',['update','.'],{encoding:'utf8',maxBuffer:20e6});
  writeFileSync(resolve(evidence,'graphify-update.log'),(result.stdout??'')+(result.stderr??''));
  console.log('graphify: '+(result.status===0?'PASS':'FAIL'));if(result.status!==0)process.exitCode=1;
}
if(process.argv.includes('--checks')) {
  const checks=[];
  for(const [name,args] of [['typecheck',['run','typecheck']],['lint',['run','lint']],['build',['run','build']],['vitest-and-node',['test']]]) {
    const result=spawnSync('npm',args,{encoding:'utf8',maxBuffer:50e6});
    writeFileSync(resolve(evidence,name+'.log'),((result.stdout??'')+(result.stderr??'')).trimEnd()+'\n');
    checks.push({name,passed:result.status===0});console.log(name+': '+(result.status===0?'PASS':'FAIL'));
  }
  writeFileSync(qualityPath,JSON.stringify({sourceDigest:sourceDigest(),checks},null,2)+'\n');
  if(checks.some(check=>!check.passed))process.exitCode=1;
}
if(process.argv.includes('--report')) {
  const read=path=>existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
  const before=read(resolve(evidence,'before/result.json')),after=read(resolve(evidence,'after/result.json')),quality=read(qualityPath);
  const operationalRoot=resolve(process.env.FISIOFIT_TEST_OUTPUT??'/private/tmp/fisiofit-ui-v23-operational-validated-20261016');
  const operational=read(resolve(operationalRoot,'summary.json'));
  mkdirSync(resolve(evidence,'operational'),{recursive:true});
  for(const name of ['summary.json','http-result.json','http-core-result.json','browser-result.json','auth-transport.json','environment.json','patient_returning_rls.test.sql.log','operational_stabilization.test.sql.log','financial_plans_release.test.sql.log'])if(existsSync(resolve(operationalRoot,name)))copyFileSync(resolve(operationalRoot,name),resolve(evidence,'operational',name));
  const operationalShots={before:[],after:[]};
  for(const [phase,root] of [['before','/private/tmp/fisiofit-ui-v23-operational-baseline-20261016'],['after',operationalRoot]]) {
    mkdirSync(resolve(evidence,'operational',phase),{recursive:true});
    for(const name of ['summary.json','http-result.json','browser-result.json','environment.json'])if(existsSync(resolve(root,name)))copyFileSync(resolve(root,name),resolve(evidence,'operational',phase,name));
    for(const name of ['browser-dashboard','browser-attendance','browser-records','browser-mobile-essential','browser-finance','browser-finance-paid'])if(existsSync(resolve(root,name+'.png'))){copyFileSync(resolve(root,name+'.png'),resolve(evidence,'operational',phase,name+'.png'));operationalShots[phase].push({name:'authenticated-'+name,width:name.includes('mobile')?390:1440,path:`operational/${phase}/${name}.png`});}
  }
  for(const [name,root] of [['shared-auth','/private/tmp/fisiofit-ui-v23-operational-20261016'],['shared-auth-retry','/private/tmp/fisiofit-ui-v23-operational-retry-20261016'],['isolated-auth-earlier','/private/tmp/fisiofit-ui-v23-operational-isolated-20261016'],['isolated-auth-timeout','/private/tmp/fisiofit-ui-v23-operational-final-20261016']]){
    mkdirSync(resolve(evidence,'attempts',name),{recursive:true});for(const file of ['summary.json','browser-result.json','auth-transport.json','http-core-result.json'])if(existsSync(resolve(root,file)))copyFileSync(resolve(root,file),resolve(evidence,'attempts',name,file));
  }
  const protectedPaths=['supabase','packages/contracts','apps/site','apps/portal/src/application','apps/portal/src/domain','apps/portal/src/infrastructure','apps/portal/src/presentation/auth','apps/portal/src/main.tsx','package-lock.json'];
  const protectedChanges=execFileSync('git',['diff',base,'--name-only','--',...protectedPaths],{encoding:'utf8'}).trim();
  const digest=sourceDigest();
  const gates={exactBase:execFileSync('git',['merge-base','HEAD',base],{encoding:'utf8'}).trim()===base,protectedPathsUnchanged:!protectedChanges,quality:quality?.sourceDigest===digest&&quality.checks.every(check=>check.passed),baseline:Boolean(before&&before.shots.length>=118&&before.checks.every(check=>check.passed)),visual:after?.sourceDigest===digest&&after.shots.length>=200&&after.checks.every(check=>check.passed),operational:Boolean(operational?.passed)};
  const status=Object.values(gates).every(Boolean)?'READY_FOR_REVIEW':'BLOCKED';
  const summary={status,base,sourceDigest:digest,gates,visualShots:{before:before?.shots.length??0,after:after?.shots.length??0},authenticatedShots:{before:operationalShots.before.length,after:operationalShots.after.length},visualChecks:after?.checks.length??0,operational:operational?.results??[],published:false,synthetic:true,vaultWrite:'Deferred by explicit user instruction; local handoff only'};
  writeFileSync(resolve(evidence,'acceptance.json'),JSON.stringify(summary,null,2)+'\n');
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const beforeShots=[...(before?.shots??[]),...operationalShots.before],afterShots=[...(after?.shots??[]),...operationalShots.after];
  const names=[...new Set([...beforeShots.map(shot=>shot.name),...afterShots.map(shot=>shot.name)])];
  const pairs=names.map(name=>({name,before:beforeShots.find(shot=>shot.name===name),after:afterShots.find(shot=>shot.name===name)}));
  const rows=pairs.map(pair=>`<article class="comparison" data-name="${escape(pair.name)}" data-width="${pair.after?.width??pair.before?.width}"><h2>${escape(pair.name)}</h2><div class="pair">${['before','after'].map(phase=>`<figure><figcaption>${phase==='before'?'V2.2 publicada · frontend do SHA exato, sintético':'V2.3 candidata'}</figcaption>${pair[phase]?`<a href="evidence/${escape(pair[phase].path)}" target="_blank"><img loading="lazy" src="evidence/${escape(pair[phase].path)}" alt="${escape(pair.name)} — ${phase==='before'?'V2.2':'V2.3'}" /></a>`:'<p>Nova superfície contextual da V2.3; sem equivalente isolado nesta base.</p>'}</figure>`).join('')}</div></article>`).join('');
  writeFileSync(resolve('docs/ui-ux-v2.3/REVIEW.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fisiofit V2.3 — revisão comparativa</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#193448;font:15px/1.6 system-ui}header{padding:36px;max-width:1300px;margin:auto}h1{font-size:30px;margin:0}p{max-width:1000px}code{overflow-wrap:anywhere}nav{position:sticky;top:0;background:white;border-block:1px solid #d7e2ec;padding:14px 36px;display:flex;flex-wrap:wrap;gap:18px;z-index:2}input,select{font:inherit;padding:10px;border:1px solid #8096aa;border-radius:6px}label{display:grid;gap:4px}main{padding:24px;max-width:1800px;margin:auto}.comparison{background:white;border:1px solid #d7e2ec;border-radius:12px;padding:22px;margin-bottom:24px;content-visibility:auto;contain-intrinsic-size:auto 600px}.comparison[hidden]{display:none}.comparison h2{font-size:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;min-width:0}figcaption{font-weight:600;padding:10px 0}img{width:100%;border:1px solid #d7e2ec;border-radius:6px}a{color:#156b9b}.status{font-weight:700}details{padding:16px;background:white;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:800px){.pair{grid-template-columns:1fr}header,main,nav{padding:18px}}</style><header><p>FISIOFIT · UI/UX V2.3</p><h1>Revisão visual dos módulos</h1><p class="status">${status}</p><p>Base exata: <code>${base}</code>. A coluna V2.2 é uma renderização local do frontend publicado com dados sintéticos, e não uma captura autenticada da produção. A coluna V2.3 mostra a implementação candidata no mesmo ambiente de fixtures. Os estudos conceituais do ZIP não compõem esta evidência.</p><p>${summary.visualShots.before} capturas da base · ${summary.visualShots.after} da candidata · 1440, 1280, 768 e 390px. Clique em uma imagem para inspecionar a captura original. Novas superfícies aparecem somente na coluna V2.3. As telas authenticated-* usam backend real local e contas sintéticas, com Auth/RLS/Storage, em vez de respostas simuladas.</p><p><a href="RELEASE.md">Relatório de entrega</a> · <a href="REFERENCE_TRACEABILITY.md">Referências e compatibilidade</a> · <a href="evidence/acceptance.json">Critérios e testes</a></p><details><summary>Resultado dos critérios</summary><pre>${escape(JSON.stringify(gates,null,2))}</pre></details></header><nav aria-label="Filtrar galeria"><label>Buscar tela<input id="query" type="search" placeholder="paciente, finance, clinical…"></label><label>Largura<select id="width"><option value="1440">Desktop 1440px</option><option value="1280">Desktop 1280px</option><option value="768">Tablet 768px</option><option value="390">Celular 390px</option><option value="all">Todas</option></select></label><p id="count" role="status"></p></nav><main>${rows}</main><script>const query=document.getElementById('query'),width=document.getElementById('width');function filter(){let count=0;for(const article of document.querySelectorAll('.comparison')){article.hidden=!(article.dataset.name.includes(query.value.toLowerCase())&&(width.value==='all'||article.dataset.width===width.value));if(!article.hidden)count++}document.getElementById('count').textContent=count+' telas'}query.addEventListener('input',filter);width.addEventListener('change',filter);filter();</script></html>`);
  console.log(status+'; gallery: docs/ui-ux-v2.3/REVIEW.html');
}
