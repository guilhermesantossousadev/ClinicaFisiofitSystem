// Native headless Chrome, temporary profile, real React UI and isolated API.
// No browser library downloads, production session or existing Chrome profile.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
export async function browserAcceptance({proxyOrigin,anonKey,account,financeAccount,output,children,sql,fixture}) {
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const origin='http://127.0.0.1:57435', debug='http://127.0.0.1:57433';
 // A previous server must never be mistaken for this candidate.
 for(const port of [57435,57433])await new Promise((ok,fail)=>{const probe=createServer();probe.once('error',()=>fail(new Error(`Operational browser port ${port} is already in use`)));probe.listen(port,'127.0.0.1',()=>probe.close(ok));});
 const profile=resolve(output,'temporary-chrome-profile');mkdirSync(profile,{recursive:true});
 const uiRoot=resolve(process.env.FISIOFIT_TEST_UI_ROOT??process.cwd());
 const vite=spawn(process.execPath,[resolve(uiRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','57435','--strictPort'],{cwd:resolve(uiRoot,'apps/portal'),env:{...process.env,VITE_SUPABASE_URL:proxyOrigin,VITE_SUPABASE_ANON_KEY:anonKey},stdio:['ignore','pipe','pipe']});children.push(vite);
 const viteLog=createWriteStream(resolve(output,'browser-vite.log'));vite.stdout.pipe(viteLog);vite.stderr.pipe(viteLog);
 const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=57433',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','ignore']});children.push(chrome);
 let socket;const checks=[],network=[];
 try {
  let targets;
  for(let n=0;n<300;n++){if(vite.exitCode!==null)throw new Error('Candidate UI server exited; inspect browser-vite.log');try{targets=await(await fetch(debug+'/json/list')).json();if(targets.some(t=>t.type==='page')&&(await fetch(origin+'/sistema/')).ok)break;}catch{}await pause(100);}
  if(!targets?.some(t=>t.type==='page'))throw new Error('Native Chrome did not start');
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Network.responseReceived'&&m.params.response.url.includes('/functions/v1/'))network.push({path:new URL(m.params.response.url).pathname,status:m.params.response.status});});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Browser DOM evaluation failed: '+(r.exceptionDetails.exception?.description??r.exceptionDetails.text));return r.result?.value;};
  const wait=async(expression,label)=>{for(let n=0;n<300;n++){if(await evaluate(expression))return;await pause(100);}const snapshot=await evaluate(`({picker:document.querySelector('.record-selector')?.innerText,value:document.querySelector('.record-selector input[role=combobox]')?.value,expanded:document.querySelector('.record-selector input[role=combobox]')?.getAttribute('aria-expanded'),busy:document.querySelector('.record-selector input[role=combobox]')?.getAttribute('aria-busy'),focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id,type:document.activeElement?.getAttribute('type')},options:[...document.querySelectorAll('.record-selector [role=option]')].map(e=>e.innerText)})`);writeFileSync(resolve(output,'browser-timeout.json'),JSON.stringify({label,snapshot,network},null,2)+'\n');const frame=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(resolve(output,'browser-timeout.png'),Buffer.from(frame.data,'base64'));throw new Error('Browser assertion timed out: '+label);};
  const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
  const clickText=(text,selector='button')=>evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.querySelector('.nav-item-label')?.textContent===${JSON.stringify(text)}||e.querySelector('strong')?.textContent===${JSON.stringify(text)});if(!e)throw Error('Missing control');e.click();})()`);
  const shot=async(name)=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(resolve(output,name+'.png'),Buffer.from(result.data,'base64'));};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  if(process.env.FISIOFIT_TEST_CPU_RATE)await send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.FISIOFIT_TEST_CPU_RATE)});
  await send('Page.navigate',{url:origin+'/sistema/'});
  await wait("Boolean(document.querySelector('input[type=email]'))",'login form');
  await fill('input[type=email]',account.email);await fill('input[type=password]',account.password);await clickText('Entrar com segurança');
  await wait("Boolean(document.querySelector('.workspace'))",'authenticated portal');checks.push('Real synthetic Auth login');
  await fill('select[aria-label="Selecionar unidade ativa"]',fixture.unit);
  await wait("document.body.innerText.includes('Synthetic operating class')",'Class lesson on dashboard');checks.push('Dashboard shows persisted Class lesson');await shot('browser-dashboard');
  // Search after the first 100 patients through the rendered global search.
  await fill('.global-search input','Synthetic search 110');
  await wait("document.querySelector('.global-search') && document.body.innerText.includes('Synthetic search 110')",'global search after first 100');checks.push('Search reaches patient 110 through server');await fill('.global-search input','');
  await clickText('Chamada diária','.nav-item');
  await wait("Boolean(document.querySelector('.daily-attendance'))",'daily attendance');
  await wait("document.querySelector('.daily-attendance select')?.options.length>1",'daily units');
  const selects=await evaluate("[...document.querySelectorAll('.attendance-filter-grid select')].map(e=>e.id)");
  await fill('[id='+JSON.stringify(selects[0])+']',fixture.unit);
  await wait("document.querySelectorAll('.attendance-filter-grid select')[1]?.options.length>1",'daily occurrence choices');
  const slot=await evaluate("document.querySelectorAll('.attendance-filter-grid select')[1].options[1].value");
  await fill('[id='+JSON.stringify(selects[1])+']',slot);
  await wait("document.body.innerText.includes('Synthetic Gamma')",'correct occurrence roster');
  await evaluate("(()=>{const row=[...document.querySelectorAll('.attendance-row')].find(e=>e.innerText.includes('Synthetic Gamma'));[...row.querySelectorAll('button')].find(b=>b.innerText==='Veio').click();})()");
  await wait("[...document.querySelectorAll('.attendance-row')].some(e=>e.innerText.includes('Synthetic Gamma')&&e.innerText.includes('Presente'))",'attendance saved and visually updated');
  if(sql(`select count(*)from public.attendances a join public.occurrence_participants p on p.id=a.occurrence_participant_id where p.patient_id='fc000000-0000-4000-8000-000000000032' and a.status='PRESENT'`)!=='1')throw new Error('Rendered attendance did not persist in database');
  checks.push('UI attendance click updates database and rendered state');await shot('browser-attendance');
  await clickText('Prontuários','.nav-item');
  await wait("Boolean(document.querySelector('.record-selector input[role=combobox]'))",'clinical patient search');
  const pick=async(name)=>{await fill('.record-selector input[role=combobox]',name);await wait(`Boolean([...document.querySelectorAll('.record-selector [role=option]')].find(e=>e.innerText.includes(${JSON.stringify(name)})))`,'clinical search result: '+name);await evaluate(`([...document.querySelectorAll('.record-selector [role=option]')].find(e=>e.innerText.includes(${JSON.stringify(name)}))).click()`);};
  await pick('Synthetic Alpha');await pick('Synthetic Beta');
  await wait("document.body.innerText.includes('SYNTHETIC_BETA_PRIVATE')",'selected patient data');await pause(1300);
  if(await evaluate("document.body.innerText.includes('SYNTHETIC_ALPHA_PRIVATE')"))throw new Error('Previous patient data leaked after switching');
  checks.push('Patient switch clears former clinical data and ignores delayed response');await shot('browser-records');
  await clickText('Novo registro');
  await wait("Boolean(document.querySelector('select[name=kind]'))",'new clinical draft');
  await fill('select[name=kind]','evolution');await fill('select[name=professional_id]',fixture.professionalB);await fill('select[name=unit_id]',fixture.unitB);
  await fill('textarea[name=text]','SYNTHETIC_UI_SAVED');await clickText('Salvar rascunho');
  await wait("document.querySelector('.records-list-table')?.innerText.includes('SYNTHETIC_UI_SAVED')",'clinical save displayed');
  if(sql(`select count(*)from public.clinical_records where patient_id='${fixture.patientB}' and payload->>'text'='SYNTHETIC_UI_SAVED'`)!=='1')throw new Error('Rendered clinical save did not persist');checks.push('Clinical form persists correct selected patient');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await shot('browser-mobile-essential');
  const overflow=await evaluate('document.documentElement.scrollWidth>window.innerWidth+3');if(overflow)throw new Error('Essential mobile viewport overflows horizontally');checks.push('Essential mobile viewport has no horizontal overflow');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('button[aria-label=Sair]').click()");await wait("Boolean(document.querySelector('input[type=email]'))",'logout');checks.push('Logout returns to login');
  if(financeAccount){
   await fill('input[type=email]',financeAccount.email);await fill('input[type=password]',financeAccount.password);await clickText('Entrar com segurança');await wait("Boolean(document.querySelector('.workspace'))",'finance login');
   await wait("document.querySelector('.current-view')?.innerText.includes('Matrículas')",'finance default module');
   await wait("document.body.innerText.includes('Synthetic Alpha')",'finance linked patient summary');
   if(await evaluate("document.querySelector('.sidebar')?.innerText.includes('Prontuários')||document.body.innerText.includes('SYNTHETIC_BETA_PRIVATE')"))throw new Error('Finance UI exposed clinical access');
   await wait("document.body.innerText.includes('Parcial')",'persisted partial payment shown');
   checks.push('Finance UI shows partial payment and enrollment summary without clinical routes');await shot('browser-finance');
   await fill('#payment-patient','Synthetic Alpha');
   await wait("Boolean(document.querySelector('#payment-registration [role=option]'))",'financial patient summary picker');
   await evaluate("document.querySelector('#payment-registration [role=option]').click()");
   await wait("document.querySelector('#payment-charge')?.options.length>1",'payable charge');
   const chargeId=await evaluate("document.querySelector('#payment-charge').options[1].value");
   await fill('#payment-charge',chargeId);await fill('#payment-method','cash');await clickText('Confirmar recebimento');
   await wait("document.body.innerText.includes('Pagamento registrado')",'receipt completion');
   if(sql(`select paid_cents from public.charges where id='${chargeId}'`)!=='22000'||sql(`select count(*)from public.payments where charge_id='${chargeId}' and reversed_at is null`)!=='2')throw new Error('Financial UI receipt did not persist exact partial plus final payments');
   checks.push('Finance chooses permitted patient summary and completes mixed-method balance through UI');await shot('browser-finance-paid');

  }
  const failed=network.filter(n=>n.status>=400);if(failed.length)throw new Error(`UI made ${failed.length} failed API requests`);
  writeFileSync(resolve(output,'browser-result.json'),JSON.stringify({passed:true,checks,apiResponses:network.length,failedApiResponses:failed.length},null,2)+'\n');console.log(`Native browser acceptance PASS (${checks.length} UI checks).`);
  await send('Browser.close').catch(()=>{});
 }catch(error){writeFileSync(resolve(output,'browser-result.json'),JSON.stringify({passed:false,checks,error:String(error),failedApiResponses:network.filter(n=>n.status>=400)},null,2)+'\n');throw error;
 }finally{socket?.close();chrome.kill('SIGTERM');vite.kill('SIGTERM');await pause(500);viteLog.end();rmSync(profile,{recursive:true,force:true});}
}
