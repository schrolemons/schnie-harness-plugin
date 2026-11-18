/** info-card-sse/1: shared, transport-only contract. No RAG or host dependencies. */
export const PROTOCOL = 'info-card-sse';
export const VERSION = 1;
export const MAX_STREAM_BYTES = 1024 * 1024;
const TYPES = new Set(['meta', 'status', 'text_delta', 'info_card', 'done', 'error']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export class ProtocolError extends Error {
  constructor(message = '外部服务返回的SSE不符合info-card-sse/1协议。') { super(message); this.name = 'ProtocolError'; }
}
const fail = () => { throw new ProtocolError(); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const string = (value, max, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
export function safeCardUrl(value) {
  if (!string(value, 2048) || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)));
  } catch { return false; }
}
export function validateCards(value) {
  if (!Array.isArray(value) || value.length > 10) fail();
  const ids = new Set(), orders = [];
  const cards = value.map(card => {
    if (!object(card) || Object.keys(card).some(key => !['id','title','url','excerpt','used','order'].includes(key)) || typeof card.id !== 'string' || !ID.test(card.id) || ids.has(card.id) || !string(card.title, 160) || !safeCardUrl(card.url) || typeof card.used !== 'boolean' || !string(card.excerpt ?? '', 1200, true)) fail();
    ids.add(card.id);
    if (card.used) {
      if (!Number.isInteger(card.order) || card.order < 1 || card.order > 10) fail();
      orders.push(card.order);
    } else if (card.order !== null) fail();
    return { id: card.id, title: card.title, url: card.url, excerpt: card.excerpt ?? '', used: card.used, order: card.order };
  });
  orders.sort((a,b) => a-b);
  if (orders.some((order, index) => order !== index+1)) fail();
  return cards;
}
export function encodeEvent(type, payload) {
  if (!TYPES.has(type)) fail();
  return `id: ${payload.seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
export function createSseDecoder(onEvent = () => {}) {
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  let pending = '', bytes = 0, type = '', data = [], wireId = '', seq = -1, requestId, text = '', cards, done = false;
  function event() {
    if (!type && !data.length) { wireId = ''; return; }
    if (done || !TYPES.has(type) || !data.length) fail();
    let value;
    try { value = JSON.parse(data.join('\n')); } catch { fail(); }
    const fields={meta:['protocol','version'],status:['stage'],text_delta:['text'],info_card:['info_card'],done:['text_length','card_count'],error:['code','message']}[type];
    if (!object(value) || Object.keys(value).some(key => !['request_id','seq',...fields].includes(key))) fail();
    if (!object(value) || !string(value.request_id, 128) || !ID.test(value.request_id) || value.seq !== seq+1 || (wireId && wireId !== String(value.seq))) fail();
    if (seq === -1) {
      if (type !== 'meta' || value.protocol !== PROTOCOL || value.version !== VERSION) fail();
      requestId = value.request_id;
    } else if (type === 'meta' || value.request_id !== requestId) fail();
    seq = value.seq;
    if (type === 'status' && !string(value.stage, 80)) fail();
    if (type === 'text_delta') {
      if (cards || !string(value.text, 8192, true)) fail();
      text += value.text;
      if ([...text].length > 64000) fail();
    }
    if (type === 'info_card') {
      if (cards) fail();
      cards = validateCards(value.info_card);
    }
    if (type === 'done') {
      if (!cards || value.text_length !== [...text].length || value.card_count !== cards.filter(card => card.used).length) fail();
      done = true;
    }
    if (type === 'error') {
      if (!string(value.code, 80) || !string(value.message, 300)) fail();
      onEvent({ type, ...value });
      throw new ProtocolError(value.message);
    }
    onEvent({ type, ...value });
    type = ''; data = []; wireId = '';
  }
  function lines() {
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end).replace(/\r$/, ''); pending = pending.slice(end+1);
      if (line === '') { event(); continue; }
      if (line.startsWith(':')) continue;
      const at = line.indexOf(':');
      const key = at < 0 ? line : line.slice(0, at);
      const value = at < 0 ? '' : line.slice(at+1).replace(/^ /, '');
      if (key === 'event') type = value;
      if (key === 'data') data.push(value);
      if (key === 'id') wireId = value;
    }
  }
  return {
    push(chunk) {
      bytes += chunk.byteLength;
      if (bytes > MAX_STREAM_BYTES) fail();
      try { pending += utf8.decode(chunk, { stream: true }); } catch { fail(); }
      lines();
    },
    finish() {
      try { pending += utf8.decode(); } catch { fail(); }
      lines();
      if (pending.trim() || data.length || type || !done) throw new ProtocolError('流式响应未完整结束，未采用引用卡片。');
      return { request_id: requestId, text, cards: cards.filter(card => card.used).sort((a,b) => a.order-b.order), all_cards: cards };
    },
  };
}
