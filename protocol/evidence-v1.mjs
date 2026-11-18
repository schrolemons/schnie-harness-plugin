import { safeCardUrl } from './info-card-v1.mjs';
export const EVIDENCE_PROTOCOL='info-card-evidence';
export const MAX_EVIDENCE_BYTES=1024*1024;
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
export function validateEvidence(value){
 const fail=()=>{throw new Error('EVIDENCE_FORMAT_INVALID');};
 if(!value||value.protocol!==EVIDENCE_PROTOCOL||value.version!==1||!id(value.request_id)||Object.keys(value).some(k=>!['protocol','version','request_id','sources','overview'].includes(k))||!Array.isArray(value.sources)||value.sources.length>10||typeof value.overview!=='string'||new TextEncoder().encode(value.overview).length>512*1024)fail();
 const ids=new Set();let total=0;
 const sources=value.sources.map(s=>{
  if(!s||Object.keys(s).some(k=>!['id','title','url','text'].includes(k))||!id(s.id)||ids.has(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>160||!safeCardUrl(s.url)||typeof s.text!=='string'||!s.text.trim()||s.text.length>6000)fail();
  ids.add(s.id);total+=s.text.length;return{id:s.id,title:s.title,url:s.url,text:s.text};
 });
 if(total>60000||new TextEncoder().encode(JSON.stringify(value)).length>MAX_EVIDENCE_BYTES)fail();
 return{protocol:EVIDENCE_PROTOCOL,version:1,request_id:value.request_id,sources,overview:value.overview};
}
