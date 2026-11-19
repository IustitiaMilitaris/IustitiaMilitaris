import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import fixtures from './scenarios.cjs';
const {scenarios,route}=fixtures;
const dir=await mkdtemp(path.join(os.tmpdir(),'stats-test-'));
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18600',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);r();}});});
 const endpoint='http://127.0.0.1:18600';
 const post=body=>fetch(endpoint+'/api/stats/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={scenarioId:'S01',pathway:route(scenarios[0])};
 assert.equal((await post({...body,userId:'private-alias'})).status,400);
 assert.equal((await post({...body,pathway:body.pathway.slice(0,2)})).status,400);
 assert.equal((await post({...body,pathway:[...body.pathway].reverse()})).status,400);
 assert.equal((await post(body)).status,200);
 assert.equal((await post({...body,pathway:route(scenarios[0],1)})).status,200);
 const stats=await(await fetch(endpoint+'/api/stats/S01')).json();
 assert.equal(stats.completions,2);assert.equal(stats.nodes[0].completions,2);assert.equal(stats.nodes[0].variants[0].percent,50);assert.equal(stats.nodes[0].variants[1].percent,50);
 const store=JSON.parse(await readFile(path.join(dir,'store.json'),'utf8'));
 assert.deepEqual(store.aggregateStats.S01.nodes.V1,{completions:2,variants:{[body.pathway[0].variantId]:1,[route(scenarios[0],1)[0].variantId]:1}});
 assert.doesNotMatch(JSON.stringify(store.aggregateStats),/userId|login|private-alias|notes|session|pathway|token/i);
 assert.doesNotMatch(JSON.stringify(stats),/userId|login|private-alias|notes|session|pathway|token/i);
 for(let i=0;i<25;i++) await post({});
 assert.equal((await post({})).status,429);
 console.log('PASS anonymous stats: completion validation, branch counts, percentages, rate limit and storage without identity or raw paths');
}finally{server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(dir,{recursive:true,force:true});}
