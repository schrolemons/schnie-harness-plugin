import Schema from '@deepseek-ai/schemastery';
import { InfoCardAdapter, PROVIDER_ID } from './lib/native-adapter.mjs';
import {installSessionModel} from './lib/session-model.mjs';
export const name='schnie-archive';
export const inject=['llm','sessions'];
export const Config=Schema.object({
  mode:Schema.union(['session-model','external-sse']).default('session-model').description('默认沿用当前DSH会话模型；external-sse仅用于已有外部完整答案流。'),
  endpoint:Schema.string().default('').description('默认模式填写info-card-evidence/1检索接口；external-sse模式填写完整答案流接口。HTTPS或本机回环HTTP。').volatile(),
  accessToken:Schema.string().role('secret').default('').description('可选Bearer访问令牌，仅由DSH服务端使用。').volatile(),
  timeoutMs:Schema.natural().min(1000).max(120000).default(60000).description('外部请求完整超时，单位毫秒。').volatile(),
});
export function apply(ctx,config={}){
  const read=key=>typeof config[key]?.get==='function'?config[key].get():config[key];
  const settings=()=>({
    endpoint:read('endpoint')?.trim()||process.env.DSH_SSE_ENDPOINT?.trim()||'',
    accessToken:read('accessToken')||process.env.DSH_SSE_ACCESS_TOKEN||'',
    timeoutMs:read('timeoutMs')??60000,
  });
  if(read('mode')==='external-sse')ctx.llm.registerAdapter([PROVIDER_ID],new InfoCardAdapter(settings));
  else installSessionModel(ctx,settings);
}
