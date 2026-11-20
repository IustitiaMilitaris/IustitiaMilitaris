const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const labels=require('../src/i18n/customScenarios.json');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'builder-save-fix-'));
 let server;
 const start=async()=>{server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18569',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});});};
 let browser;
 try{
 await start();
 let iteration=0;
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const lang of ['uk','en'])for(const theme of ['dark','light'])for(const width of [375,1280]){
 if(iteration++){await new Promise(resolve=>{server.once('exit',resolve);server.kill();});await start();}
 const c=await browser.newContext({viewport:{width,height:900}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const p=await c.newPage(),base='http://127.0.0.1:18569',t=labels[lang];
 const save=async id=>{const response=p.waitForResponse(r=>r.url().endsWith('/api/scenarios/custom')&&r.request().method()==='POST');await p.getByRole('button',{name:t.save,exact:true}).click();const res=await response;assert.equal(res.status(),200,await res.text());await p.getByText(t.saved,{exact:true}).waitFor();assert.equal(JSON.parse(await fs.readFile(path.join(dir,`custom-scenarios/${id}.json`),'utf8')).id,id);};
 await p.goto(base+'/builder');await p.getByRole('button',{name:t.save,exact:true}).waitFor();
 assert.equal(await p.locator('.studio-toolbar .im-primary').count(),1);
 const main=p.locator('.builder-main-actions'),utilities=p.locator('.builder-utilities');assert.equal(await main.locator('button').count(),3);assert.equal(await utilities.locator('button,label').count(),4);
 await save('S04');const status=await p.getByText(t.saved,{exact:true}).boundingBox(),bottom=await utilities.boundingBox();assert.ok(status.y>=bottom.y+bottom.height);
 await p.goto(base+'/');await p.locator('.scenario-card').nth(3).waitFor();await p.goto(base+'/classroom');await p.getByTestId('landing-team-grid').locator('article').nth(3).waitFor();
 await p.goto(base+'/builder/S01');await p.getByRole('button',{name:t.save,exact:true}).waitFor();await save('S05');
 const builtIn=JSON.parse(await fs.readFile(path.join(__dirname,'../stsenarii/S01-spravedlyvist-rozpodilu.json'),'utf8'));const clone=JSON.parse(await fs.readFile(path.join(dir,'custom-scenarios/S05.json'),'utf8'));assert.deepEqual(clone.vuzly.map(n=>n.id),builtIn.vuzly.map(n=>n.id));
 await p.getByRole('button',{name:t.group,exact:true}).click();await p.waitForURL(/classroom\/host\/\d{6}/);await p.getByTestId('lobby-start').waitFor();await p.getByTestId('lobby-start').click();await p.locator('.unified-tracker').waitFor();await p.getByTestId('stepper').waitFor();
 await p.goto(base+'/');await p.locator('.scenario-card').nth(4).waitFor();
 for(const id of ['S05','S04']){const card=p.locator('.scenario-card').filter({has:p.getByRole('link',{name:t.edit,exact:true})}).last();await card.getByRole('button',{name:t.delete,exact:true}).click();await p.getByRole('dialog').getByRole('textbox').fill(await p.getByTestId('delete-case-title').textContent());await p.getByRole('dialog').getByRole('button',{name:t.delete,exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await assert.rejects(fs.access(path.join(dir,`custom-scenarios/${id}.json`)));}
 assert.equal(await p.locator('.scenario-card').count(),3);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Server field errors must survive all the way to the localized status banner.
 await p.goto(base+'/builder');await p.getByRole('button',{name:t.save,exact:true}).waitFor();
 await p.route('**/api/scenarios/custom',route=>route.request().method()==='POST'?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'invalidScenario',details:[{field:'scenario.kontekst',code:'minLength',expected:20}]})}):route.continue());
 await p.getByRole('button',{name:t.save,exact:true}).click();await p.getByRole('alert').waitFor();const error=await p.getByRole('alert').textContent();assert.ok(error.includes('scenario.kontekst')&&error.includes(t.minLength));
 console.log('PASS builder template, clone, save200, disk, catalog, launch, deletion, error details and toolbar',lang,theme,width);await c.close();
 }
 assert.deepEqual((await fs.readdir(path.join(dir,'custom-scenarios'))).filter(f=>f.endsWith('.json')),[]);
 }finally{await browser?.close();server?.kill();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
