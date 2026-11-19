const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const {scenarios,englishScenarios,route}=require('./scenarios.cjs');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'edited-cases-'));
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18543',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let browser;
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});});
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const lang of ['uk','en'])for(const source of scenarios){
 const c=await browser.newContext({viewport:{width:1280,height:900}});
 await c.addInitScript(lang=>localStorage.setItem('eds-language',lang),lang);
 const page=await c.newPage(),scenario=lang==='uk'?source:englishScenarios[source.id];
 await page.goto(`http://127.0.0.1:18543/scenarios/${source.id}/play`);
 const steps=source.id==='S02'?route(source):route(source).slice(0,1);
 for(const step of steps){
 await page.locator('.im-choice').first().waitFor();
 const node=scenario.vuzly.find(n=>n.id===step.nodeId);
 const heading=node.tekst.split('\n\n')[0];
 assert.ok(heading.length<160);
 const badges=await page.locator('.stage-badge-row').first().textContent();
 assert.ok(badges.includes((lang==='uk'?'Етап ':'Stage ')+heading.match(/\d+/)[0]));
 assert.ok((await page.getByTestId('dossier').textContent()).includes(node.tekst.split('\n\n')[1]));
 if(lang==='en')assert.doesNotMatch(await page.locator('main').innerText(),/\p{Script=Cyrillic}/u);
 if(source.id!=='S02')break;
 const variant=node.varianty.find(v=>v.id===step.variantId);
 await page.getByText(variant.tekst,{exact:true}).click();
 await page.getByRole('button',{name:lang==='uk'?'Підтвердити вибір':'Confirm Decision',exact:true}).click();
 await page.locator('.consequence-delayed').waitFor();
 await page.getByRole('button',{name:variant.nastupnyi_vuzol?(lang==='uk'?'Перейти до наступного етапу':'Proceed to Next Stage'):(lang==='uk'?'Переглянути підсумкову карту рішень':'View Final Reflection Map'),exact:true}).click();
 }
 console.log('PASS edited scenario loading and separated stage headings',source.id,lang);
 await c.close();
 }
 }finally{await browser?.close();server.kill();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
