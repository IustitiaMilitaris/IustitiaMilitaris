import { mkdirSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCustomScenario } from './scenario-validation.js';
import { randomBytes } from 'node:crypto';
import { parseJson, rateLimit } from './security.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const idPattern = /^S(0[4-9]|[1-9][0-9])$/;
const customId = id => typeof id === 'string' && id.length === 3 && idPattern.test(id);
const builtIn = id => ['S01', 'S02', 'S03'].includes(id);
const check = async scenario => validateCustomScenario(scenario);
export async function installCustomScenarios(app, dataDirectory) {
  const directory = path.resolve(dataDirectory, 'custom-scenarios');
  await mkdir(directory, {recursive:true, mode:0o700});
  const scenarios = new Map();
  for (const file of await readdir(path.join(root, 'stsenarii'))) if(file.endsWith('.json')) {
    const s = parseJson(await readFile(path.join(root,'stsenarii',file),'utf8'));scenarios.set(s.id,s);
  }
  let queue = Promise.resolve();
  const serial = fn => { const job = queue.then(fn); queue = job.catch(()=>{}); return job; };
  const cache = new Map();
  const filename = id => {
    if (!customId(id)) throw Error('invalidId');
    const file = path.resolve(directory, id+'.json');
    if (path.dirname(file) !== directory) throw Error('invalidPath');
    return file;
  };
  const refresh = () => serial(async () => {
    const found = new Set();
    for (const file of (await readdir(directory)).filter(f => /^S(0[4-9]|[1-9][0-9])\.json$/.test(f)).slice(0,50)) {
      const id=file.slice(0,-5);found.add(id);
      try {
        const full=filename(id), info=await stat(full);
        const signature=`${info.mtimeMs}:${info.size}`;
        if(cache.get(id)===signature)continue;
        if(info.size>2*1024*1024)throw Error('tooLarge');
        const s=parseJson(await readFile(full,'utf8'));
        if(s.id!==id || !(await check(s)).valid)throw Error('invalid');
        scenarios.set(id,s);cache.set(id,signature);
      } catch { scenarios.delete(id);cache.delete(id); }
    }
    for(const id of scenarios.keys())if(!builtIn(id)&&!found.has(id)){scenarios.delete(id);cache.delete(id);}
  });
  await refresh();
  const mutateLimit=rateLimit(30,60000);
  app.get('/api/scenarios/custom', async(req,res,next)=>{try{await refresh();res.json({scenarios:[...scenarios.values()].filter(s=>!builtIn(s.id)),builtInIds:['S01','S02','S03']});}catch(e){res.status(e.status || 500).json({error:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':e.message==='scenarioLimit'?'scenarioLimit':'storageFailed',details:e.details || [{field:'storage',code:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'storageFailed'}]});}});
  app.post('/api/scenarios/custom',mutateLimit,async(req,res,next)=>{
    try{
      const s=req.body;
      if(builtIn(s?.id))return res.status(403).json({error:'protectedScenario',details:[{field:'scenario.id',code:'protectedScenario'}]});
      if(!s || !customId(s.id))return res.status(400).json({error:'invalidScenario',details:[{field:'scenario.id',code:'customId'}]});
      const result=await check(s);
      if(!result.valid)return res.status(400).json({error:'invalidScenario',details:result.errors});
      const serialized=JSON.stringify(s,null,2)+'\n';
      if(Buffer.byteLength(serialized)>2*1024*1024)return res.status(413).json({error:'storedScenarioTooLarge',details:[{field:'scenario',code:'storedScenarioTooLarge',expected:2097152}]});
      await serial(async()=>{
        mkdirSync(directory,{recursive:true,mode:0o700});
        const files=(await readdir(directory)).filter(f=>/^S\d{2}\.json$/.test(f));
        if(!files.includes(s.id+'.json')&&files.length>=50)throw Object.assign(Error('scenarioLimit'),{status:400,details:[{field:'catalog',code:'scenarioLimit',expected:50}]});
        const file=filename(s.id),temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
        try{await writeFile(temp,serialized,{mode:0o600,flag:'wx'});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
        scenarios.set(s.id,structuredClone(s));cache.delete(s.id);
      });
      res.status(200).json({scenario:s,builtIn:false});
    }catch(e){res.status(e.status || 500).json({error:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':e.message==='scenarioLimit'?'scenarioLimit':'storageFailed',details:e.details || [{field:'storage',code:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'storageFailed'}]});}
  });
  app.delete('/api/scenarios/custom/:id',mutateLimit,async(req,res,next)=>{
    try{
      const id=req.params.id;
      if(builtIn(id))return res.status(403).json({error:'protectedScenario',details:[{field:'scenario.id',code:'protectedScenario'}]});
      if(!customId(id))return res.status(400).json({error:'invalidScenario',details:[{field:'scenario.id',code:'customId'}]});
      await serial(async()=>{await unlink(filename(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});scenarios.delete(id);cache.delete(id);});res.json({ok:true});
    }catch(e){res.status(e.status || 500).json({error:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':e.message==='scenarioLimit'?'scenarioLimit':'storageFailed',details:e.details || [{field:'storage',code:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'storageFailed'}]});}
  });
  return {scenarios,refresh};
}
