import Schema from '@deepseek-ai/schemastery';
import { InfoCardAdapter, PROVIDER_ID } from './lib/native-adapter.mjs';
export const name='schnie-archive';
export const inject=['llm'];
export const Config=Schema.object({
  endpoint:Schema.string().default('').description('支持info-card-sse/1的外部问答接口；HTTPS或本机回环HTTP。').volatile(),
  accessToken:Schema.string().role('secret').default('').description('可选Bearer访问令牌，仅由DSH服务端使用。').volatile(),
  timeoutMs:Schema.natural().min(1000).max(120000).default(60000).description('外部请求完整超时，单位毫秒。').volatile(),
});
export function apply(ctx,config={}){
  const read=key=>typeof config[key]?.get==='function'?config[key].get():config[key];
  ctx.llm.registerAdapter([PROVIDER_ID],new InfoCardAdapter(()=>({
    endpoint:read('endpoint')?.trim()||process.env.DSH_SSE_ENDPOINT?.trim()||'',
    accessToken:read('accessToken')||process.env.DSH_SSE_ACCESS_TOKEN||'',
    timeoutMs:read('timeoutMs')??60000,
  })));
}
