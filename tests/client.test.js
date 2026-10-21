import { describe, expect, it } from 'vitest';
import { A, B, loadClient, result, source, toolNode } from './client-fixtures.js';

function context(assistant, seq = 10) {
  const location = { kind: 'step', turn: { turn: 1 }, step: { step: 2, data: { get: (key) => key === 'assistant-step' ? assistant : undefined } } };
  return { key: 'schnie-references:1:2', id: '1:2', state: {}, current: new Map(), start: { event: { type: 'step/start', seq: 6 }, location }, matches: [{ event: { type: 'assistant/message', seq }, location }] };
}
const assistant = (text, status = 'settled') => ({ turn: 1, step: 2, status, blocks: [{ kind: 'text', text }], finalNode: status === 'running' ? undefined : { seq: 10 } });

describe('prebuilt additive Harness Client', () => {
  it('loads native React only and registers a fresh renderer without replacing the answer', () => {
    const plugin = loadClient();
    expect(plugin.id).toBe('dsh-schnie-archive');
    expect(plugin.inject).toContain('uiConversation');
    const definitions = [], slots = [];
    const ctx = { uiConversation: { events: { register: (d) => { definitions.push(d); return () => {}; } } }, slots: { inject: (name, callback) => callback(), register: (definition, component) => { slots.push({ definition, component }); return () => {}; } } };
    plugin.apply(ctx);
    expect(definitions).toHaveLength(1);
    expect(slots[0].definition).toMatchObject({ name: 'conversation.chat.node', key: 'schnie-references' });
    expect(slots.some(s => s.definition.name === 'conversation.input.dock')).toBe(true);
    expect(slots.some(s => s.definition.name === 'tool.call.toolview' && s.definition.key === 'search_schnie')).toBe(true);
    expect(slots.some(s => s.definition.key === 'assistant-step')).toBe(false);
  });
  it('derives live, settled and interrupted prefixes from Harness assistant-step data', () => {
    const { referenceDefinition } = loadClient();
    for (const status of ['running', 'settled', 'interrupted']) {
      const node = referenceDefinition.buildViewNode(context(assistant(`[SCHNIE:${A}]`, status)));
      expect(node.kind).toBe('schnie-references');
      expect(node.visibility).toBe('visible');
      // A default step child is folded into Harness's collapsed process group.
      expect(node.groupTree).toBe('turn');
      expect(node.data.text).toBe(`[SCHNIE:${A}]`);
      expect(node.anchorSeq).toBeGreaterThan(node.data.beforeSeq);
    }
  });
  it('uses hidden visibility to remove references after retry or a revised final answer', () => {
    const { referenceDefinition } = loadClient();
    const node = referenceDefinition.buildViewNode(context(assistant('修订后没有引用')));
    expect(node).not.toBeNull();
    expect(node.visibility).toBe('hidden');
  });
  it('matches compact chunk rows and replayed final events without accepting surface replacements', () => {
    const { referenceDefinition } = loadClient();
    for (const type of ['step/start', 'assistant/message', 'assistant/chunk', 'chunkrow/text-chunks', 'llm/retry']) {
      expect(referenceDefinition.match({ type, surfaceOp: 'append', data: { turn: 2, step: 3 } })).toMatchObject({ id: '2:3' });
    }
    expect(referenceDefinition.match({ type: 'assistant/message', surfaceOp: 'replace', data: { turn: 2, step: 3 } })).toBeNull();
    expect(referenceDefinition.match({ type: 'user/message', data: { turn: 2 } })).toBeNull();
  });
  it('renders only supported sources as secure links, no HTML injection or cached previous sources', () => {
    const plugin = loadClient(); let Component;
    plugin.apply({ uiConversation: { events: { register: () => () => {} } }, slots: { inject: (_, fn) => fn(), register: (slot, component) => { if (slot.key === 'schnie-references') Component = component; return () => {}; } } });
    const node = plugin.referenceDefinition.buildViewNode(context(assistant(`[SCHNIE:${A}] [SCHNIE:${B}]`)));
    const title = '<img src=x onerror=alert(1)>';
    const props = { node, useChat: (select) => select({ nodes: { values: () => [toolNode(result([{...source(A, title),text:'原文片段，保留内容。'}, source(B, 'unused')]), 1)] } }) };
    const rendered = Component(props);
    const serialized = JSON.stringify(rendered);
    expect(serialized).toContain(title);
    expect(serialized).toContain('noopener noreferrer');
    expect(serialized).not.toContain('dangerouslySetInnerHTML');
    expect(serialized).toContain('查看原文片段');
    expect(serialized).toContain('原文片段，保留内容。');
    expect(Component({ ...props, useChat: (select) => select({ nodes: { values: () => [] } }) })).toBeNull();
  });
  it('shows live retrieval status only for running calls in the current Turn, including nested PTC', () => {
    const { retrievalActivity } = loadClient();
    const running = toolNode();
    running.data.root = {kind:'tool-start',phase:'start',name:'run_code',subCalls:[{phase:'start',name:'search_schnie',subCalls:[]}]};
    expect(retrievalActivity([running])).toBe(1);
    expect(retrievalActivity([running,toolNode(result(),2)])).toBe(0);
    expect(retrievalActivity([toolNode()])).toBe(0);
  });
});
