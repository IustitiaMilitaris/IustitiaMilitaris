const { chromium } = require('playwright'), JSZip = require('jszip');
const { spawn } = require('node:child_process'), http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { root, scenarios, englishScenarios, route } = require('./scenarios.cjs');
const scorm = require('../src/i18n/scorm.json'), accounts = require('../src/i18n/accounts.json');
const norms = require('../normy.json');
const sourceFor = (s,lang) => lang === 'uk' ? s : englishScenarios[s.id];
const rawIds = /\b(?:V\d+|[A-Z][1-9])\b/u;
async function readable(page,lang,selector='main') {
  const text = await page.locator(selector).innerText();
  assert.doesNotMatch(text,rawIds);
  if(lang==='en') assert.doesNotMatch(text,/\p{Script=Cyrillic}/u);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal page overflow');
}
async function solo(page,source,lang,branch=0) {
  await page.goto(`http://127.0.0.1:18500/scenarios/${source.id}/play`);
  const steps = route(source,branch), reached=[];
  for(const step of steps) {
    const node=source.vuzly.find(n=>n.id===step.nodeId),choice=node.varianty.find(v=>v.id===step.variantId);
    reached.push(node.id);
    await page.locator('.im-choice').first().waitFor();
    const letters=await page.locator('.im-choice span').allTextContents();
    assert.deepEqual(letters,(lang==='uk'?'АБВГ':'ABCD').slice(0,node.varianty.length).split(''));
    await readable(page,lang);
    await page.getByText(choice.tekst,{exact:true}).click();
    await page.getByRole('button',{name:lang==='uk'?'Підтвердити вибір':'Confirm Decision',exact:true}).click();
    await page.locator('.consequence-delayed').waitFor();
    assert.ok((await page.locator('main').innerText()).includes(choice.zvorotnyi_zviazok));
    await readable(page,lang);
    await page.getByRole('button',{name:choice.nastupnyi_vuzol?(lang==='uk'?'Перейти до наступного етапу':'Proceed to Next Stage'):(lang==='uk'?'Переглянути підсумкову карту рішень':'View Final Reflection Map'),exact:true}).click();
  }
  await page.locator('svg.select-none').waitFor();
  await readable(page,lang);
  for(const step of steps) await page.getByText(source.vuzly.find(n=>n.id===step.nodeId).varianty.find(v=>v.id===step.variantId).tekst,{exact:true}).last().waitFor();
  return reached;
}
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'case-display-'));
  let files={},browser;
  const exported=http.createServer((request,response)=>{const key=request.url==='/'?'index.html':request.url.slice(1);response.setHeader('Content-Type',key.endsWith('.js')?'application/javascript':'text/html');response.end(files[key]||'');});
  await new Promise(resolve=>exported.listen(18501,'127.0.0.1',resolve));
  const server=spawn(process.execPath,['server/index.js'],{cwd:root,env:{...process.env,PORT:'18500',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('server startup')),10000);server.stdout.on('data',chunk=>{if(String(chunk).includes('Local:')){clearTimeout(timeout);resolve();}});server.once('exit',()=>reject(Error('server exited')));});
    browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
    await fs.mkdir(path.join(root,'test-results/cases'),{recursive:true});
    for(const theme of ['dark','light']) for(const lang of ['uk','en']) for(const width of [360,1280]) {
      const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
      await context.addInitScript(({theme,lang})=>{localStorage.setItem('eds-theme',theme);localStorage.setItem('eds-language',lang);},{theme,lang});
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:18500/');
      assert.equal(await page.locator('.scenario-card').count(),2);
      for(let i=1;i<=3;i++) assert.equal(await page.getByText(`${lang==='uk'?'ЗАДАЧА':'CASE'} ${i}`,{exact:true}).count(),1);
      await readable(page,lang);
      await page.screenshot({path:path.join(root,`test-results/cases/catalog-${theme}-${lang}-${width}.png`),fullPage:true});
      const visited=new Set();
      for(const original of scenarios) {
        const source=sourceFor(original,lang);
        const card=page.locator('.scenario-card').filter({has:page.getByText(`${lang==='uk'?'ЗАДАЧА':'CASE'} ${Number(source.id.slice(1))}`,{exact:true})});
        assert.ok((await card.innerText()).toLowerCase().includes(`${{S01:6,S02:8,S03:9}[source.id]} ${lang==='uk'?'етапів':'stages'}`));
        const downloading=page.waitForEvent('download');await card.getByRole('button',{name:'SCORM 1.2',exact:true}).click();
        const download=await downloading,zip=await JSZip.loadAsync(await fs.readFile(await download.path()));
        assert.ok((await zip.file('imsmanifest.xml').async('string')).includes('MANIFEST_'+source.id));
        files={'index.html':await zip.file('index.html').async('string'),'scorm-api.js':await zip.file('scorm-api.js').async('string')};
        const player=await context.newPage();player.on('pageerror',error=>errors.push(error.message));
        await player.addInitScript(()=>{window.lmsWrites=[];window.API={LMSInitialize:()=>true,LMSSetValue:(key,value)=>{window.lmsWrites.push([key,value]);return true;},LMSCommit:()=>true,LMSFinish:()=>true};});
        await player.goto('http://127.0.0.1:18501/');
        await player.getByRole('button',{name:scorm[lang].s4,exact:true}).click();
        for(const step of route(source)) {
          const node=source.vuzly.find(n=>n.id===step.nodeId);
          assert.deepEqual(await player.locator('.btn-option strong').allTextContents(),(lang==='uk'?['А.','Б.','В.','Г.']:['A.','B.','C.','D.']).slice(0,node.varianty.length));
          await player.locator('.btn-option').first().click();await player.locator('.btn-primary').click();
        }
        await readable(player,lang,'#app');
        assert.deepEqual(await player.evaluate(()=>window.lmsWrites),[['cmi.core.lesson_status','incomplete'],['cmi.core.lesson_status','completed']]);
        await player.close();
        for(const branch of source.id==='S01'&&width===1280?[0,1,2,3]:[0]) {
          await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('simulator_progress_'))localStorage.removeItem(key);});
          for(const nodeId of await solo(page,source,lang,branch))visited.add(source.id+':'+nodeId);
        }
        await page.screenshot({path:path.join(root,`test-results/cases/summary-${source.id}-${theme}-${lang}-${width}.png`),fullPage:true});
        await page.goto('http://127.0.0.1:18500/');
      }
      if(width===1280)assert.equal(visited.size,26);
      await page.goto('http://127.0.0.1:18500/norms');
      assert.equal(await page.locator('main .cursor-pointer').count(),norms.normy.length);
      for(const norm of norms.normy.filter(n=>/^(KZPP-|KONST-|DS-|EQUAL-|PROC-|KK-|VS-)/.test(n.id)))assert.equal(await page.locator(`[data-testid=norm-card][data-norm-id="${norm.id}"]`).count(),1);
      for(const court of norms.normy.filter(n=>n.id.startsWith('VS-'))) {
        await page.locator(`[data-testid=norm-card][data-norm-id="${court.id}"]`).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
        assert.ok((await dialog.innerText()).includes(lang==='uk'?'Не звірено':'Not verified'));
        if(lang==='en')assert.doesNotMatch(await dialog.innerText(),/\p{Script=Cyrillic}/u);
        await dialog.getByRole('button').first().click();
      }
      for(const source of scenarios) {
        await page.goto('http://127.0.0.1:18500/builder/'+source.id);
        await page.getByRole('button',{name:lang==='uk'?'Запустити в симуляторі':'Test in Simulator',exact:true}).click();
        await page.getByRole('heading',{name:sourceFor(source,lang).nazva,exact:true}).waitFor();await readable(page,lang);
      }
      await page.goto('http://127.0.0.1:18500/classroom');
      assert.equal(await page.locator('[data-testid="landing-team-grid"] article').count(),2);
      assert.equal(await page.locator('[data-testid="landing-examples-grid"]').count(),0);
      await readable(page,lang);
      assert.equal((await page.request.post('http://127.0.0.1:18500/api/auth/register',{data:{login:`cases-${theme}-${lang}-${width}`,password:'case-check-pass'}})).status(),200);
      for(const source of scenarios) assert.equal((await page.request.post('http://127.0.0.1:18500/api/progress',{data:{scenarioId:source.id,pathway:route(source,source.id==='S01'?1:0)}})).status(),200);
      await page.goto('http://127.0.0.1:18500/auth');
      await page.getByRole('heading',{name:accounts[lang].progress,exact:true}).waitFor();
      await page.getByText('3 / 3',{exact:true}).first().waitFor();
      await page.locator('main details summary').evaluateAll(elements=>elements.forEach(e=>e.click()));
      await readable(page,lang);
      assert.deepEqual(errors,[]);await context.close();
      console.log('PASS cases:',theme,lang,width,'catalogue, complete solo paths, 26 desktop nodes, summaries, profile, 60 norms/2 courts, builder previews, SCORM content/letters/privacy');
    }
  } finally {
    await browser?.close();server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));await new Promise(resolve=>exported.close(resolve));await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
