const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {mkdtemp,rm}=require('node:fs/promises');
const os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'class-timer-'));
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18532',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let browser;
 try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',args:['--no-sandbox']});
 for(const lang of ['uk','en'])for(const theme of ['dark','light'])for(const width of [375,1280]){
 const c=await browser.newContext({viewport:{width,height:900}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const p=await c.newPage();await p.goto('http://127.0.0.1:18532/classroom');
 const grid=p.getByTestId('landing-team-grid');await grid.waitFor();
 await p.waitForFunction(()=>[...document.querySelectorAll('[data-testid="landing-team-grid"] img')].length===3&&[...document.querySelectorAll('[data-testid="landing-team-grid"] img')].every(i=>i.naturalWidth>0));
 if(width===1280){const ys=await grid.locator('img').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));assert.ok(Math.max(...ys)-Math.min(...ys)<2);}
 assert.equal(await p.getByTestId('lobby-timer-selector').count(),0);
 assert.ok(!/\d+ (хв|min)/.test(await grid.locator('.card-top-meta-time').first().textContent()));
 await grid.locator('a').first().click();
 await p.getByTestId('classroom-timer').waitFor();
 await p.getByRole('button',{name:lang==='en'?'10 min (Operational time pressure)':'10 хв (Службовий тиск часу)',exact:true}).click();
 const code=await p.evaluate(()=>location.pathname.split('/').pop());
 const student=await c.newPage();await student.goto('http://127.0.0.1:18532/classroom/join/'+code);
 await student.getByTestId('classroom-timer').waitFor();
 assert.equal(await student.getByTestId('classroom-clock').count(),0);
 // The protocol action exercises the same authenticated host command as the UI.
 await p.evaluate(code=>new Promise(resolve=>{const ws=new WebSocket(`ws://${location.host}/ws`);ws.onopen=()=>ws.send(JSON.stringify({type:'JOIN_ROOM',roomCode:code,hostSecret:sessionStorage.getItem('room-host-'+code)}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.room?.phase==='briefing')ws.send(JSON.stringify({type:'OPEN_VOTING',hostSecret:sessionStorage.getItem('room-host-'+code)}));if(m.room?.phase==='voting'){ws.close();resolve();}};}),code);
 await p.getByTestId('classroom-clock').waitFor();await student.getByTestId('classroom-clock').waitFor();
 assert.match(await student.getByTestId('classroom-clock').textContent(),/^(10:00|09:5\d)$/);
 assert.equal(await student.getByRole('tab').count(),0);
 await student.locator('button.action.w-full').filter({has:student.locator('span.badge')}).first().click();
 await p.evaluate(code=>new Promise(resolve=>{const ws=new WebSocket(`ws://${location.host}/ws`);ws.onopen=()=>ws.send(JSON.stringify({type:'JOIN_ROOM',roomCode:code,hostSecret:sessionStorage.getItem('room-host-'+code)}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.room?.phase==='voting')ws.send(JSON.stringify({type:'SHOW_RESULTS',hostSecret:sessionStorage.getItem('room-host-'+code)}));if(m.room?.phase==='results'){ws.close();resolve();}};}),code);
 await student.getByRole('tab').first().waitFor();
 assert.equal(await student.getByRole('tab').count(),4);
 await student.getByRole('tab').nth(2).click();
 assert.equal(await student.getByRole('tab').nth(2).getAttribute('aria-selected'),'true');
 assert.equal(await p.getByRole('tab').first().getAttribute('aria-selected'),'true');
 console.log('PASS classroom images and synchronized timer',lang,theme,width);await c.close();
 }
 }finally{await browser?.close();server.kill();await rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
