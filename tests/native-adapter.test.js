import { expect, it, vi } from 'vitest';
import { InfoCardAdapter, PROVIDER_ID } from '../lib/native-adapter.mjs';
import { encodeEvent } from '../protocol/info-card-v1.mjs';
const card={id:'source-1',title:'SSE说明',url:'https://docs.example.com/sse',excerpt:'通用流接口。',used:true,order:1};
function fetcher() { return vi.fn(async (_url,options)=>{
  const {request_id}=JSON.parse(options.body);
  const frames=[['meta',{protocol:'info-card-sse',version:1}],['text_delta',{text:'外部回答[1]'}],['info_card',{info_card:[card]}],['done',{text_length:7,card_count:1}]];
  return new Response(frames.map(([type,value],seq)=>encodeEvent(type,{request_id,seq,...value})).join(''),{headers:{'content-type':'text/event-stream'}});
}); }
it('把原生会话的当前问题发给通用SSE服务，不上传系统提示词、宿主凭据或聊天历史',async()=>{
  const send=fetcher(),adapter=new InfoCardAdapter(()=>({endpoint:'https://service.example.com/api/chat',accessToken:'fixture-token',timeoutMs:30000}),send);
  const chunks=[];for await(const chunk of adapter.stream({provider:PROVIDER_ID,model:'answer',system:'private-system',messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'previous-private'}]},{role:'assistant',content:[{type:'text',text:'previous-answer'}]},{role:'user',source:{kind:'user'},content:[{type:'text',text:'当前问题'}]}]}))chunks.push(chunk);
  expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({message:'当前问题'});
  expect(send.mock.calls[0][1].body).not.toMatch(/private|previous|fixture-token/);
  expect(chunks.filter(c=>c.type==='text-delta').map(c=>c.text).join('')).toBe('外部回答[1]');
  expect(chunks.at(-1)).toMatchObject({type:'finish',reason:{kind:'stop'},replayState:{response:{info_card:[card]}}});
  expect((await adapter.listModels(PROVIDER_ID))[0].id).toBe('answer');
});
it('不接受普通OpenAI流、未完成的流或错误协议，不生成来源元数据',async()=>{
  const adapter=new InfoCardAdapter(()=>({endpoint:'https://service.example.com/api/chat',timeoutMs:1000}),async()=>new Response('data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}}));
  const seen=[];await expect((async()=>{for await(const chunk of adapter.stream({messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'问题'}]}]}))seen.push(chunk);})()).rejects.toThrow();
  expect(seen.some(chunk=>chunk.type==='finish')).toBe(false);
});
it('已取消请求不联网，地址只能由部署者配置',async()=>{
  const send=fetcher(),controller=new AbortController();controller.abort();
  const adapter=new InfoCardAdapter(()=>({endpoint:'https://service.example.com/api/chat'}),send);
  await expect((async()=>{for await(const _ of adapter.stream({signal:controller.signal,messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'问题'}]}]})){} })()).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
it('只提取用户来源的问题，跳过宿主注入的同角色时间消息',async()=>{
 const send=fetcher(),adapter=new InfoCardAdapter(()=>({endpoint:'https://service.example.com/api/chat'}),send);
 const messages=[{role:'user',source:{kind:'user'},content:[{type:'text',text:'真正的问题'}]},{role:'user',source:{kind:'time-context'},content:[{type:'text',text:'private-host-time-context'}]}];
 for await(const _ of adapter.stream({messages})){}
 expect(JSON.parse(send.mock.calls[0][1].body).message).toBe('真正的问题');
});
it('标题辅助调用在本地完成，不向外部接口发送宿主提示词',async()=>{
 const send=fetcher(),adapter=new InfoCardAdapter(()=>({}),send),chunks=[];
 for await(const chunk of adapter.stream({purpose:'session-title',messages:[{role:'user',source:{kind:'dsh-session-title-llm'},content:[{type:'text',text:'private-title-input'}]}]}))chunks.push(chunk);
 expect(send).not.toHaveBeenCalled();expect(chunks.at(-1)).toMatchObject({type:'finish'});expect(chunks.some(c=>c.text==='外部问答')).toBe(true);
});
it('历史压缩不会误触发外部问答或上传宿主上下文',async()=>{
 const send=fetcher(),adapter=new InfoCardAdapter(()=>({endpoint:'https://service.example.com/api/chat'}),send);
 await expect((async()=>{for await(const _ of adapter.stream({purpose:'compaction',messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'private-history'}]}]})){} })()).rejects.toMatchObject({code:'SSE_PURPOSE_UNSUPPORTED'});
 expect(send).not.toHaveBeenCalled();
});
