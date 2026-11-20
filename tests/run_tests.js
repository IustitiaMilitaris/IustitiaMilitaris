import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import fixtures from './scenarios.cjs';
const require = createRequire(import.meta.url), load = require('./ts-loader.cjs');
const { scenarios, root } = fixtures;
const { allScenarios } = load(root + '/src/data/scenarios.ts');
const { localizeScenario } = load(root + '/src/i18n/content.ts');
const { stageLabel, variantLabel, choiceLabel, caseLabel, scenarioStageCount } = load(root + '/src/i18n/display.ts');
const { generateScorm12Zip } = load(root + '/src/utils/scormExport.ts');
const JSZip = require('jszip');
const norms = JSON.parse(fs.readFileSync(root + '/normy.json', 'utf8'));
let passed = 0, total = 0;
async function test(name, run) {
  total++;
  try { await run(); passed++; console.log('PASS:', name); }
  catch (error) { process.exitCode = 1; console.error('FAIL:', name, error); }
}
await test('Group disagreement excludes empty/unanimous rounds and reports at most two stages', () => {
 const {mostDividedStages}=load(root+'/src/utils/groupSummary.ts');
 const empty={votes:{},discussionIndex:0},unanimous={votes:{A:3},discussionIndex:0},split={votes:{A:2,B:1},discussionIndex:.89},tie={votes:{A:1,B:1},discussionIndex:1};
 assert.deepEqual(mostDividedStages([empty,unanimous]),[]);
 assert.deepEqual(mostDividedStages([empty,split,tie,unanimous,split]),[tie,split]);
});
await test('Exactly three new cases, 26 nodes and 102 options', () => {
  assert.deepEqual(scenarios.map(s => s.id), ['S01','S02','S03']);
  assert.equal(scenarios.reduce((sum,s) => sum+s.vuzly.length,0),26);
  assert.equal(scenarios.flatMap(s=>s.vuzly.flatMap(n=>n.varianty)).length,102);
  assert.deepEqual(allScenarios.map(s=>s.nazva),scenarios.map(s=>s.nazva));
});
await test('All branches reachable, acyclic and terminal at six, eight or nine stages', () => {
  for (const [i,s] of scenarios.entries()) {
    const nodes = new Map(s.vuzly.map(n=>[n.id,n])), reached = new Set();
    function depths(id, trail = new Set()) {
      if (id === null) return new Set([0]);
      assert.ok(nodes.has(id),id);assert.ok(!trail.has(id),'cycle');reached.add(id);
      const next = new Set(trail).add(id), result = new Set();
      for (const v of nodes.get(id).varianty) for(const d of depths(v.nastupnyi_vuzol,next)) result.add(d+1);
      return result;
    }
    assert.deepEqual([...depths('V1')],[[6,8,9][i]]);
    assert.equal(reached.size,nodes.size);
    assert.equal(s.diiovi_osoby.filter(r=>r.hravets).length,1);
    if (s.id==='S01') {
      assert.deepEqual(nodes.get('V1').varianty.map(v=>v.nastupnyi_vuzol),['V2','V3','V4','V5']);
      for(const id of ['V2','V3','V4','V5']) assert.ok(nodes.get(id).varianty.every(v=>v.nastupnyi_vuzol==='V6'));
    } else assert.ok(s.vuzly.every(n=>n.varianty.length===4));
  }
});
await test('Unique option IDs, complete consequences, analytical feedback and independent bounded scales', () => {
  for(const s of scenarios) {
    const ids = new Set();
    for(const n of s.vuzly) {
      assert.ok(n.varianty.length>=2&&n.varianty.length<=4);
      if(n.id==='V1') assert.ok(n.varianty.length>=3);
      for(const v of n.varianty) {
        assert.match(v.id,/^[A-Z][0-9]?$/);assert.ok(!ids.has(v.id));ids.add(v.id);
        assert.deepEqual(Object.keys(v.baly).sort(),['dobrochesnist','dovira','efektyvnist']);
        for(const value of Object.values(v.baly)) assert.ok(Number.isInteger(value)&&value>=-2&&value<=2);
        for(const text of [v.tekst,v.naslidky.odrazu,v.naslidky.vidkladeni,v.chomu_taki_baly,v.zvorotnyi_zviazok]) assert.ok(text.trim());
        assert.doesNotMatch(v.zvorotnyi_zviazok+' '+v.chomu_taki_baly,/правильна відповідь|неправильна відповідь|чому неправильно/iu);
      }
    }
  }
});
await test('Every legal reference exists; unverified sources retain honest status', () => {
  const map = new Map(norms.normy.map(n=>[n.id,n]));
  for(const s of scenarios) {
    const roots = new Set(s.normy.map(n=>n.id));
    for(const n of s.normy) { assert.ok(map.has(n.id));assert.ok(n.yak_zastosovuietsia.trim()); }
    for(const n of s.vuzly) for(const v of n.varianty) for(const id of v.normy) {assert.ok(map.has(id));assert.ok(roots.has(id));}
    assert.equal(s.perevirka_zmistu.fakhivets_dzpk,'не проведено');
  }
  for(const norm of norms.normy) if(norm.status_zvirky!=='ne-zvireno') assert.ok(norm.tsytaty.length>0);
  const courts=norms.normy.filter(n=>n.id.startsWith('VS-'));
  assert.equal(courts.length,5);assert.ok(courts.every(n=>n.status_zvirky==='ne-zvireno' || n.tsytaty.some(quote=>quote.trim())));
});
await test('Actual localization preserves custom imports and switches complete built-in content', () => {
  for(const source of allScenarios) {
    const english=localizeScenario(source,'en');
    assert.equal(english.nazva,fixtures.englishScenarios[source.id].nazva);
    assert.equal(localizeScenario(english,'uk'),source);
    const edited=structuredClone(source);edited.sytuatsiia='Custom imported content';
    assert.equal(localizeScenario(edited,'en'),edited);
    assert.equal(localizeScenario(structuredClone(source),'en'),english);
  }
});
await test('Logical stages and ordinal option letters replace technical IDs in both languages', () => {
  for(const lang of ['uk','en']) for(const source of allScenarios) {
    const s=localizeScenario(source,lang),prefix=lang==='uk'?'Етап':'Stage';
    assert.equal(scenarioStageCount(s), {S01:6,S02:8,S03:9}[s.id]);
    assert.equal(caseLabel(s.id,lang),(lang==='uk'?'ЗАДАЧА ':'CASE ')+Number(s.id.slice(1)));
    for(const [i,n] of s.vuzly.entries()) {
      const number=s.id==='S01'?(i===0?1:i<5?2:i-2):i+1;
      assert.equal(stageLabel(s,n.id,lang,false),`${prefix} ${number}`);
      for(const [j,v] of n.varianty.entries()) {
        assert.equal(variantLabel(s,n.id,v.id,lang),(lang==='uk'?'АБВГ':'ABCD')[j]);
        assert.doesNotMatch(choiceLabel(s,n.id,v.id,lang),/\bV\d+\b/);
      }
    }
  }
});
await test('Real SCORM archives contain complete localized graphs and status-only LMS writes', async () => {
  for(const lang of ['uk','en']) for(const source of allScenarios) {
    const blob=await generateScorm12Zip(source,norms,lang),zip=await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest=await zip.file('imsmanifest.xml').async('string'),html=await zip.file('index.html').async('string'),api=await zip.file('scorm-api.js').async('string');
    assert.match(manifest,/<schemaversion>1.2<\/schemaversion>/);assert.ok(manifest.includes('MANIFEST_'+source.id));
    const embedded=JSON.parse(html.match(/var scenario = (.+);/)[1]);
    assert.deepEqual(embedded,localizeScenario(source,lang));
    if(lang==='en')assert.doesNotMatch(JSON.stringify(embedded),/\p{Script=Cyrillic}/u);
    const writes=[],window={API:{LMSInitialize:()=>true,LMSSetValue:(k,v)=>writes.push([k,v]),LMSCommit:()=>true,LMSFinish:()=>true}};window.parent=window;
    vm.runInNewContext(api,{window});window.SCORM_INIT();window.SCORM_COMPLETE();
    assert.deepEqual(writes,[['cmi.core.lesson_status','incomplete'],['cmi.core.lesson_status','completed']]);
  }
});
await test('Builder allocates valid unique IDs after stage nine without changing source cases', () => {
  const { freshNode, freshVariant, reachableNodes }=load(root+'/src/utils/builderStudio.ts');
  const source=structuredClone(scenarios[2]),before=JSON.stringify(source);
  const created=freshNode(source,'en');assert.equal(created.id,'V10');assert.equal(JSON.stringify(source),before);
  const draft=structuredClone(source);draft.vuzly.push(created);created.varianty.push(freshVariant(draft,'en'));
  const ids=draft.vuzly.flatMap(n=>n.varianty.map(v=>v.id));assert.equal(new Set(ids).size,ids.length);ids.forEach(id=>assert.match(id,/^[A-Z][0-9]?$/));
  assert.equal(reachableNodes(draft).has(created.id),false);draft.vuzly[0].varianty[0].nastupnyi_vuzol=created.id;assert.equal(reachableNodes(draft).has(created.id),true);
});

