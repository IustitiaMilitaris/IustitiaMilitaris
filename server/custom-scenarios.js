import { mkdir, readdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parseJson, rateLimit } from './security.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const idPattern = /^S(0[4-9]|[1-9][0-9])$/;
const customId = id => typeof id === 'string' && id.length === 3 && idPattern.test(id);
const builtIn = id => ['S01', 'S02', 'S03'].includes(id);
const check = scenario => new Promise((resolve, reject) => {
  const child = spawn('python3', [path.join(root, 'server/validate_custom.py')], {stdio:['pipe','pipe','pipe']});
  let output = '';
  const timer = setTimeout(() => { child.kill(); reject(Error('validationTimeout')); }, 5000);
  child.on('error', error => { clearTimeout(timer); reject(error); });
  child.stdout.on('data', data => { output += data; if (output.length > 65536) child.kill(); });
  child.stderr.resume();
  child.stdin.on('error', () => {});
  child.on('close', () => { clearTimeout(timer); try { resolve(JSON.parse(output)); } catch { reject(Error('validationFailed')); } });
  child.stdin.end(JSON.stringify(scenario));
});
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
        if(info.size>256*1024)throw Error('tooLarge');
        const s=parseJson(await readFile(full,'utf8'));
        if(s.id!==id || !(await check(s)).valid)throw Error('invalid');
        scenarios.set(id,s);cache.set(id,signature);
      } catch { scenarios.delete(id);cache.delete(id); }
    }
    for(const id of scenarios.keys())if(!builtIn(id)&&!found.has(id)){scenarios.delete(id);cache.delete(id);}
  });
  await refresh();
  const mutateLimit=rateLimit(30,60000);
  app.get('/api/scenarios/custom', async(req,res,next)=>{try{await refresh();res.json({scenarios:[...scenarios.values()].filter(s=>!builtIn(s.id)),builtInIds:['S01','S02','S03']});}catch(e){next(e);}});
  app.post('/api/scenarios/custom',mutateLimit,async(req,res,next)=>{
    try{
      const s=req.body;
      if(builtIn(s?.id))return res.status(403).json({error:'protectedScenario'});
      if(!s || !customId(s.id))return res.status(400).json({error:'invalidScenario'});
      const result=await check(s);
      if(!result.valid)return res.status(400).json({error:'invalidScenario'});
      await serial(async()=>{
        const files=(await readdir(directory)).filter(f=>/^S\d{2}\.json$/.test(f));
        if(!files.includes(s.id+'.json')&&files.length>=50)throw Object.assign(Error('limit'),{status:400});
        const file=filename(s.id),temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
        try{await writeFile(temp,JSON.stringify(s,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
        scenarios.set(s.id,structuredClone(s));cache.delete(s.id);
      });
      res.status(201).json({scenario:s,builtIn:false});
    }catch(e){next(e);}
  });
  app.delete('/api/scenarios/custom/:id',mutateLimit,async(req,res,next)=>{
    try{
      const id=req.params.id;
      if(builtIn(id))return res.status(403).json({error:'protectedScenario'});
      if(!customId(id))return res.status(400).json({error:'invalidScenario'});
      await serial(async()=>{await unlink(filename(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});scenarios.delete(id);cache.delete(id);});res.json({ok:true});
    }catch(e){next(e);}
  });
  return {scenarios,refresh};
}
