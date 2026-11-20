const {chromium}=require('playwright'),WebSocket=require('ws');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'unified-experience-'));
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18575',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let browser;const sockets=[];
 const connect=async()=>{const ws=new WebSocket('ws://127.0.0.1:18575/ws');sockets.push(ws);await new Promise(r=>ws.once('open',r));return ws;};
 const action=(ws,data,condition=m=>!!m.room)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.off('message',listen);reject(Error('WS timeout'));},5000);const listen=raw=>{const m=JSON.parse(raw);if(condition(m)){clearTimeout(timeout);ws.off('message',listen);resolve(m);}};ws.on('message',listen);ws.send(JSON.stringify(data));});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const lang of ['uk','en'])for(const theme of ['dark','light'])for(const width of [375,1280]){
 const c=await browser.newContext({viewport:{width,height:900}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const p=await c.newPage(),base='http://127.0.0.1:18575';
 await p.goto(base+'/scenarios/S02/play');await p.getByTestId('stepper').waitFor();
 const breadcrumb=p.locator('#breadcrumbs [aria-current="page"]');assert.match(await breadcrumb.textContent(),lang==='uk'?/ЗАДАЧА 2: Недоторканний кандидат/:/CASE 2: The Untouchable Candidate/);
 await p.waitForFunction(expected=>getComputedStyle(document.querySelector('.breadcrumb-current')).color===expected,theme==='light'?'rgb(143, 109, 36)':'rgb(200, 164, 86)');
 assert.equal(await p.locator('.stage-badge-row').count(),0);assert.equal(await p.locator('.dossier [data-testid="stepper"]').count(),1);
 assert.equal(await p.locator('.cids-action-row button').count(),1);
 assert.equal(await p.locator('.solo-shell h2').first().evaluate(e=>getComputedStyle(e).textAlign),'center');
 await p.goto(base+'/classroom/host/new?scenario=S02');await p.getByTestId('lobby-timer-selector').waitFor();
 await p.getByRole('button',{name:lang==='uk'?'10 хв (Службовий тиск часу)':'10 min (Operational time pressure)',exact:true}).click();
 const code=await p.evaluate(()=>location.pathname.split('/').pop()),secret=await p.evaluate(code=>sessionStorage.getItem('room-host-'+code),code);
 const host=await connect();let state=(await action(host,{type:'JOIN_ROOM',roomCode:code,hostSecret:secret})).room;
 const voters=[];for(let i=0;i<3;i++){const guest=await connect();await action(guest,{type:'JOIN_ROOM',roomCode:code,clientVoteToken:String(i).repeat(32)});voters.push(guest);}
 const phone=await c.newPage();await phone.goto(base+'/classroom/join/'+code);await phone.getByTestId('classroom-timer').waitFor();
 state=(await action(host,{type:'OPEN_VOTING',hostSecret:secret},m=>m.room?.phase==='voting')).room;
 for(const page of [p,phone]){await page.locator('.unified-tracker').waitFor();assert.equal(await page.locator('.unified-tracker .tracker-axes > div').count(),3);assert.equal(await page.locator('.cids-action-row button').count(),1);assert.equal(await page.locator('.dossier [data-testid="stepper"]').count(),1);assert.equal(await page.locator('.stage-badge-row').count(),0);assert.equal(await page.locator('.host-connection').count(),0);await page.waitForFunction(expected=>getComputedStyle(document.querySelector('.tracker-clock')).color===expected,theme==='light'?'rgb(29, 105, 130)':'rgb(124, 200, 224)');}
 if(width===1280){
 await p.getByRole('button',{name:require('../src/i18n/group.json')[lang].projector,exact:true}).click();
 const projector=await p.locator('.projector-session').boundingBox();assert.ok(projector.width>=1200);
 assert.equal(await p.locator('.unified-tracker .tracker-clock').evaluate(e=>getComputedStyle(e).fontSize),'36px');
 await p.keyboard.press('Escape');
 }
 for(let stage=0;stage<8;stage++){
 const node=state.scenario.vuzly.find(n=>n.id===state.currentNodeId);
 if(stage===0)for(let i=0;i<3;i++)await action(voters[i],{type:'SUBMIT_VOTE',variantId:node.varianty[width===1280&&i===2?1:0].id});
 if(stage===7){await p.waitForFunction(()=>{const container=document.querySelector('[data-testid="stepper"]'),active=container?.querySelector('.is-current');if(!container||!active)return false;const a=active.getBoundingClientRect(),c=container.getBoundingClientRect();return active.textContent.startsWith('8 ·')&&a.right<=c.right+1&&a.left>=c.left-1;});const before=await p.evaluate(()=>scrollY);await p.getByTestId('stepper').evaluate(e=>e.scrollTo({left:0,behavior:'instant'}));assert.equal(await p.evaluate(()=>scrollY),before);}
 if(stage===3){await p.locator('.progress-chip.is-current .quoted-stage-fragment').waitFor();await p.waitForFunction(()=>document.querySelector('.progress-chip.is-current')?.textContent.startsWith('4 ·'));const label=await p.locator('.progress-chip.is-current').textContent();assert.ok(label.includes((lang==='en'?require('../src/i18n/scenarios.en.json').S02.vuzly.find(n=>n.id===node.id):node).tekst.split('\n')[0].replace(/^.*?·\s*/,'')));assert.deepEqual(await p.getByTestId('stepper').locator('li').allTextContents().then(a=>a.slice(0,3)),['1','2','3']);}
 await p.waitForFunction(stage=>{const chip=document.querySelector('.progress-chip.is-current'),question=document.querySelector('[data-testid="stage-question"]');return chip?.textContent.startsWith(stage+' ·')&&question&&getComputedStyle(question).textAlign==='center';},stage+1);
 const primary=p.locator('.group-play-layout button.action-primary').first();if(await primary.count()){const geometry=await primary.evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.parentElement,css=getComputedStyle(parent);return Math.abs(r.width-(parent.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)));});assert.ok(geometry<2);}
 state=(await action(host,{type:'SHOW_RESULTS',hostSecret:secret},m=>m.room?.phase==='results')).room;
 await action(host,{type:'DISCUSS',variantId:node.varianty[0].id,hostSecret:secret},m=>m.room?.phase==='feedback');
 state=(await action(host,{type:'NEXT_STAGE',hostSecret:secret},m=>m.room?.phase==='voting'||m.room?.phase==='finished')).room;
 }
 await p.getByTestId('path-stage').first().waitFor();assert.equal(await p.getByTestId('path-stage').count(),8);assert.equal(await p.getByTestId('selected-curve').count(),7);
 const leftEdges=await p.locator('.diagram-stage-title').evaluateAll(es=>es.map(e=>{const label=e.previousElementSibling;return {align:getComputedStyle(e).textAlign,delta:Math.abs(e.getBoundingClientRect().left-label.getBoundingClientRect().left),quotes:[...e.querySelectorAll('.quoted-stage-fragment')].map(q=>Math.abs(q.getBoundingClientRect().left-label.getBoundingClientRect().left))};}));leftEdges.forEach(e=>{assert.equal(e.align,'left');assert.ok(e.delta<=2);e.quotes.forEach(delta=>assert.ok(delta<=2));});
 const quoteLayout=await p.locator('.diagram-stage-title .quoted-stage-fragment').evaluateAll(es=>es.map(e=>{const c=document.createElement('canvas').getContext('2d');c.font=getComputedStyle(e).font;const range=document.createRange();range.selectNodeContents(e);return {natural:c.measureText(e.textContent).width,available:e.parentElement.clientWidth,lines:range.getClientRects().length,bottom:e.getBoundingClientRect().bottom,option:e.closest('[data-testid="path-stage"]').querySelector('[data-testid="path-option"] rect').getBoundingClientRect().top};}));
 assert.ok(quoteLayout.length>0);quoteLayout.forEach(q=>{if(q.natural<=q.available)assert.equal(q.lines,1);assert.ok(q.bottom<=q.option);});
 const percentages=await p.getByTestId('vote-percentage').allTextContents();assert.deepEqual(percentages,width===1280?['67%','33%']:['100%']);
 if(width===1280){const alt=p.getByTestId('path-option').filter({has:p.getByTestId('vote-percentage').filter({hasText:'33%'})});assert.equal(await alt.locator('rect').first().getAttribute('stroke'),'#6BAEC4');}else assert.ok((await p.locator('main').innerText()).includes(lang==='uk'?'Недостатньо голосів':'Not enough votes'));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS unified tracker, inline full-title stepper, golden breadcrumbs and group graph',lang,theme,width);
 await action(host,{type:'CLOSE_SESSION',hostSecret:secret},m=>m.type==='SESSION_CLOSED');await c.close();
 }
 }finally{for(const ws of sockets)ws.terminate();await browser?.close();server.kill();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
