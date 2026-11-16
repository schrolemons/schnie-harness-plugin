import { afterEach, expect, it, vi } from 'vitest';
import { createKnowledgeClient } from '../lib/knowledge-client.js';
import { apply } from '../index.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('没有显式接口配置时仍可加载，工具调用清楚报错且不发出任何网络请求', async () => {
  vi.stubEnv('DSH_KNOWLEDGE_ENDPOINT', '');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const tools=[];
  apply({tools:{register:tool=>tools.push(tool)},systemPrompt:{section(){}}});
  expect(tools.map(tool=>tool.name)).toEqual(['search_knowledge','knowledge_overview']);
  await expect(tools[0].execute({query:'getting started'},{signal:new AbortController().signal})).rejects.toMatchObject({code:'NOT_CONFIGURED'});
  expect(fetcher).not.toHaveBeenCalled();
});

const credentialURL=new URL('https://example.com/knowledge');
credentialURL.username='fixture-user';credentialURL.password='fixture-password';
it.each(['http://api.example.com/knowledge','http://127.0.0.1.attacker.example/knowledge',credentialURL.href,'https://example.com/knowledge?key=secret'])('拒绝非回环HTTP和URL中的凭据，错误不回显值：%s', endpoint => {
  expect(()=>createKnowledgeClient({endpoint})).toThrow();
  try { createKnowledgeClient({endpoint}); } catch(error) { expect(error.message).not.toContain('secret'); }
});

it('总览上限与服务端一致，以512KiB的UTF-8字节计算', async () => {
  const make=overview=>createKnowledgeClient({endpoint:'https://api.example.com/knowledge',fetcher:async()=>new Response(JSON.stringify({schema:1,operation:'overview',site:'all',sources:[],overview}))});
  expect((await make('a'.repeat(512*1024)).overview()).overview.length).toBe(512*1024);
  await expect(make('字'.repeat(180000)).overview()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
});

it.each(['http://127.0.0.1:8787/api/knowledge','http://[::1]:8787/api/knowledge','https://api.example.com/knowledge'])('接受显式本机或远程配置与开发者自己的来源ID：%s', async endpoint => {
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({schema:1,operation:'overview',site:'handbook',sources:[],overview:'2 documents'})));
  const client=createKnowledgeClient({endpoint,fetcher});
  expect((await client.overview({site:'handbook'})).overview).toBe('2 documents');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).site).toBe('handbook');
});
