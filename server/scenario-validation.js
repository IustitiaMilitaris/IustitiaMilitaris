import { readFileSync } from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../schema.json',import.meta.url),'utf8'));
const normIds=new Set(JSON.parse(readFileSync(new URL('../normy.json',import.meta.url),'utf8')).normy.map(n=>n.id));
export function validateCustomScenario(scenario) {
 const details=[];
 const error=(field,code,expected)=>{if(details.length<100)details.push({field,code,...(expected===undefined?{}:{expected})});};
 const type=(value,t)=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t;
 function validate(value,rule,field){
  if(rule.$ref)rule=rule.$ref.slice(2).split('/').reduce((node,key)=>node[key],schema);
  if(rule.type&&!(Array.isArray(rule.type)?rule.type:[rule.type]).some(t=>type(value,t))){error(field,'type',rule.type);return;}
  if(rule.enum&&!rule.enum.includes(value))error(field,'enum',rule.enum);
  if(typeof value==='string'){
   if(rule.minLength!==undefined&&[...value].length<rule.minLength)error(field,'minLength',rule.minLength);
   if(rule.pattern&&(!new RegExp(rule.pattern,'u').test(value)||value.endsWith('\n')))error(field,'pattern',rule.pattern);
   if(rule.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))error(field,'date');
  }
  if(typeof value==='number'){
   if(rule.minimum!==undefined&&value<rule.minimum)error(field,'minimum',rule.minimum);
   if(rule.maximum!==undefined&&value>rule.maximum)error(field,'maximum',rule.maximum);
  }
  if(Array.isArray(value)){
   if(rule.minItems!==undefined&&value.length<rule.minItems)error(field,'minItems',rule.minItems);
   if(rule.maxItems!==undefined&&value.length>rule.maxItems)error(field,'maxItems',rule.maxItems);
   if(rule.items)value.forEach((item,i)=>validate(item,rule.items,`${field}[${i}]`));
  }else if(type(value,'object')){
   for(const key of rule.required||[])if(!Object.hasOwn(value,key))error(`${field}.${key}`,'required');
   for(const [key,item]of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(key))error(`${field}.${key}`,'unsafeJson');
    else if(rule.properties&&Object.hasOwn(rule.properties,key))validate(item,rule.properties[key],`${field}.${key}`);
    else if(rule.additionalProperties===false)error(`${field}.${key}`,'additionalProperty');
   }
  }
 }
 validate(scenario,schema,'scenario');
 if(details.length)return {valid:false,errors:details};
 const nodes=new Map(scenario.vuzly.map(n=>[n.id,n])),options=new Set(),roles=new Set(),refs=new Set(scenario.normy.map(n=>n.id));
 if(nodes.size!==scenario.vuzly.length)error('scenario.vuzly','duplicate');
 for(const role of scenario.diiovi_osoby){if(roles.has(role.id))error('scenario.diiovi_osoby','duplicate');roles.add(role.id);}
 if(scenario.diiovi_osoby.filter(r=>r.hravets===true).length!==1)error('scenario.diiovi_osoby','playerRole');
 const start=nodes.get(scenario.pochatkovyi_vuzol);
 if(!start)error('scenario.pochatkovyi_vuzol','missingNode');
 else if(start.varianty.length<3||start.varianty.length>4)error('scenario.pochatkovyi_vuzol','startOptions');
 for(const [i,ref]of scenario.normy.entries())if(!normIds.has(ref.id))error(`scenario.normy[${i}].id`,'unknownNorm',ref.id);
 scenario.vuzly.forEach((node,i)=>node.varianty.forEach((option,j)=>{
  const field=`scenario.vuzly[${i}].varianty[${j}]`;
  if(options.has(option.id))error(field+'.id','duplicate');options.add(option.id);
  if(!/^[A-Z][0-9]?$/.test(option.id)||option.id.length>2)error(field+'.id','pattern','^[A-Z][0-9]?$');
  if(option.nastupnyi_vuzol!==null&&!nodes.has(option.nastupnyi_vuzol))error(field+'.nastupnyi_vuzol','missingNode');
  option.normy.forEach(id=>{if(!normIds.has(id))error(field+'.normy','unknownNorm',id);else if(!refs.has(id))error(field+'.normy','rootNorm',id);});
 }));
 if(start){const visited=new Set(),queue=[start.id];while(queue.length){const id=queue.pop();if(visited.has(id)||!nodes.has(id))continue;visited.add(id);for(const option of nodes.get(id).varianty)if(option.nastupnyi_vuzol)queue.push(option.nastupnyi_vuzol);}for(const id of nodes.keys())if(!visited.has(id))error('scenario.vuzly','unreachable',id);}
 return {valid:!details.length,errors:details};
}
