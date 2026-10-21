import { describe, expect, it } from 'vitest';
import { A, B, C, loadClient, source, result, toolNode } from './client-fixtures.js';

describe('citation projection from same-Turn search evidence', () => {
  it('keeps only cited IDs, ordered by first use, across multiple searches', () => {
    const { citedSources } = loadClient();
    const nodes = [toolNode(result([source(A), source(C, '未采用')])), toolNode(result([source(B, '自由意志')]), 1, 5)];
    expect(citedSources(`观点 [SCHNIE:${B}]、[SCHNIE:${A}]、[SCHNIE:${B}]`, nodes, 1, 9).map(s => s.id)).toEqual([B, A]);
  });
  it('never uses another Turn, future result, errors, overview, unrelated tools or unverified IDs', () => {
    const { citedSources } = loadClient();
    const badTool = toolNode(); badTool.data.root.call.name = 'other';
    const failed = toolNode(); failed.data.root.isError = true;
    const overview = toolNode({ ...result(), operation: 'overview' });
    expect(citedSources(`[SCHNIE:${A}]`, [toolNode(result(), 0), toolNode(result(), 1, 12), badTool, failed, overview], 1, 10)).toEqual([]);
  });
  it('reads native metadata and nested PTC JSON content with inherited engine Turn', () => {
    const { citedSources } = loadClient();
    const node = toolNode();
    node.data.root.call.name = 'run_code'; node.data.root.meta = undefined;
    node.data.root.subCalls = [{ kind: 'tool-result', seq: 4, call: { name: 'search_schnie' }, isError: false, content: [{ type: 'text', text: JSON.stringify(result()) }], subCalls: [] }];
    expect(citedSources(`[SCHNIE:${A}]`, [node], 1, 10).map(s => s.id)).toEqual([A]);
  });
  it('deduplicates equal title and URL but preserves distinct titles sharing an index URL', () => {
    const { citedSources } = loadClient();
    const nodes = [toolNode(result([source(A), source(B), source(C, '自由意志')]))];
    expect(citedSources(`[SCHNIE:${A}] [SCHNIE:${B}] [SCHNIE:${C}]`, nodes, 1, 10).map(s => s.title)).toEqual(['主体性', '自由意志']);
  });
  it('recognizes an exact natural Markdown title+URL citation and rejects mismatched titles', () => {
    const { citedSources } = loadClient();
    expect(citedSources('[主体性](https://world.sch-nie.com/core/)', [toolNode()], 1, 10).map(s => s.id)).toEqual([A]);
    expect(citedSources('[自由意志](https://world.sch-nie.com/core/)', [toolNode()], 1, 10)).toEqual([]);
    expect(citedSources('`[主体性](https://world.sch-nie.com/core/)`', [toolNode()], 1, 10)).toEqual([]);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'http://example.com/', '//example.com/', 'https://user:secret@example.com/', 'https://example.com/\nfoo'])('rejects unsafe source link %s', (url) => {
    expect(loadClient().citedSources(`[SCHNIE:${A}]`, [toolNode(result([source(A, '标题', url)]))], 1, 10)).toEqual([]);
  });
  it('fails closed for malformed JSON, schema, IDs and conflicting source identities', () => {
    const { citedSources } = loadClient();
    const node = toolNode(); node.data.root.meta = undefined; node.data.root.content = [{ type: 'text', text: '{bad' }];
    expect(citedSources(`[SCHNIE:${A}]`, [node, toolNode({ ...result(), schema: 2 })], 1, 10)).toEqual([]);
    expect(citedSources(`[SCHNIE:${A}]`, [toolNode(result([source(A), source(A, '冲突')]))], 1, 10)).toEqual([]);
  });
});

describe('prose citation syntax', () => {
  it('recognizes only complete lowercase 16-hex markers', () => {
    expect(loadClient().citationIds(`[SCHNIE:${A}] [SCHNIE:ABCDEF1234567890] [SCHNIE:123] [SCHNIE:${B}`)).toEqual([A]);
  });
  it('ignores fenced, indented, inline code, escapes, HTML, and Markdown link labels', () => {
    const marker = `[SCHNIE:${A}]`;
    const text = ['```md', marker, '```', '~~~', marker, '~~~', `    ${marker}`, `\t${marker}`, `\`${marker}\``, `\`\` ${marker} \`\``, `\\${marker}`, `${marker}(https://example.com)`, `![${marker}](https://example.com)`, `<!-- ${marker} -->`, `<code>${marker}</code>`, `${marker}[ref]`, '[ref]: https://example.com'].join('\n');
    expect(loadClient().citationIds(text)).toEqual([]);
  });
  it('keeps prose after code and supports a complete marker in an interrupted prefix', () => {
    expect(loadClient().citationIds(`\`[SCHNIE:${A}]\` 正文 [SCHNIE:${B}] 后续 [SCHNIE:123`)).toEqual([B]);
  });
  it('does not cite indented or fenced examples nested in blockquotes', () => {
    const plugin = loadClient();
    const text = [`>     [SCHNIE:${A}]`, '>     [主体性](https://world.sch-nie.com/core/)', '> ```md', `> [SCHNIE:${A}]`, '> ```', '', `正文 [SCHNIE:${B}]`].join('\n');
    expect(plugin.citationIds(text)).toEqual([B]);
    expect(plugin.citedSources(text, [toolNode()], 1, 10)).toEqual([]);
  });
  it('ignores reference-style marker links, including their definition lines', () => {
    expect(loadClient().citationIds(`[SCHNIE:${A}]\n\n[SCHNIE:${A}]: https://example.com`)).toEqual([]);
  });
});