await test('Scenario IDs advance past catalogue, imported and reserved IDs within the schema limit', () => {
  const { nextScenarioId }=load(root+'/src/utils/builderStudio.ts');
  assert.equal(nextScenarioId(scenarios.map(s=>s.id)),'S04');
  assert.equal(nextScenarioId(['S01','S03','S04']),'S05');
  assert.equal(nextScenarioId(['S03','S10','S05']),'S06');
  assert.equal(nextScenarioId(['S09','S09','invalid','S100']),'S05');
  assert.equal(nextScenarioId(['S99']),'S05');
});
await test('Diagram geometry uses card centres, horizontal tangents and non-overlapping branch columns', () => {
  const { choiceRect, horizontalCurve, layoutDecisionStages, diagram }=load(root+'/src/utils/decisionDiagram.ts');
  const a=choiceRect(16,92,1),b=choiceRect(408,92,3);
  const from={x:a.x+a.width,y:a.y+a.height/2},to={x:b.x,y:b.y+b.height/2};
  assert.equal(horizontalCurve(from,to),'M 296 216 C 352 216, 352 392, 408 392');
  const layout=layoutDecisionStages(scenarios[0]);
  assert.equal(layout.positions.size,9);
  const branches=['V2','V3','V4','V5'].map(id=>layout.positions.get(id));
  assert.ok(branches.every(p=>p.x===branches[0].x));
  branches.slice(1).forEach((p,i)=>assert.ok(p.top>=branches[i].top+diagram.header+scenarios[0].vuzly.find(n=>n.id===['V2','V3','V4','V5'][i]).varianty.length*diagram.row));
  assert.ok([...layout.positions.values()].every(p=>p.reachable));
  const cyclic=structuredClone(scenarios[0]);cyclic.vuzly[1].varianty[0].nastupnyi_vuzol='V1';
  assert.equal(layoutDecisionStages(cyclic).positions.size,9);
});

