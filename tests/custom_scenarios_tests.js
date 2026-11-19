import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import fixtures from './scenarios.cjs';
const directory=await mkdtemp(path.join(os.tmpdir(),'custom-cases-'));
let server;const sockets=[];
async function start(){server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18567',DATA_DIR:directory},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),10000);server.stdout.on('data',d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}});server.once('exit',()=>reject(Error('startup failed')));});}
async function stop(){if(server){await new Promise(resolve=>{server.once('exit',resolve);server.kill();});server=null;}}
const base='http://127.0.0.1:18567';
const request=(method,url,body,origin=base)=>fetch(base+url,{method,headers:{'Content-Type':'application/json',Origin:origin},...(body===undefined?{}:{body:JSON.stringify(body)})});
const connect=async()=>{const ws=new WebSocket(base.replace('http','ws')+'/ws');sockets.push(ws);await new Promise(r=>ws.once('open',r));return ws;};
const action=(ws,data)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('WS timeout')),5000);ws.once('message',raw=>{clearTimeout(timer);resolve(JSON.parse(raw));});ws.send(JSON.stringify(data));});
try{
 await start();const scenario=structuredClone(fixtures.scenarios[0]);scenario.id='S04';
 for(const id of ['S01','S02','S03']){assert.equal((await request('POST','/api/scenarios/custom',{...scenario,id})).status,403);assert.equal((await request('DELETE','/api/scenarios/custom/'+id)).status,403);}
 assert.equal((await request('POST','/api/scenarios/custom',{...scenario,id:'../S01'})).status,400);
 assert.equal((await request('DELETE','/api/scenarios/custom/..%2FS01')).status,400);
 assert.equal((await request('POST','/api/scenarios/custom',scenario,'https://evil.example')).status,403);
 for(const alter of [s=>s.vuzly[0].varianty[0].baly.dovira=3,s=>s.vuzly[0].varianty[1].id=s.vuzly[0].varianty[0].id,s=>s.vuzly[0].varianty[0].normy=['MISSING'],s=>s.diiovi_osoby.forEach(r=>r.hravets=false),s=>s.vuzly[0].varianty.pop(),s=>s.vuzly.push({...structuredClone(s.vuzly[0]),id:'V99'})]){
 const bad=structuredClone(scenario);alter(bad);if(bad.vuzly[0].varianty.length===3)bad.vuzly[0].varianty.pop();assert.equal((await request('POST','/api/scenarios/custom',bad)).status,400);
 }
 assert.equal((await request('POST','/api/scenarios/custom',scenario)).status,201);
 const file=path.join(directory,'custom-scenarios/S04.json');const bytes=await readFile(file);assert.notEqual(bytes.subarray(0,3).toString('hex'),'efbbbf');assert.equal(JSON.parse(bytes).id,'S04');
 assert.equal((await (await request('GET','/api/scenarios/custom')).json()).scenarios.length,1);
 await stop();await start();assert.equal((await (await request('GET','/api/scenarios/custom')).json()).scenarios[0].id,'S04');
 const host=await connect();const created=await action(host,{type:'CREATE_ROOM',scenarioId:'S04'});assert.equal(created.type,'ROOM_CREATED');assert.equal(created.room.scenario.id,'S04');
 assert.equal((await request('DELETE','/api/scenarios/custom/S04')).status,200);await assert.rejects(access(file));
 const voting=await action(host,{type:'OPEN_VOTING',hostSecret:created.hostSecret});assert.equal(voting.room.phase,'voting');
 const guest=await connect();const joined=await action(guest,{type:'JOIN_ROOM',roomCode:created.room.code,clientVoteToken:'f'.repeat(32)});assert.equal(joined.room.scenario.id,'S04');
 const newcomer=await connect();assert.equal((await action(newcomer,{type:'CREATE_ROOM',scenarioId:'S04'})).type,'ERROR');
 await writeFile(path.join(directory,'custom-scenarios/S05.json'),'{broken');assert.equal((await (await request('GET','/api/scenarios/custom')).json()).scenarios.length,0);
 console.log('PASS persistent custom scenarios: validation, protected IDs, CSRF, disk/restart, WS snapshot and deletion');
}finally{for(const ws of sockets)ws.terminate();await stop();await rm(directory,{recursive:true,force:true});}
