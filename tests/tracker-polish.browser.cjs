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
 for(const lang of ['uk','en'])for(const theme of ['dark','light'])for(const width of [375,1280])for(const source of scenarios.slice(0,1)){
 const c=await browser.newContext({viewport:{width,height:900}});
 await c.addInitScript(({lang,theme})=>{localStorage.setItem('eds-language',lang);localStorage.setItem('eds-theme',theme);},{lang,theme});
 const page=await c.newPage(),scenario=lang==='uk'?source:englishScenarios[source.id];
 await page.goto(`http://127.0.0.1:18543/scenarios/${source.id}/play`);
 const steps=route(source).slice(0,1);
 for(const step of steps){
 await page.locator('.im-choice').first().waitFor();
 const node=scenario.vuzly.find(n=>n.id===step.nodeId);
 const heading=node.tekst.split('\n\n')[0];
 assert.ok(heading.length<160);
 const badges=await page.locator('.stage-badge-row').first().textContent();
 assert.ok(badges.includes((lang==='uk'?'Етап ':'Stage ')+heading.match(/\d+/)[0]));
 assert.ok((await page.getByTestId('dossier').textContent()).includes(node.tekst.split('\n\n')[1]));
 if(lang==='en')assert.doesNotMatch(await page.locator('main').innerText(),/\p{Script=Cyrillic}/u);
 await page.evaluate(()=>document.fonts.ready);
 const tracker=page.locator('.tactical-tracker');await tracker.waitFor();
 await page.waitForFunction(expected=>getComputedStyle(document.querySelector('[data-testid="scenario-timer"]')).color===expected,theme==='dark'?'rgb(124, 200, 224)':'rgb(29, 105, 130)');
 const info=await tracker.evaluate(e=>{const clock=e.querySelector('[data-testid="scenario-timer"]'),r=clock.getBoundingClientRect(),box=e.getBoundingClientRect(),css=getComputedStyle(clock);return {font:parseFloat(css.fontSize),color:css.color,delta:Math.abs(r.left+r.width/2-box.left-box.width/2),axes:e.querySelectorAll('.tracker-axes > div').length,keys:e.querySelector('.tracker-keys').textContent};});
 assert.ok(info.font>=30&&info.delta<2);assert.equal(info.axes,3);assert.equal(info.color,theme==='dark'?'rgb(124, 200, 224)':'rgb(29, 105, 130)');assert.doesNotMatch(info.keys,/\/|continue|далі/);
 if(width===1280){const gap=await page.locator('.play-layout').evaluate(e=>{const a=e.children[0].getBoundingClientRect(),b=e.children[1].getBoundingClientRect();return b.left-a.right;});assert.ok(Math.abs(gap-16)<2);}
 const spacing=await page.evaluate(()=>{const nav=document.querySelector('#breadcrumbs'),r=nav.getBoundingClientRect(),style=getComputedStyle(nav),next=document.querySelector('.solo-shell').getBoundingClientRect();return {top:parseFloat(style.paddingTop),bottom:parseFloat(style.paddingBottom)+next.top-r.bottom};});assert.ok(Math.abs(spacing.top-spacing.bottom)<2);

 const variant=node.varianty.find(v=>v.id===step.variantId);
 await page.getByText(variant.tekst,{exact:true}).click();
 await page.getByRole('button',{name:lang==='uk'?'Підтвердити вибір':'Confirm Decision',exact:true}).click();
 await page.locator('.consequence-delayed').waitFor();
 const feedback=await page.locator('.feedback-prose').evaluateAll(es=>es.map(e=>({align:getComputedStyle(e).textAlign,last:getComputedStyle(e).textAlignLast,language:e.closest('[lang]')?.getAttribute('lang')})));assert.ok(feedback.length>=3);feedback.forEach(x=>{assert.equal(x.align,'justify');assert.equal(x.last,'left');assert.equal(x.language,lang);});
 break;
 await page.getByRole('button',{name:variant.nastupnyi_vuzol?(lang==='uk'?'Перейти до наступного етапу':'Proceed to Next Stage'):(lang==='uk'?'Переглянути підсумкову карту рішень':'View Final Reflection Map'),exact:true}).click();
 }
 console.log('PASS tracker layout, colors, axes, breadcrumbs and justified feedback',lang,theme,width);
 await c.close();
 }
 }finally{await browser?.close();server.kill();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
