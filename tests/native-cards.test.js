import { expect, it } from 'vitest';
import { cardsFromEvent, referenceDefinition } from '../ui/native-cards.js';
const card={id:'doc-1',title:'示例原文',url:'https://docs.example.com/a',excerpt:'文字',used:true,order:1};
const event=(extra={})=>({type:'assistant/message',surfaceOp:'append',seq:10,data:{turn:1,step:1,message:{content:[{type:'text',text:'回答[1]'}],source:{kind:'model',provider:'external-sse',model:'answer',replayState:{response:{protocol:'info-card-sse',version:1,request_id:'request-1',text_length:5,info_card:[card]}}}},...extra}});
it('仅采用外部问答路由在完整回答中持久保存的卡片，支持会话回放',()=>{
  expect(cardsFromEvent(event())).toEqual([card]);
  const bad=event();bad.data.message.source.provider='other';expect(cardsFromEvent(bad)).toEqual([]);
  expect(cardsFromEvent(event({interrupted:true}))).toEqual([]);
  const context={key:'references:1:1',id:'1:1',start:{event:{type:'step/start'},location:{kind:'step'}},matches:[{event:event()}]};
  expect(referenceDefinition.buildViewNode(context)).toMatchObject({visibility:'visible',groupTree:'turn',data:{cards:[card]}});
});
it('修订、重试、计数不符或恶意网址不会沿用旧卡片',()=>{
  const changed=event();changed.data.message.content=[{type:'text',text:'修订'}];expect(cardsFromEvent(changed)).toEqual([]);
  const bad=event();bad.data.message.source.replayState.response.info_card[0]={...card,url:'javascript:alert(1)'};expect(cardsFromEvent(bad)).toEqual([]);
  const context={key:'ref:1:1',id:'1:1',start:{location:{kind:'step'},event:{type:'step/start'}},matches:[{event:{type:'llm/retry',seq:11}}]};
  expect(referenceDefinition.buildViewNode(context).visibility).toBe('hidden');
});
