import { expect,it } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import { LlmRuntime } from '@deepseek-ai/dsh-llm';
import * as plugin from '../index.js';
import { createExampleServer } from '../examples/sse-server.mjs';
import { once } from 'node:events';
it('实际Cordis与LLM注册表挂载、调用非RAG HTTP流并卸载',async()=>{
 const server=createExampleServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const ctx=new Context();
 try{
  await ctx.plugin(LlmRuntime,{});
  const mounted=await ctx.plugin(plugin,{endpoint:`http://127.0.0.1:${server.address().port}/api/chat`,accessToken:'example-only-token'});
  const providers=await ctx.llm.listProviders();
  expect(providers.some(p=>p.id==='external-sse')).toBe(true);
  const chunks=[];
  for await(const chunk of ctx.llm.stream({provider:'external-sse',model:'answer',messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'测试原生输入'}]}]}))chunks.push(chunk);
  expect(chunks.at(-1)).toMatchObject({type:'finish',replayState:{response:{info_card:[{id:'sse-spec'}]}}});
  await mounted.dispose();
  expect((await ctx.llm.listProviders()).some(p=>p.id==='external-sse')).toBe(false);
 }finally{await ctx.fiber.dispose();await new Promise(resolve=>server.close(resolve));}
});
