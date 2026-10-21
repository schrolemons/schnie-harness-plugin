import { expect, it, vi } from 'vitest';
import { apply } from '../index.js';

it('注册两个工具及可卸载的增量提示词，不读取或覆盖用户模型配置', () => {
  const tools = [], sections = [], dispose = vi.fn();
  const ctx = { tools: { register: tool => { tools.push(tool); return dispose; } }, systemPrompt: { section: section => { sections.push(section); return dispose; } }, effect: fn => fn() };
  Object.defineProperty(ctx, 'llm', { get() { throw new Error('插件不得接管模型'); } });
  Object.defineProperty(ctx, 'credentials', { get() { throw new Error('插件不得读取凭据'); } });
  apply(ctx);
  expect(tools.map(t => t.name)).toEqual(['search_schnie', 'schnie_overview']);
  expect(sections).toHaveLength(1);
  expect(sections[0].complete).not.toBe(true);
  expect(sections[0].text).toContain('[SCHNIE:');
  expect(tools[0].parameters.properties.query.maxLength).toBe(1200);
  expect(tools[0].parameters.additionalProperties).toBe(false);
});
it('工具展示元数据保留来源身份，模型内容包含可引用标识', () => {
  const tools = [], ctx = { tools: { register: t => tools.push(t) }, systemPrompt: { section() {} } };
  apply(ctx);
  const result = { schema: 1, operation: 'search', query: '测试', site: 'all', sources: [{ id: '0123456789abcdef', title: '原文', text: '证据', url: 'https://world.sch-nie.com/a' }] };
  expect(tools[0].output.presentationMeta({}, result)).toMatchObject({ schema: 1, sources: [{ id: '0123456789abcdef' }] });
  expect(JSON.stringify(tools[0].output.render({}, result))).toContain('[SCHNIE:0123456789abcdef]');
  const escaped = {...result, sources: [{...result.sources[0],title:'[Hexo] 配置'}]};
  expect(JSON.parse(tools[0].output.render({}, escaped)[0].text).sources[0].link).toBe('[\\[Hexo\\] 配置](https://world.sch-nie.com/a)');
});
