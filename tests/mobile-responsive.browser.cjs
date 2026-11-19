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
 for(const lang of ['uk','en'])for(const theme of ['dark','light'])for(const width of [375,390,1280]){
 const c=await browser.newContext({viewport:{width,height:width===375?667:844}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const p=await c.newPage();await p.goto('http://127.0.0.1:18532/classroom');
 if(width<640){
 await p.locator('.mobile-nav-tabs').waitFor();
 await p.evaluate(()=>document.fonts.ready);
 const navLayout=await p.locator('.mobile-nav-tabs').evaluate(e=>({wrap:getComputedStyle(e).flexWrap,ys:[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect().y)}));
 await p.locator('.mobile-nav-tabs').evaluate(e=>{e.scrollLeft=e.scrollWidth;});
 await p.waitForFunction(()=>{const nav=document.querySelector('.mobile-nav-tabs'),active=nav.querySelector('[aria-current="page"]'),line=nav.querySelector('.nav-indicator');const a=active.getBoundingClientRect(),b=line.getBoundingClientRect();return Math.abs(a.left-b.left)<2&&Math.abs(a.width-b.width)<2;});
 await p.locator('.mobile-nav-tabs').evaluate(e=>{e.scrollLeft=0;});
 assert.equal(navLayout.wrap,'nowrap');assert.ok(Math.max(...navLayout.ys)-Math.min(...navLayout.ys)<2);
 assert.equal(await p.locator('.mobile-menu-trigger').count(),0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 const grid=p.getByTestId('landing-team-grid');await grid.waitFor();
 await p.waitForFunction(()=>[...document.querySelectorAll('[data-testid="landing-team-grid"] img')].length===3&&[...document.querySelectorAll('[data-testid="landing-team-grid"] img')].every(i=>i.naturalWidth>0));
 if(width===1280){const ys=await grid.locator('img').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));assert.ok(Math.max(...ys)-Math.min(...ys)<2);}
 assert.equal(await p.getByTestId('lobby-timer-selector').count(),0);
 assert.ok(!/\d+ (хв|min)/.test(await grid.locator('.card-top-meta-time').first().textContent()));
 await grid.locator('a').first().click();
 await p.getByTestId('lobby-timer-selector').waitFor();
 await p.getByRole('button',{name:lang==='en'?'10 min (Operational time pressure)':'10 хв (Службовий тиск часу)',exact:true}).click();
 await p.locator('.connection-top > img').waitFor();
 await p.evaluate(()=>document.fonts.ready);
 const geometry=await p.evaluate(()=>{const root=document.querySelector('.host-lobby').getBoundingClientRect();return {root:{x:root.x,w:root.width},items:[document.querySelector('.connection-top > img'),document.querySelector('[data-testid="lobby-start"]'),document.querySelector('.connection-copy')].map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2;})};});
 assert.ok(geometry.root.w<=896);
 const composition=await p.evaluate(()=>{const card=document.querySelector('.host-connection').getBoundingClientRect(),top=document.querySelector('.connection-top').getBoundingClientRect(),link=document.querySelector('.connection-copy').getBoundingClientRect();return {center:Math.abs(link.x+link.width/2-card.x-card.width/2),below:link.top>=top.bottom};});
 assert.ok(composition.center<2&&composition.below);
 if(width===375) geometry.items.forEach(x=>assert.ok(Math.abs(x-width/2)<2));
 await p.waitForFunction(expected=>getComputedStyle(document.querySelector('.lobby-timer-option[aria-pressed="true"]')).color===expected,theme==='light'?'rgb(143, 109, 36)':'rgb(200, 164, 86)');
 {
 await p.context().grantPermissions(['clipboard-read','clipboard-write']);
 const copy=p.locator('.connection-copy');await copy.click();
 await p.waitForFunction(()=>/Copied|Скопійовано/.test(document.querySelector('.connection-copy').textContent));
 assert.match(await copy.textContent(),/Copied|Скопійовано/);
 assert.match(await p.evaluate(()=>navigator.clipboard.readText()),/classroom\/join/);
 }
 const styleCheck=await p.evaluate(()=>{const options=document.querySelector('[data-testid="lobby-timer-options"]').getBoundingClientRect(),start=document.querySelector('[data-testid="lobby-start"]').getBoundingClientRect(),active=document.querySelector('.lobby-timer-option[aria-pressed="true"]'),css=getComputedStyle(active);return {left:Math.abs(options.left-start.left),right:Math.abs(options.right-start.right),color:css.color,border:css.borderTopColor,bg:css.backgroundColor};});
 assert.ok(styleCheck.left<1&&styleCheck.right<1);
 assert.equal(styleCheck.color,theme==='light'?'rgb(143, 109, 36)':'rgb(200, 164, 86)');
 assert.equal(styleCheck.border,styleCheck.color);
 assert.match(styleCheck.bg,/0\.1\)/);
 const clean=await p.locator('.connection-copy').evaluate(e=>({border:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));assert.equal(clean.border,'0px');assert.equal(clean.bg,'rgba(0, 0, 0, 0)');
 const poles=p.getByTestId('value-conflict').first();
 const valueLayout=await poles.locator('.value-poles').evaluate(e=>{const a=e.children[0].getBoundingClientRect(),b=e.children[2].getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2);});assert.ok(valueLayout<2);
 const code=await p.evaluate(()=>location.pathname.split('/').pop());
 const student=await c.newPage();await student.goto('http://127.0.0.1:18532/classroom/join/'+code);
 await student.getByTestId('classroom-timer').waitFor();
 assert.equal(await student.getByTestId('classroom-clock').count(),0);
 // The protocol action exercises the same authenticated host command as the UI.
 await p.evaluate(code=>new Promise(resolve=>{const ws=new WebSocket(`ws://${location.host}/ws`);ws.onopen=()=>ws.send(JSON.stringify({type:'JOIN_ROOM',roomCode:code,hostSecret:sessionStorage.getItem('room-host-'+code)}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.room?.phase==='briefing')ws.send(JSON.stringify({type:'OPEN_VOTING',hostSecret:sessionStorage.getItem('room-host-'+code)}));if(m.room?.phase==='voting'){ws.close();resolve();}};}),code);
 await p.getByTestId('classroom-clock').waitFor();
 assert.equal(await p.locator('.host-connection').count(),0);
 const stageBadge=await p.locator('.projector-session > header').textContent();assert.match(stageBadge,/1\s*\/\s*6/);
 const chain=p.getByTestId('stepper');await chain.waitFor();
 assert.ok((await chain.textContent()).length<80);
 const chainLayout=await chain.locator('li').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert.ok(Math.max(...chainLayout)-Math.min(...chainLayout)<2);
 const future=await chain.locator('li').last().locator('.progress-chip').evaluate(e=>({opacity:getComputedStyle(e).opacity,filter:getComputedStyle(e).filter}));
 assert.equal(future.opacity,'0.35');assert.match(future.filter,/blur/);
