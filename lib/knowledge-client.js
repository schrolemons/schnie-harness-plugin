export const DEFAULT_ENDPOINT = 'https://launcher.sch-nie.com/api/knowledge';
const SITES = new Set(['all', 'blog', 'world', 'zero']);
const MODES = new Set(['chat', 'tutor', 'scholar']);

export class KnowledgeError extends Error {
  constructor(code, message) { super(message); this.name = 'KnowledgeError'; this.code = code; }
}

function safeHttps(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !!u.hostname; }
  catch { return false; }
}

function validateResult(value, body) {
  if (!value || value.schema !== 1 || value.operation !== body.operation || value.site !== body.site || !Array.isArray(value.sources) || value.sources.length > 10) throw new KnowledgeError('INVALID_RESPONSE', '知识库返回格式不兼容，未采用这些资料。');
  const ids = new Set();
  const sources = value.sources.map(source => {
    if (!source || !/^[a-f0-9]{16}$/.test(source.id) || ids.has(source.id) || !safeHttps(source.url) || typeof source.title !== 'string' || !source.title.trim() || source.title.length > 160 || typeof source.text !== 'string' || !source.text || source.text.length > 6000) throw new KnowledgeError('INVALID_SOURCE', '知识库来源无效，未采用这些资料。');
    ids.add(source.id);
    const result = { id: source.id, number: source.number, title: source.title, url: source.url, text: source.text };
    for (const key of ['section', 'category', 'categoryName', 'urlKind', 'site', 'siteName', 'sourcePath', 'articleId', 'articleHash', 'summary', 'author', 'updatedAt']) {
      if (typeof source[key] === 'string') result[key] = source[key].slice(0, key === 'summary' ? 240 : 300);
    }
    return result;
  });
  if (sources.reduce((n, source) => n + source.text.length, 0) > 12000) throw new KnowledgeError('INVALID_RESPONSE', '知识库返回内容超过上限。');
  if (body.operation === 'overview' && (sources.length || typeof value.overview !== 'string' || value.overview.length > 512000)) throw new KnowledgeError('INVALID_RESPONSE', '内容总览格式无效。');
  const result = { schema: 1, requestId: String(value.requestId || '').slice(0, 80), operation: body.operation, query: body.query || '', site: body.site, sources };
  if (body.operation === 'overview') result.overview = value.overview;
  return result;
}

export function createKnowledgeClient({ endpoint = DEFAULT_ENDPOINT, fetcher = globalThis.fetch, timeoutMs = 12000, cacheMs = 30000, now = Date.now } = {}) {
  if (!safeHttps(endpoint)) throw new KnowledgeError('INVALID_ENDPOINT', '知识库接口必须使用无账号信息的 HTTPS 地址。');
  const cache = new Map();
  async function request(operation, input = {}, signal) {
    signal?.throwIfAborted();
    const site = input.site ?? 'all', mode = input.mode ?? 'chat';
    if (!SITES.has(site) || !MODES.has(mode)) throw new KnowledgeError('INVALID_INPUT', '请选择有效的网站来源和检索模式。');
    const body = { operation, ...(operation === 'search' ? { query: typeof input.query === 'string' ? input.query.trim() : '' } : {}), site, mode };
    if (operation === 'search' && (!body.query || body.query.length > 1200)) throw new KnowledgeError('INVALID_INPUT', '检索词需要为 1–1200 个字符。');
    const key = JSON.stringify(body), entry = cache.get(key);
    if (entry && now() < entry.expires) return structuredClone(entry.value);
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new Error('知识库请求超时。')), timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
    try {
      const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), credentials: 'omit', redirect: 'error', signal: combined });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new KnowledgeError(response.status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE', response.status === 429 ? '知识库请求较频繁，请稍后重试。' : '知识库暂时不可用；不能据此断言资料不存在。');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new KnowledgeError('INVALID_RESPONSE', '知识库没有返回内容。');
      let length = 0, text = '';
      const decoder = new TextDecoder();
      try {
        while (true) {
          combined.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 768 * 1024) throw new KnowledgeError('INVALID_RESPONSE', '知识库返回内容超过上限。');
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const result = validateResult(JSON.parse(text), body);
      if (cache.size >= 64) cache.delete(cache.keys().next().value);
      cache.set(key, { value: result, expires: now() + cacheMs });
      return structuredClone(result);
    } catch (error) {
      if (signal?.aborted) throw signal.reason || new Error('检索已取消。');
      if (error instanceof KnowledgeError) throw error;
      throw new KnowledgeError(deadline.signal.aborted ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE', deadline.signal.aborted ? '知识库请求超时，请稍后重试。' : '知识库暂时不可用；不能据此断言资料不存在。');
    } finally { clearTimeout(timer); }
  }
  return { search: (input, signal) => request('search', input, signal), overview: (input, signal) => request('overview', input, signal) };
}
