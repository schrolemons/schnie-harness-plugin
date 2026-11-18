import {randomUUID} from 'node:crypto';
import {LlmError} from '@deepseek-ai/dsh-llm';
import {endpointUrl} from './native-adapter.mjs';
import {validateEvidence,MAX_EVIDENCE_BYTES} from '../protocol/evidence-v1.mjs';
export async function fetchEvidence(settings,message,signal,fetcher=fetch){
 const request_id=randomUUID(),controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),Math.min(settings.timeoutMs??25000,120000));
 const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 let reader;
 try{
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  if(settings.accessToken)headers.Authorization=`Bearer ${settings.accessToken}`;
  const url=endpointUrl(settings.endpoint);
  let response;
  try{response=await fetcher(url,{method:'POST',headers,body:JSON.stringify({message,request_id}),signal:combined,redirect:'error',credentials:'omit'});}
  catch(error){if(combined.aborted)throw error;throw new LlmError('无法连接检索接口，请检查后端服务与网络后重试。','EVIDENCE_NETWORK_ERROR');}
  if(!response.ok){await response.body?.cancel();throw new LlmError(`检索接口未接受请求（HTTP ${response.status}）。`,'EVIDENCE_UPSTREAM_ERROR');}
  if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw Error('EVIDENCE_FORMAT_INVALID');
  reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_EVIDENCE_BYTES)throw Error('EVIDENCE_TOO_LARGE');chunks.push(next.value);}
  const value=validateEvidence(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  if(value.request_id!==request_id)throw Error('EVIDENCE_ID_MISMATCH');return value;
 }catch(error){
  if(signal?.aborted)throw new LlmError('检索已取消。','ABORTED');
  if(controller.signal.aborted)throw new LlmError('检索接口超时。','EVIDENCE_TIMEOUT');
  if(error instanceof LlmError)throw error;
  throw new LlmError('检索结果不完整或格式无效，未交给会话模型。','EVIDENCE_FORMAT_INVALID');
 }finally{clearTimeout(timeout);controller.abort();await reader?.cancel().catch(()=>{});reader?.releaseLock();}
}
