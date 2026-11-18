import { randomUUID } from 'node:crypto';
import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import { createSseDecoder } from '../protocol/info-card-v1.mjs';
export const PROVIDER_ID = 'external-sse';
export const MODEL_ID = 'answer';
const retryPolicy={mode:'normal',maxRetries:0,retryableCodes:[],initialDelayMs:500,maxDelayMs:10000,jitterRatio:0.1};
export function endpointUrl(value) {
  let url;
  try { url=new URL(value); } catch { throw new LlmError('请在插件设置中填写外部SSE接口地址。','SSE_NOT_CONFIGURED'); }
  const local=url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if((!local&&url.protocol!=='https:')||url.username||url.password||url.search||url.hash)throw new LlmError('外部接口需使用无凭据的HTTPS地址，仅本机回环允许HTTP。','SSE_ENDPOINT_INVALID');
  return url.href;
}
export function latestQuestion(messages=[]) {
  const message=[...messages].reverse().find(item=>item.role==='user'&&item.source?.kind==='user');
  const text=Array.isArray(message?.content)?message.content.filter(block=>block.type==='text').map(block=>block.text).join('\n').trim():'';
  if(!text||text.length>8000)throw new LlmError('请输入不超过8000字符的文本问题。','SSE_INPUT_INVALID');
  return text;
}
export class InfoCardAdapter extends LlmAdapter {
  constructor(settings,fetcher=fetch){super();this.settings=settings;this.fetcher=fetcher;}
  providerInfo(provider){return{id:provider,name:'外部问答（SSE）'};}
  providerRetryPolicy(){return retryPolicy;}
  async listModels(provider){return[{provider,id:MODEL_ID,name:'外部问答（SSE）',description:'将当前问题交给配置的服务，并在DSH中显示正文与来源卡片。',inputModalities:['text']}];}
  async resolveModel(provider,model){if(model!==MODEL_ID)throw new LlmError('请选择外部问答路由。','SSE_MODEL_INVALID');return(await this.listModels(provider))[0];}
  async *stream(options){
    options.signal?.throwIfAborted();
    if(options.purpose==='compaction')throw new LlmError('外部单次问答路由不支持DSH历史压缩。','SSE_PURPOSE_UNSUPPORTED');
    // DSH also routes auxiliary title calls through the chosen provider. They
    // must not become another external answer request or upload host prompts.
    if(options.purpose==='session-title'){
      const text='外部问答';
      yield{type:'block-start',index:0,blockType:'text'};
      yield{type:'text-delta',index:0,text};
      yield{type:'block-end',index:0,block:{type:'text',text}};
      yield{type:'finish',reason:{kind:'stop'}};
      return;
    }
    const settings=this.settings(),endpoint=endpointUrl(settings.endpoint),message=latestQuestion(options.messages),requestId=randomUUID();
    const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
    const timeoutMs=settings.timeoutMs??60000;
    if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new LlmError('外部请求超时配置无效。','SSE_CONFIG_INVALID');
    const timer=setTimeout(()=>controller.abort(new Error('SSE_TIMEOUT')),timeoutMs);
    let reader,text='';
    try{
      const headers={'Content-Type':'application/json',Accept:'text/event-stream'};
      if(settings.accessToken)headers.Authorization=`Bearer ${settings.accessToken}`;
      const response=await this.fetcher(endpoint,{method:'POST',headers,body:JSON.stringify({message,request_id:requestId}),credentials:'omit',redirect:'error',signal});
      if(!response.ok){await response.body?.cancel();throw new LlmError(`外部服务未接受请求（HTTP ${response.status}）。`,'SSE_UPSTREAM_ERROR',{status:response.status});}
      if(!/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw new LlmError('接口没有返回约定的SSE响应。','SSE_PROTOCOL_INVALID');
      reader=response.body.getReader();
      let events=[];
      const decoder=createSseDecoder(event=>{if(event.request_id!==requestId)throw new LlmError('流式响应的请求身份不匹配。','SSE_PROTOCOL_INVALID');events.push(event);});
      yield{type:'block-start',index:0,blockType:'text'};
      while(true){
        signal.throwIfAborted();
        const next=await reader.read();if(next.done)break;
        decoder.push(next.value);
        for(const event of events)if(event.type==='text_delta'){text+=event.text;yield{type:'text-delta',index:0,text:event.text};}
        events=[];
      }
      const result=decoder.finish();
      yield{type:'block-end',index:0,block:{type:'text',text}};
      yield{type:'finish',reason:{kind:'stop'},replayState:{response:{protocol:'info-card-sse',version:1,request_id:result.request_id,text_length:[...text].length,info_card:result.all_cards}}};
    }catch(error){
      if(options.signal?.aborted)throw new LlmError('外部问答已取消。','ABORTED');
      if(controller.signal.aborted)throw new LlmError('外部问答超时。','TIMEOUT');
      if(error instanceof LlmError)throw error;
      throw new LlmError('外部响应不完整或格式无效；未采用引用卡片。','SSE_PROTOCOL_INVALID');
    }finally{clearTimeout(timer);controller.abort();await reader?.cancel().catch(()=>{});reader?.releaseLock();}
  }
}
