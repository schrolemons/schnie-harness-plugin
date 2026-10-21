import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadClient(react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }) {
  let registration;
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (value) => { registration = value; } } }, URL,
  });
  return { id: registration.id, ...registration.factory((name) => {
    if (name !== 'react') throw new Error(`Unexpected nonbaseline import: ${name}`);
    return react;
  }) };
}

export const A = '1234567890abcdef';
export const B = 'abcdef1234567890';
export const C = '1111111111111111';
export const source = (id = A, title = '主体性', url = 'https://world.sch-nie.com/core/') => ({ id, title, url, site: 'world', siteName: '世界观', section: '概念', number: 1 });
export const result = (sources = [source()]) => ({ schema: 1, operation: 'search', query: '主体性', site: 'all', sources });
export const toolNode = (payload = result(), turn = 1, seq = 3) => ({ kind: 'tool-call', anchorSeq: seq - 1, location: { kind: 'step', turn: { turn }, step: { step: 1 } }, data: { root: {
  kind: 'tool-result', seq, callId: `call-${turn}`, call: { name: 'search_schnie' }, meta: payload, content: [], subCalls: [], isError: false,
} } });
