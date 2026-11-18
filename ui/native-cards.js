import React from 'react';
import { validateCards } from '../protocol/info-card-v1.mjs';
const KIND='info-card-sources';
const RECORD_TYPE='plugin:dsh-schnie-archive/citations';
export function cardsFromRecord(event,record){
 try{
  if(event?.type!=='assistant/message'||event.data?.interrupted||record?.type!==RECORD_TYPE||record.ignorable!==true)return[];
  const data=record.data,source=event.data.message?.source;
  if(data?.protocol!=='info-card-sse'||data.version!==1||typeof data.request_id!=='string'||!source||source.kind!=='model'||source.provider!==data.provider||source.model!==data.model||data.turn!==event.data.turn||data.step!==event.data.step)return[];
  const text=event.data.message.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  if(text!==data.answer)return[];
  return validateCards(data.info_card).filter(c=>c.used).sort((a,b)=>a.order-b.order);
 }catch{return[];}
}
export function cardsFromEvent(event){
  try{
    if(event?.type!=='assistant/message'||event.data?.interrupted)return[];
    const message=event.data.message,source=message?.source;
    if(source?.kind!=='model'||source.provider!=='external-sse'||source.model!=='answer')return[];
    const payload=source.replayState?.response??source.replayState;
    if(payload?.protocol!=='info-card-sse'||payload.version!==1||typeof payload.request_id!=='string')return[];
    const text=message.content.filter(block=>block.type==='text').map(block=>block.text).join('');
    if(payload.text_length!==[...text].length)return[];
    return validateCards(payload.info_card).filter(card=>card.used).sort((a,b)=>a.order-b.order);
  }catch{return[];}
}
export const referenceDefinition={
  kind:KIND,target:'chat',
  match(event){
    if(!['step/start','assistant/message','llm/retry',RECORD_TYPE].includes(event.type)||!Number.isSafeInteger(event.data?.turn)||!Number.isSafeInteger(event.data?.step))return null;
    return{id:`${event.data.turn}:${event.data.step}`,role:event.type==='step/start'?'start':'update'};
  },
  start(){return{};},update(context){return context.state;},
  buildViewNode(context){
    const events=[context.start?.event,...context.matches.map(m=>m.event)].filter(Boolean);
    const reset=events.findLastIndex(e=>e.type==='step/start'||e.type==='llm/retry');
    const current=events.slice(reset+1),event=current.findLast(e=>e.type==='assistant/message');
    const record=current.findLast(e=>e.type===RECORD_TYPE);
    const cards=record?cardsFromRecord(event,record):cardsFromEvent(event);
    return{key:context.key,id:context.id,kind:KIND,target:'chat',location:context.start?.location??context.matches.at(-1)?.location??{kind:'unresolved'},groupTree:'turn',anchorSeq:(event?.seq??0)+0.001,visibility:cards.length?'visible':'hidden',data:{cards}};
  },
};
export function SourceCards({node}){
  const h=React.createElement,cards=node.data.cards;
  if(!cards?.length)return null;
  return h('nav',{'aria-label':'回答引用来源','data-info-card-sources':'',style:{border:'1px solid var(--dsw-alias-outline-primary,rgba(127,127,127,.2))',borderRadius:12,padding:'12px 16px',margin:'12px 0',fontSize:13,lineHeight:1.6,overflowWrap:'anywhere'}},
    h('div',{style:{fontSize:12,color:'var(--dsw-alias-label-secondary,#7a8290)',marginBottom:6}},`参考来源 · ${cards.length}`),
    h('ol',{style:{listStyle:'none',margin:0,padding:0}},...cards.map(card=>h('li',{key:card.id,style:{padding:'9px 0',borderTop:'1px solid var(--dsw-alias-outline-primary,rgba(127,127,127,.14))'}},
      h('a',{href:card.url,target:'_blank',rel:'noopener noreferrer',style:{color:'var(--dsw-alias-link,#367c9a)',fontWeight:600,textDecoration:'none'}},`[${card.order}] ${card.title} ↗`),
      h('div',{style:{fontSize:11,color:'var(--dsw-alias-label-secondary,#7a8290)'}},new URL(card.url).hostname),
      card.excerpt?h('details',null,h('summary',{style:{fontSize:12,cursor:'pointer',marginTop:4}},'查看来源摘要'),h('blockquote',{style:{whiteSpace:'pre-wrap',margin:'8px 0 0',paddingLeft:12,borderLeft:'2px solid #78a5b2',maxHeight:200,overflow:'auto'}},card.excerpt)):null))));
}
export const inject=['uiConversation','slots'];
export function apply(ctx){
  ctx.uiConversation.events.register(referenceDefinition);
  ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:KIND},SourceCards));
}
