import {expect,it,vi} from 'vitest';
import {Context} from '@deepseek-ai/cordis';
import {LlmRuntime,LlmAdapter,createUserMessage,markAgentLoopRequest} from '@deepseek-ai/dsh-llm';
import {SessionStore} from '@deepseek-ai/dsh-session';
import * as plugin from '../index.js';
import {installSessionModel,RECORD_TYPE,transformModelStream} from '../lib/session-model.mjs';
const source={id:'source-1',title:'开发说明',url:'https://docs.example.com/setup',text:'先安装依赖。'};
const evidence={protocol:'info-card-evidence',version:1,request_id:'request-1',sources:[source],overview:'公开总览'};
async function* modelOutput(raw=JSON.stringify({answer:'先安装依赖。[1]',info_card:[{id:'source-1',used:true,order:1}]})){
 yield{type:'block-start',index:0,blockType:'reasoning'};yield{type:'reasoning-delta',index:0,text:'test reasoning'};yield{type:'block-end',index:0,block:{type:'reasoning',text:'test reasoning'}};
 yield{type:'block-start',index:1,blockType:'text'};yield{type:'text-delta',index:1,text:raw};yield{type:'block-end',index:1,block:{type:'text',text:raw}};
 yield{type:'usage',usage:{inputTokens:10,outputTokens:20}};yield{type:'finish',reason:{kind:'stop'},replayState:{response:{native:'original-json-layout'}}};
}
it('保留宿主的思考与用量，正文只采用合法JSON，不复用不匹配的提供方回放数据',async()=>{
 const save=vi.fn(),chunks=[];for await(const c of transformModelStream(modelOutput(),{evidence,onValidated:save}))chunks.push(c);
 expect(chunks.some(c=>c.type==='reasoning-delta')).toBe(true);
 expect(chunks.filter(c=>c.type==='text-delta').map(c=>c.text).join('')).toBe('先安装依赖。[1]');
 expect(chunks.at(-1).replayState).toBeUndefined();expect(save).toHaveBeenCalledOnce();expect(chunks.some(c=>c.type==='usage')).toBe(true);
});
it('错误JSON不显示为答案，也不会生成来源记录',async()=>{
 const save=vi.fn(),chunks=[];await expect((async()=>{for await(const c of transformModelStream(modelOutput('bad json'),{evidence,onValidated:save}))chunks.push(c);})()).rejects.toMatchObject({code:'MODEL_ANSWER_INVALID'});
 expect(save).not.toHaveBeenCalled();expect(chunks.some(c=>c.type==='text-delta')).toBe(false);
});
it('工具调用与空正文不能被记为成功答案',async()=>{
 const save=vi.fn();
 async function* tool(){yield{type:'finish',reason:{kind:'tool-calls'}};}
 await expect((async()=>{for await(const c of transformModelStream(tool(),{evidence,onValidated:save}))void c;})()).rejects.toMatchObject({code:'MODEL_OUTPUT_UNSUPPORTED'});
 await expect((async()=>{for await(const c of transformModelStream(modelOutput(''),{evidence,onValidated:save}))void c;})()).rejects.toMatchObject({code:'MODEL_ANSWER_INVALID'});
 expect(save).not.toHaveBeenCalled();
});
it('仅在知识问答启用时限制当前智能体工具，关闭和卸载后释放',async()=>{
 const ctx=new Context();let endpoint='https://service.example.com/api/retrieve';const release=vi.fn(),restrict=vi.fn(()=>release);
 const agent={ctx:{tools:{restrict}}};
 installSessionModel(ctx,()=>({endpoint}));
 await ctx.parallel('agent/created',{agent});expect(restrict).toHaveBeenCalledWith({allow:[]});
 endpoint='';ctx.emit('agent/status',{agent,status:'running'});expect(release).toHaveBeenCalledOnce();
 await ctx.fiber.dispose();
});
it('正式宿主钩子沿用已选提供方、模型和思考设置，检索接口不接收模型凭据',async()=>{
 const ctx=new Context();await ctx.plugin(LlmRuntime,{});await ctx.plugin(SessionStore,{});
 const session=ctx.sessions.create('session-model-test');let seen;const events=[];
 ctx.on('session/event',(_session,event)=>{events.push(event);});
 class ChosenAdapter extends LlmAdapter{
  providerInfo(){return{id:'chosen',name:'Selected provider'};}
  async resolveModel(){return{provider:'chosen',id:'native',name:'Selected model',reasoning:{efforts:[{id:'low',name:'Low'}]}};}
  async* stream(options){seen=options;yield*modelOutput();}
 }
 const send=vi.fn(async(_url,options)=>{const body=JSON.parse(options.body);expect(Object.keys(body).sort()).toEqual(['message','request_id']);return Response.json({...evidence,request_id:body.request_id});});
 try{
  ctx.llm.registerAdapter(['chosen'],new ChosenAdapter());
  installSessionModel(ctx,()=>({endpoint:'https://service.example.com/api/retrieve'}),send);
  const user=createUserMessage({source:{kind:'user'},content:[{type:'text',text:'安装步骤？'}]});
  const decision=await ctx.waterfall('agent/pre-step',{agent:{session},turn:1,step:1,signal:new AbortController().signal},()=>Promise.resolve({kind:'enter',messages:[user]}));
  const options=markAgentLoopRequest(Object.freeze({provider:'chosen',model:'native',reasoningEffort:'low',messages:decision.messages,sessionId:session.id}));
  const chunks=[];for await(const c of ctx.llm.stream(options))chunks.push(c);
  expect(seen).toMatchObject({provider:'chosen',model:'native',reasoningEffort:'low'});expect(seen.messages).toBe(decision.messages);
  expect(seen.messages.at(-1).content[0].text).toContain('先安装依赖。');
  expect(chunks.filter(c=>c.type==='text-delta').map(c=>c.text).join('')).toBe('先安装依赖。[1]');
  expect(events.some(e=>e.type===RECORD_TYPE&&e.data.provider==='chosen'&&e.data.model==='native')).toBe(true);
 }finally{await ctx.fiber.dispose();}
});
it('默认模式不注册替代提供方，未配置接口时不接管普通会话',async()=>{
 const ctx=new Context();await ctx.plugin(LlmRuntime,{});await ctx.plugin(SessionStore,{});
 try{await ctx.plugin(plugin,{});expect(ctx.llm.listProviders()).toEqual([]);}finally{await ctx.fiber.dispose();}
});