await test('Norm display codes localize every source prefix without changing internal IDs', () => {
  const { formatNormDisplayId }=load(root+'/src/i18n/normDisplay.ts');
  for(const norm of norms.normy){assert.equal(formatNormDisplayId(norm.id,'en'),norm.id);assert.doesNotMatch(formatNormDisplayId(norm.id,'uk').split('-')[0],/[A-Z]/);}
  assert.equal(formatNormDisplayId('KZPP-2-1','uk'),'КЗпП-2-1');
  assert.equal(formatNormDisplayId('DS-22','uk'),'ЗДС-22');
});

await test('Compact norm points retain article and court numbers; corrected SC outcomes stay unverified', () => {
  const {formatNormChipPoint}=load(root+'/src/i18n/normDisplay.ts');
  assert.equal(formatNormChipPoint({id:'ZPK-1',punkt:'ст. 1 — визначення термінів'},'uk'),'ст. 1');
  assert.equal(formatNormChipPoint({id:'ZPK-1',punkt:'Article 1: definitions'},'en'),'Art. 1');
  assert.equal(formatNormChipPoint(norms.normy.find(n=>n.id==='VS-826-5931-16'),'uk'),'№ 826/5931/16');
  const court=norms.normy.find(n=>n.id==='VS-335-10825-16');assert.equal(court.status_zvirky,'ne-zvireno');assert.match(court.korotko,/скасував виправдувальний вирок/);assert.match(court.punkt,/51-4643км23/);
  assert.match(scenarios[2].vuzly[6].tekst,/скасував виправдувальний вирок/);
});

await test('LAN redirect only leaves inactive private IPv4 and preserves the route', () => {
  const { networkRedirect } = load(root+'/src/utils/serverNetwork.ts');
  const info = { preferredOrigin:'http://192.168.1.20:3000', lanIps:['192.168.1.20'], lanUrls:[] };
  assert.equal(networkRedirect('http://192.168.1.10:3000/classroom/host/123456?q=1#stage',info),'http://192.168.1.20:3000/classroom/host/123456?q=1#stage');
  for(const host of ['localhost','127.0.0.1','example.org','192.168.1.20']) assert.equal(networkRedirect(`http://${host}:3000/classroom/host/123456`,info),null);
  for(const preferredOrigin of ['http://example.org:3000','http://192.168.1.20:4000','https://192.168.1.20:3000','http://user:pass@192.168.1.20:3000']) assert.equal(networkRedirect('http://192.168.1.10:3000/',{...info,preferredOrigin}),null);
});

console.log(`${passed}/${total} tests passed (${Math.round(100*passed/total)}%)`);
