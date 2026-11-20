import { mkdirSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rename, unlink, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCustomScenario } from './scenario-validation.js';
import { randomBytes } from 'node:crypto';
import { parseJson, rateLimit } from './security.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const customId=id=>typeof id==='string'&&/^S(0[4-9]|[1-9][0-9])$/.test(id)&&id.length===3;
const builtIn=id=>['S01','S02','S03'].includes(id);
const token=()=>randomBytes(16).toString('hex');
const failure=(code,status=400,field='image')=>Object.assign(Error(code),{status,details:[{field,code}]});
const extensions=['png','jpg','webp'];
export function decodeScenarioImage(data){
 if(typeof data!=='string')throw failure('invalidImage');
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match||match[2].length>Math.ceil(2*1024*1024/3)*4)throw failure('invalidImage');
 const buffer=Buffer.from(match[2],'base64');
 if(buffer.length>2*1024*1024)throw failure('imageTooLarge');
 if(buffer.toString('base64')!==match[2])throw failure('invalidImage');
 let ext;
 if(buffer.length>=24&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.toString('ascii',12,16)==='IHDR'&&buffer.readUInt32BE(16)>0&&buffer.readUInt32BE(20)>0&&buffer.readUInt32BE(16)<=8192&&buffer.readUInt32BE(20)<=8192)ext='png';
 else if(buffer.length>=4&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255&&buffer.at(-2)===255&&buffer.at(-1)===217)ext='jpg';
 else if(buffer.length>=20&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'&&buffer.readUInt32LE(4)+8===buffer.length&&['VP8 ','VP8L','VP8X'].includes(buffer.toString('ascii',12,16)))ext='webp';
 if(!ext||({png:'png',jpeg:'jpg',webp:'webp'})[match[1]]!==ext)throw failure('invalidImage');
 return {buffer,ext};
}
export async function installCustomScenarios(app,dataDirectory){
 const directory=path.resolve(dataDirectory,'custom-scenarios'),images=path.join(directory,'images'),metaFile=path.join(directory,'.catalog-meta.json');
 await mkdir(directory,{recursive:true,mode:0o700});
 const scenarios=new Map();for(const file of await readdir(path.join(root,'stsenarii')))if(file.endsWith('.json')){const s=parseJson(await readFile(path.join(root,'stsenarii',file),'utf8'));scenarios.set(s.id,s);}
 let meta={};try{meta=parseJson(await readFile(metaFile,'utf8'));if(!meta||typeof meta!=='object'||Array.isArray(meta))meta={};}catch{}
 let queue=Promise.resolve();const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
 const cache=new Map();
 const fileFor=id=>{if(!customId(id))throw failure('customId',400,'scenario.id');const full=path.resolve(directory,id+'.json');if(path.dirname(full)!==directory)throw failure('customId');return full;};
 const atomic=async(file,data)=>{mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+token()+'.tmp';try{await writeFile(temp,data,{mode:0o600,flag:'wx'});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}};
 const metadataFor=id=>{if(!meta[id]||typeof meta[id].key!=='string'||typeof meta[id].revision!=='string')meta[id]={key:token(),revision:token()};return meta[id];};
 const imageFor=async id=>{for(const ext of extensions){const file=path.join(images,id+'.'+ext);try{const info=await lstat(file);if(info.isFile()&&info.size<=2*1024*1024)return {file,ext};}catch{}}return null;};
 const eraseImage=async id=>{for(const ext of extensions)await unlink(path.join(images,id+'.'+ext)).catch(e=>{if(e.code!=='ENOENT')throw e;});};
 const customCases=()=>[...scenarios.values()].filter(s=>customId(s.id)).sort((a,b)=>a.id.localeCompare(b.id));
 const listing=async()=>({scenarios:customCases(),metadata:Object.fromEntries(await Promise.all(customCases().map(async s=>{const m=metadataFor(s.id);return [s.id,{...m,customImageUrl:await imageFor(s.id)?`/api/scenarios/custom/${s.id}/image?v=${m.revision}`:null}];}))),builtInIds:['S01','S02','S03']});
 const refresh=()=>serial(async()=>{
  mkdirSync(directory,{recursive:true,mode:0o700});const found=new Set();
  for(const file of (await readdir(directory)).filter(f=>/^S(0[4-9]|[1-9][0-9])\.json$/.test(f)).sort().slice(0,50)){
   const id=file.slice(0,-5);found.add(id);try{const full=fileFor(id),info=await stat(full),signature=`${info.mtimeMs}:${info.size}`;if(cache.get(id)===signature)continue;if(info.size>2*1024*1024)throw Error('tooLarge');const s=parseJson(await readFile(full,'utf8'));if(s.id!==id||!validateCustomScenario(s).valid)throw Error('invalid');scenarios.set(id,s);metadataFor(id);cache.set(id,signature);}catch{scenarios.delete(id);cache.delete(id);}
  }
  for(const id of scenarios.keys())if(customId(id)&&!found.has(id)){scenarios.delete(id);delete meta[id];cache.delete(id);}
  await atomic(metaFile,JSON.stringify(meta,null,2));
 });
 await refresh();
 const repository={scenarios,refresh,metadataFor,onRenumber:async()=>{}};
 const sendError=(res,e)=>res.status(e.status||500).json({error:e.status?e.message:e.code==='EACCES'||e.code==='EPERM'?'storagePermission':e.code==='ENOSPC'?'storageFull':'storageFailed',details:e.details||[{field:'storage',code:e.code||'storageFailed'}]});
 const guardRevision=(id,revision)=>{if(revision!==undefined&&revision!==metadataFor(id).revision)throw failure('staleScenario',409,'scenario.id');};
 const mutateLimit=rateLimit(30,60000);
 app.get('/api/scenarios/custom',async(req,res)=>{try{await refresh();res.json(await serial(listing));}catch(e){sendError(res,e);}});
 app.get('/api/scenarios/custom/:id/image',async(req,res)=>{try{if(!customId(req.params.id))throw failure('customId');const image=await serial(async()=>{if(!scenarios.has(req.params.id)||(req.query.v&&req.query.v!==metadataFor(req.params.id).revision))return null;const found=await imageFor(req.params.id);return found?{ext:found.ext,buffer:await readFile(found.file)}:null;});if(!image)return res.sendStatus(404);res.set({'Content-Type':image.ext==='jpg'?'image/jpeg':'image/'+image.ext,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}).send(image.buffer);}catch(e){if(e.code==='ENOENT')return res.sendStatus(404);sendError(res,e);}});
 app.post('/api/scenarios/custom',mutateLimit,async(req,res)=>{try{
  const wrapped=!!req.body&&Object.hasOwn(req.body,'scenario');
  if(wrapped&&Object.keys(req.body).some(k=>!['scenario','imageDataUrl','removeImage','revision'].includes(k)))throw failure('invalidRequest');
  const s=wrapped?req.body.scenario:req.body;
  if(builtIn(s?.id))throw failure('protectedScenario',403,'scenario.id');
  if(!customId(s?.id))throw failure('customId',400,'scenario.id');
  if(wrapped&&req.body.removeImage!==undefined&&typeof req.body.removeImage!=='boolean')throw failure('invalidImage');
  if(wrapped&&req.body.removeImage&&req.body.imageDataUrl!==undefined)throw failure('invalidImage');
  const result=validateCustomScenario(s);if(!result.valid)return res.status(400).json({error:'invalidScenario',details:result.errors});
  const image=wrapped&&req.body.imageDataUrl!==undefined?decodeScenarioImage(req.body.imageDataUrl):null;
  const serialized=JSON.stringify(s,null,2)+'\n';if(Buffer.byteLength(serialized)>2*1024*1024)throw failure('storedScenarioTooLarge',413,'scenario');
  const response=await serial(async()=>{
   mkdirSync(directory,{recursive:true,mode:0o700});const exists=scenarios.has(s.id);
   if(exists)guardRevision(s.id,wrapped?req.body.revision:undefined);
   else if(wrapped&&req.body.revision!==undefined&&req.body.revision!=='new')throw failure('staleScenario',409,'scenario.id');
   if(!exists&&(await readdir(directory)).filter(file=>/^S[0-9]{2}\.json$/.test(file)&&file!==s.id+'.json').length>=50)throw failure('scenarioLimit');

   const previousJson=exists?await readFile(fileFor(s.id)).catch(e=>{if(e.code==='ENOENT')return null;throw e;}):null;const previousMeta=structuredClone(meta);const previousImage=await imageFor(s.id);const previousImageData=previousImage?await readFile(previousImage.file):null;
   try {
   await atomic(fileFor(s.id),serialized);
   if(image){await atomic(path.join(images,s.id+'.'+image.ext),image.buffer);for(const ext of extensions)if(ext!==image.ext)await unlink(path.join(images,s.id+'.'+ext)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
   else if(wrapped&&req.body.removeImage)await eraseImage(s.id);
   scenarios.set(s.id,structuredClone(s));cache.delete(s.id);const m=metadataFor(s.id);m.revision=token();await atomic(metaFile,JSON.stringify(meta,null,2));return {scenario:s,builtIn:false,...await listing()};
   } catch(error) {meta=previousMeta;if(exists&&previousJson)scenarios.set(s.id,parseJson(previousJson.toString('utf8')));else scenarios.delete(s.id);cache.delete(s.id);try{if(previousJson)await atomic(fileFor(s.id),previousJson);else await unlink(fileFor(s.id)).catch(()=>{});await eraseImage(s.id);if(previousImage&&previousImageData)await atomic(previousImage.file,previousImageData);await atomic(metaFile,JSON.stringify(meta,null,2));}catch{}throw error;}
  });res.json(response);
 }catch(e){sendError(res,e);}});
 app.delete('/api/scenarios/custom/:id',mutateLimit,async(req,res)=>{try{
  const id=req.params.id;if(builtIn(id))throw failure('protectedScenario',403,'scenario.id');if(!customId(id))throw failure('customId',400,'scenario.id');
  const response=await serial(async()=>{
   if(!scenarios.has(id))throw failure('staleScenario',409,'scenario.id');guardRevision(id,req.headers['if-match']);
   const survivors=[];for(const s of customCases().filter(s=>s.id!==id)){const image=await imageFor(s.id);survivors.push({source:s,metadata:{...metadataFor(s.id)},image:image?{ext:image.ext,buffer:await readFile(image.file)}:null});}
   const mapping={};survivors.forEach((item,i)=>{mapping[item.source.id]='S'+String(i+4).padStart(2,'0');});
   // Capture all source data before moving any slot; readers and writers share this queue.
   await unlink(fileFor(id));await eraseImage(id);
   for(const item of survivors){const target=mapping[item.source.id],next={...item.source,id:target};await atomic(fileFor(target),JSON.stringify(next,null,2)+'\n');if(target!==item.source.id)await unlink(fileFor(item.source.id));await eraseImage(item.source.id);await eraseImage(target);if(item.image)await atomic(path.join(images,target+'.'+item.image.ext),item.image.buffer);}
   for(const key of [...scenarios.keys()])if(customId(key))scenarios.delete(key);
   const nextMeta={};for(const item of survivors){const target=mapping[item.source.id];scenarios.set(target,{...item.source,id:target});nextMeta[target]={key:item.metadata.key,revision:token()};}meta=nextMeta;cache.clear();await atomic(metaFile,JSON.stringify(meta,null,2));await repository.onRenumber(mapping,id);
   return {ok:true,deletedId:id,mapping,...await listing()};
  });res.json(response);
 }catch(e){sendError(res,e);}});
 return repository;
}