await student.getByTestId('classroom-clock').waitFor();
 assert.match(await student.getByTestId('classroom-clock').textContent(),/^(10:00|09:5\d)$/);
 for(const page of [p,student]){
 const centers=await page.evaluate(()=>{
 const center=e=>{const r=e.getBoundingClientRect();return r.left+r.width/2;};
 const badgeRow=document.querySelector('.room-status-badges');const badges=[...badgeRow.children];
 const rows=new Map();badges.forEach(b=>{const r=b.getBoundingClientRect(),key=Math.round(r.top);const list=rows.get(key)||[];list.push(r);rows.set(key,list);});
 return [...[...rows.values()].map(rs=>Math.abs((rs[0].left+rs.at(-1).right)/2-center(badgeRow))),...['.stage-badge-row','.cids-action-row'].map(selector=>{const row=document.querySelector(selector);return Math.abs(center(row)-center(row.firstElementChild));})];});
 centers.forEach(delta=>assert.ok(delta<2));
 }
 assert.equal(await student.getByRole('tab').count(),0);
 await student.locator('button.action.w-full').filter({has:student.locator('span.badge')}).first().click();
 await p.evaluate(code=>new Promise(resolve=>{const ws=new WebSocket(`ws://${location.host}/ws`);ws.onopen=()=>ws.send(JSON.stringify({type:'JOIN_ROOM',roomCode:code,hostSecret:sessionStorage.getItem('room-host-'+code)}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.room?.phase==='voting')ws.send(JSON.stringify({type:'SHOW_RESULTS',hostSecret:sessionStorage.getItem('room-host-'+code)}));if(m.room?.phase==='results'){ws.close();resolve();}};}),code);
 await student.getByRole('tab').first().waitFor();
 assert.equal(await student.getByRole('tab').count(),4);
 await student.getByRole('tab').nth(2).click();
 assert.equal(await student.getByRole('tab').nth(2).getAttribute('aria-selected'),'true');
 assert.equal(await p.getByRole('tab').first().getAttribute('aria-selected'),'true');
 await p.goto('http://127.0.0.1:18532/scenarios/S01');
 await p.getByRole('button',{name:lang==='en'?'Begin Resolving Dilemma':'Почати вирішення дилеми',exact:true}).click();
 await p.getByTestId('stepper').waitFor();
 const solo=await p.evaluate(()=>{return ['.stage-badge-row','.cids-action-row'].map(selector=>{const row=document.querySelector(selector),a=row.getBoundingClientRect(),b=row.firstElementChild.getBoundingClientRect();return Math.abs(a.left+a.width/2-b.left-b.width/2);});});solo.forEach(delta=>assert.ok(delta<2));
 console.log('PASS centered badges/CIDS and mobile layout');
 console.log('PASS classroom images and synchronized timer',lang,theme,width);await c.close();
 }
 }finally{await browser?.close();server.kill();await rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
