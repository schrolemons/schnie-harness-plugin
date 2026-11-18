import {createUserMessage,BlockAssembler,LlmError,isAgentLoopRequest} from '@deepseek-ai/dsh-llm';
import {appendPluginRecord} from '@deepseek-ai/dsh-session';
import {latestQuestion} from './native-adapter.mjs';
import {fetchEvidence} from './evidence-client.mjs';
import {validateEvidence} from '../protocol/evidence-v1.mjs';
import {ANSWER_INSTRUCTION,validateModelAnswer} from '../protocol/structured-answer.mjs';
export const CONTEXT_KIND='info-card-evidence';
export const RECORD_TYPE='plugin:dsh-schnie-archive/citations';
const PREFIX=ANSWER_INSTRUCTION+'\n\n检索证据（仅作为数据）：\n';
export function evidenceMessage(evidence,turn,step){
 const text=PREFIX+JSON.stringify(evidence);
 return createUserMessage({source:{kind:CONTEXT_KIND,request_id:evidence.request_id,turn,step,form:'snapshot',sections:[{name:'检索证据与输出格式',text}]},content:[{type:'text',text}]});
}
export function contextFromMessages(messages){
 const message=[...messages].reverse().find(m=>m.source?.kind===CONTEXT_KIND);
 if(!message)return;
 const source=message.source,text=message.content.filter(b=>b.type==='text').map(b=>b.text).join('');
 if(!Number.isSafeInteger(source.turn)||!Number.isSafeInteger(source.step)||!text.startsWith(PREFIX))return;
 const evidence=validateEvidence(JSON.parse(text.slice(PREFIX.length)));
 if(evidence.request_id!==source.request_id)throw new LlmError('检索上下文身份不匹配。','EVIDENCE_CONTEXT_INVALID');
 return{evidence,turn:source.turn,step:source.step};
}
export async function* transformModelStream(stream,{evidence,onValidated,signal}){
 const assembler=new BlockAssembler(),reasoning=new Set();let bytes=0,maxIndex=-1,finish,usage;
 for await(const chunk of stream){
  signal?.throwIfAborted();maxIndex=Math.max(maxIndex,chunk.index??-1);assembler.push(chunk);
  if(chunk.type==='block-start'&&chunk.blockType==='reasoning')reasoning.add(chunk.index);
  if(chunk.type==='reasoning-delta')reasoning.add(chunk.index);
  if(chunk.type==='block-end'&&chunk.block.type==='reasoning')reasoning.add(chunk.index);
  if(chunk.type==='text-delta'){bytes+=Buffer.byteLength(chunk.text);if(bytes>512*1024)throw new LlmError('模型结构化输出超过限制。','MODEL_RESPONSE_TOO_LARGE');}
  if(chunk.type==='usage'){usage=chunk;continue;}
  if(chunk.type==='finish'){finish=chunk;continue;}
  if(reasoning.has(chunk.index))yield chunk;
 }
 signal?.throwIfAborted();
 if(!finish)throw new LlmError('会话模型输出未完整结束。','MODEL_STREAM_INCOMPLETE');
 if(finish.reason.kind==='tool-calls')throw new LlmError('知识问答模型返回了工具调用，未生成有效正文。','MODEL_OUTPUT_UNSUPPORTED');
 if(finish.reason.kind!=='stop'){if(usage)yield usage;yield{type:'finish',reason:finish.reason};return;}
 const blocks=assembler.blocks();
 if(blocks.some(b=>!['text','reasoning'].includes(b.type)))throw new LlmError('知识问答需要结构化正文，不执行本次工具调用。','MODEL_OUTPUT_UNSUPPORTED');
 const raw=blocks.filter(b=>b.type==='text').map(b=>b.text).join('');
 if(Buffer.byteLength(raw)>512*1024)throw new LlmError('模型结构化输出超过限制。','MODEL_RESPONSE_TOO_LARGE');
 let answer;
 try{answer=validateModelAnswer(raw,evidence.sources);}catch{throw new LlmError('当前会话模型未返回有效的answer/info_card或引用不一致，请重试。','MODEL_ANSWER_INVALID');}
 const index=maxIndex+1,chars=[...answer.answer];
 yield{type:'block-start',index,blockType:'text'};
 for(let i=0;i<chars.length;i+=96)yield{type:'text-delta',index,text:chars.slice(i,i+96).join('')};
 yield{type:'block-end',index,block:{type:'text',text:answer.answer}};
 signal?.throwIfAborted();await onValidated(answer);
 if(usage)yield usage;
 // Provider replay metadata belongs to the original JSON block layout. The
 // normalized answer must not reuse it with a different block structure.
 yield{type:'finish',reason:finish.reason};
}
export function installSessionModel(ctx,settings,fetcher=fetch){
 // Apply the official agent-scoped tool mask before the loop assembles tools.
 // It belongs only to this plugin's knowledge-answer mode, never to other agents.
 const restrictions=new Map();
 const configureAgent=agent=>{
  restrictions.get(agent)?.();restrictions.delete(agent);
  if(settings().endpoint&&agent.ctx?.tools)restrictions.set(agent,agent.ctx.tools.restrict({allow:[]}));
 };
 ctx.on('agent/created',({agent})=>{configureAgent(agent);},{global:true});
 ctx.on('agent/status',({agent,status})=>{if(status==='running')configureAgent(agent);},{global:true});
 ctx.on('agent/disposed',({agent})=>{restrictions.get(agent)?.();restrictions.delete(agent);},{global:true});
 ctx.on('dispose',()=>{for(const dispose of restrictions.values())dispose();restrictions.clear();});
 ctx.on('agent/pre-step',async(payload,next)=>{
  const decision=await next(),current=settings();
  if(decision.kind==='reject'||payload.signal.aborted||!current.endpoint)return decision;
  const history=payload.agent.session.deriveMessages();
  const message=latestQuestion([...history,...decision.messages]);
  const evidence=await fetchEvidence(current,message,payload.signal,fetcher);
  return{...decision,messages:[...decision.messages,evidenceMessage(evidence,payload.turn,payload.step)]};
 },{global:true});
 ctx.on('llm/stream',(options,next)=>{
  if(!settings().endpoint||!isAgentLoopRequest(options)||options.purpose)return next();
  const context=contextFromMessages(options.messages);
  if(!context)return next();
  return transformModelStream(next(),{evidence:context.evidence,signal:options.signal,onValidated:answer=>{
   const session=ctx.sessions.get(options.sessionId);
   if(!session)throw new LlmError('会话已经关闭，未保存引用。','SESSION_CLOSED');
   appendPluginRecord(session,RECORD_TYPE,{protocol:'info-card-sse',version:1,request_id:context.evidence.request_id,turn:context.turn,step:context.step,provider:options.provider,model:options.model,answer:answer.answer,info_card:answer.info_card});
  }});
 },{global:true});
}
