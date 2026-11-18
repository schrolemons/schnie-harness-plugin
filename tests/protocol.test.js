import { expect, it } from 'vitest';
import { createSseDecoder, encodeEvent, validateCards } from '../protocol/info-card-v1.mjs';

const card = { id: 'doc-1', title: '安装说明', url: 'https://docs.example.com/setup', excerpt: '原文摘要', used: true, order: 1 };
function stream(cards = [card]) {
  return [encodeEvent('meta', { request_id: 'test-1', seq: 0, protocol: 'info-card-sse', version: 1 }),
    encodeEvent('text_delta', { request_id: 'test-1', seq: 1, text: '中文🙂[1]' }),
    encodeEvent('info_card', { request_id: 'test-1', seq: 2, info_card: cards }),
    encodeEvent('done', { request_id: 'test-1', seq: 3, text_length: 6, card_count: 1 })].join('');
}
it('逐字节处理UTF-8、CRLF和多事件；只展示被采用的有序卡片', () => {
  const events = [], decoder = createSseDecoder(event => events.push(event));
  for (const byte of new TextEncoder().encode(stream().replaceAll('\n', '\r\n'))) decoder.push(Uint8Array.of(byte));
  expect(decoder.finish()).toMatchObject({ text: '中文🙂[1]', cards: [card], request_id: 'test-1' });
  expect(events.map(x => x.type)).toEqual(['meta', 'text_delta', 'info_card', 'done']);
  expect(validateCards([{ ...card, id: 'unused', used: false, order: null }, { ...card, id: 'second', order: 2 }, card]).filter(x => x.used).sort((a,b) => a.order-b.order).map(x=>x.id)).toEqual(['doc-1', 'second']);
});
it.each([
  stream().replace('"version":1', '"version":2'),
  stream().replace('"seq":1', '"seq":5'),
  stream().replace('"request_id":"test-1","seq":2', '"request_id":"other","seq":2'),
  stream().slice(0, -2),
  stream().split('id: 3')[0],
  stream().replace('"text_length":6', '"text_length":99'),
  'data: {"choices":[]}\n\n',
])('拒绝未知协议、错序、串请求、截断和计数不一致', input => {
  const decoder = createSseDecoder();
  expect(() => { decoder.push(new TextEncoder().encode(input)); decoder.finish(); }).toThrow();
});
it.each(['javascript:alert(1)', 'https://docs.example.com/\nother', 'https://' + 'user:pass' + '@docs.example.com/'])('拒绝危险卡片地址：%s', url => {
  expect(() => validateCards([{ ...card, url }])).toThrow();
});
it('拒绝重复身份、非法采用顺序和超大事件', () => {
  expect(() => validateCards([card, card])).toThrow();
  expect(() => validateCards([{ ...card, order: 2 }])).toThrow();
  expect(() => validateCards([{ ...card, used: false }])).toThrow();
  expect(() => createSseDecoder().push(new TextEncoder().encode('x'.repeat(1048577)))).toThrow();
});
