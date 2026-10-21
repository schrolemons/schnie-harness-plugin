import { afterEach, expect, it, vi } from 'vitest';
import { createKnowledgeClient } from '../lib/knowledge-client.js';

const source = { id: 'a1234567890bcdef', number: 1, title: '终末阵列', section: '规则', category: 'world', site: 'world', url: 'https://world.sch-nie.com/posts/end', urlKind: 'article', text: '原文内容。' };
const response = extra => ({ schema: 1, requestId: 'test', operation: 'search', query: '终末阵列', site: 'all', sources: [source], ...extra });
afterEach(() => vi.restoreAllMocks());

it('只把检索字段发给默认 Vercel 服务，不发送模型、Key 或对话历史', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response())));
  const client = createKnowledgeClient({ fetcher });
  const result = await client.search({ query: '终末阵列', apiKey: 'must-not-leave', model: 'user-model', reasoning: 'high', messages: [{ content: 'private-history' }] });
  expect(result.sources[0].id).toBe(source.id);
  expect(fetcher.mock.calls[0][0]).toBe('https://launcher.sch-nie.com/api/knowledge');
  const options = fetcher.mock.calls[0][1];
  expect(JSON.parse(options.body)).toEqual({ operation: 'search', query: '终末阵列', site: 'all', mode: 'chat' });
  expect(JSON.stringify(options)).not.toMatch(/must-not-leave|user-model|private-history|Authorization/i);
});
it('同一个查询短时复用缓存，用户取消不会发起请求', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(response())));
  const client = createKnowledgeClient({ fetcher });
  await client.search({ query: '终末阵列' });
  await client.search({ query: '终末阵列' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  await expect(client.search({ query: '取消的新查询' }, controller.signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  { schema: 99 },
  { sources: [{ ...source, url: 'javascript:alert(1)' }] },
  { sources: [{ ...source, id: 'fake' }] },
  { operation: 'overview' },
])('拒绝无法可信绑定引用的服务响应：%j', async extra => {
  const client = createKnowledgeClient({ fetcher: async () => new Response(JSON.stringify(response(extra))) });
  await expect(client.search({ query: '终末阵列' })).rejects.toThrow();
});
it('服务失败不把上游原始错误或机密回显给模型，也不自动连发重试', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('secret-server-token', { status: 503 }));
  const client = createKnowledgeClient({ fetcher });
  await expect(client.search({ query: '终末阵列' })).rejects.not.toThrow(/secret-server-token/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('总览独立查询，不用检索片段拼出统计', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response({ operation: 'overview', query: '', sources: [], overview: '已知 Markdown 范围：2 篇、123 字。' }))));
  const client = createKnowledgeClient({ fetcher });
  expect((await client.overview({})).overview).toContain('123 字');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ operation: 'overview', site: 'all', mode: 'chat' });
});
