const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const labels=require('../src/i18n/customScenarios.json');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'persistent-custom-browser-'));
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18568',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let browser;
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const lang of ['uk','en'])for(const theme of ['dark','light']){
 const c=await browser.newContext({viewport:{width:1280,height:900}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const p=await c.newPage(),base='http://127.0.0.1:18568',t=labels[lang];
 await p.goto(base+'/builder');await p.getByRole('button',{name:t.save,exact:true}).waitFor();
 const response=p.waitForResponse(r=>r.url().endsWith('/api/scenarios/custom')&&r.request().method()==='POST');
 await p.getByRole('button',{name:t.save,exact:true}).click();assert.equal((await response).status(),200);
 await p.getByText(t.saved,{exact:true}).waitFor();
 await fs.access(path.join(dir,'custom-scenarios/S04.json'));
 await p.goto(base+'/');await p.locator('.scenario-card').nth(3).waitFor();assert.equal(await p.locator('.scenario-card').count(),4);
 assert.equal(await p.locator('.scenario-card').first().getByRole('button',{name:t.delete,exact:true}).count(),0);
 const card=p.locator('.scenario-card').nth(3);assert.ok((await card.textContent()).includes(t.custom));assert.equal(await card.locator('img').count(),0);
 await card.getByRole('link',{name:t.edit,exact:true}).click();await p.getByRole('button',{name:t.save,exact:true}).waitFor();
 await p.getByRole('button',{name:t.group,exact:true}).click();await p.waitForURL(/classroom\/host\/\d{6}/);await p.getByTestId('lobby-timer-selector').waitFor();
 const code=await p.evaluate(()=>location.pathname.split('/').pop());
 const guest=await c.newPage();await guest.goto(base+'/classroom/join/'+code);await guest.getByTestId('classroom-timer').waitFor();
 await p.goto(base+'/classroom');await p.getByTestId('landing-team-grid').locator('article').nth(3).waitFor();
 assert.equal(await p.getByTestId('landing-team-grid').getByRole('button',{name:t.delete,exact:true}).count(),1);
 await p.getByTestId('landing-team-grid').getByRole('button',{name:t.delete,exact:true}).click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
 await p.getByTestId('landing-team-grid').getByRole('button',{name:t.delete,exact:true}).click();
 await p.getByRole('dialog').getByRole('button',{name:t.delete,exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('[data-testid="landing-team-grid"] article').length===3);
 await assert.rejects(fs.access(path.join(dir,'custom-scenarios/S04.json')));
 await guest.reload();await guest.getByTestId('classroom-timer').waitFor();
 await p.goto(base+'/');await p.locator('.scenario-card').first().waitFor();assert.equal(await p.locator('.scenario-card').count(),3);
 assert.equal(await p.getByRole('button',{name:t.delete,exact:true}).count(),0);
 console.log('PASS custom case builder save/edit/launch, catalog, classroom, delete modal and room snapshot',lang,theme);await c.close();
 }
 }finally{await browser?.close();server.kill();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
