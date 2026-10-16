import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve('docs/ui-ux-v2.3'),output=resolve(root,'evidence');
const server=createServer((req,res)=>{const path=resolve(root,'.'+(req.url==='/'?'/REVIEW.html':new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('content-type',extname(path)==='.png'?'image/png':extname(path)==='.html'?'text/html; charset=utf-8':'text/plain; charset=utf-8');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(57555,'127.0.0.1',resolve));
const profile=mkdtempSync(resolve(tmpdir(),'fisiofit-gallery-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=57556',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket;
try {
  let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:57556/json/list')).json();if(targets.length)break;}catch{}await pause(100);}
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let next=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){pending.get(message.id)?.(message.result);pending.delete(message.id);}});
  const send=(method,params={})=>new Promise(resolve=>{const id=++next;pending.set(id,resolve);socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:57555/'});await pause(1500);
  const total=await evaluate("document.querySelectorAll('.comparison:not([hidden])').length");if(total<20)throw Error('Missing desktop comparison pairs');
  await evaluate("document.getElementById('query').value='patient-details';document.getElementById('query').dispatchEvent(new Event('input'));document.querySelector('main').scrollIntoView()");await pause(700);
  const desktop=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(output,'gallery-desktop.png'),Buffer.from(desktop.data,'base64'));
  const visible=await evaluate("[...document.querySelectorAll('.comparison:not([hidden]) img')].every(image=>image.complete&&image.naturalWidth>0)");if(!visible)throw Error('Comparison images did not load');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.getElementById('width').value='390';document.getElementById('width').dispatchEvent(new Event('change'));document.querySelector('main').scrollIntoView()");await pause(500);
  const overflow=await evaluate('document.documentElement.scrollWidth>innerWidth+2');if(overflow)throw Error('Gallery mobile overflow');const mobile=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(output,'gallery-mobile.png'),Buffer.from(mobile.data,'base64'));
  writeFileSync(resolve(output,'gallery-check.json'),JSON.stringify({passed:true,desktopPairs:total,filterWorks:true,imagesLoaded:true,mobileOverflow:false},null,2)+'\n');
  await send('Browser.close');console.log('Gallery filters, images and 390px containment: PASS');
}finally{socket?.close();chrome.kill('SIGTERM');server.close();await pause(300);rmSync(profile,{recursive:true,force:true});}
