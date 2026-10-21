/* Prebuilt browser entry: only React is a runtime value import. */
window.__ModuleLoader__.load({
  id: 'dsh-schnie-archive',
  factory(require) {
    const React = require('react');
    const KIND = 'schnie-references';
    const ID = /^[0-9a-f]{16}$/;

    function safeUrl(value) {
      if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\x00-\x20\x7f\\]/.test(value)) return null;
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null;
      } catch { return null; }
    }

    /** Conservative Markdown scan: literal examples never become source claims. */
    function citations(text) {
      if (typeof text !== 'string') return [];
      const chars = text.split('');
      const hide = (start, end) => { for (let i = start; i < end; i++) if (chars[i] !== '\n') chars[i] = ' '; };
      const definitions = new Map();
      let offset = 0, fence;
      for (const line of text.split('\n')) {
        let contentLine = line, quoteDepth = 0;
        while (/^ {0,3}> ?/.test(contentLine)) {
          contentLine = contentLine.replace(/^ {0,3}> ?/, ''); quoteDepth++;
        }
        if (fence?.quoteDepth && quoteDepth < fence.quoteDepth) fence = undefined;
        const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(contentLine);
        if (fence) {
          hide(offset, offset + line.length);
          if (delimiter && delimiter[1][0] === fence.char && delimiter[1].length >= fence.length && /^\s*$/.test(contentLine.slice(delimiter[0].length))) fence = undefined;
        } else if (delimiter) {
          fence = { char: delimiter[1][0], length: delimiter[1].length, quoteDepth };
          hide(offset, offset + line.length);
        } else if (/^( {4}|\t)/.test(contentLine)) hide(offset, offset + line.length);
        else {
          const definition = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/.exec(line);
          if (definition) {
            definitions.set(definition[1].toLowerCase(), definition[2] ?? definition[3]);
            hide(offset, offset + line.length);
          }
        }
        offset += line.length + 1;
      }
      // Comments and HTML examples, including multiline code/pre elements.
      for (const match of text.matchAll(/<!--[\s\S]*?(?:-->|$)|<(code|pre|script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<[^>\n]+>/gi)) hide(match.index, match.index + match[0].length);
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '\\') {
          if (chars[i + 1] === '[') {
            const end = text.indexOf(']', i + 2);
            hide(i, end < 0 ? i + 2 : end + 1);
          } else { hide(i, i + 2); i++; }
        } else if (chars[i] === '`') {
          let count = 1;
          while (chars[i + count] === '`') count++;
          let end = i + count;
          for (; end < chars.length; end++) {
            if (chars[end] !== '`') continue;
            let length = 1;
            while (chars[end + length] === '`') length++;
            if (length === count) break;
            end += length - 1;
          }
          if (end < chars.length) { hide(i, end + count); i = end + count - 1; }
          else i += count - 1;
        }
      }
      const prose = chars.join('');
      const found = [];
      for (let i = 0; i < prose.length; i++) {
        if (prose[i] !== '[') continue;
        let depth = 1, end = i + 1;
        for (; end < prose.length && depth; end++) {
          if (prose[end] === '\\') { end++; continue; }
          if (prose[end] === '[') depth++;
          if (prose[end] === ']') depth--;
        }
        if (depth) continue;
        const label = text.slice(i + 1, end - 1);
        let url, linkEnd = end;
        if (prose[end] === '(') {
          let nesting = 1, cursor = end + 1;
          for (; cursor < prose.length && nesting; cursor++) {
            if (prose[cursor] === '\\') { cursor++; continue; }
            if (prose[cursor] === '(') nesting++;
            if (prose[cursor] === ')') nesting--;
          }
          if (!nesting) {
            const destination = text.slice(end + 1, cursor - 1).trim();
            const direct = /^(?:<([^>]+)>|([^\s]+?))(?:\s+["'][\s\S]*["'])?$/.exec(destination);
            url = direct ? direct[1] ?? direct[2] : '';
            linkEnd = cursor;
          }
        } else if (prose[end] === '[') {
          const close = prose.indexOf(']', end + 1);
          if (close >= 0) { url = definitions.get((text.slice(end + 1, close) || label).toLowerCase()) ?? ''; linkEnd = close + 1; }
        } else if (definitions.has(label.toLowerCase())) url = definitions.get(label.toLowerCase());
        if (url !== undefined) {
          if (i === 0 || prose[i - 1] !== '!') found.push({ title: label.replace(/\\([\p{P}\p{S}])/gu, '$1'), url, index: i });
          i = linkEnd - 1;
          continue;
        }
        // Scan the exact matched bracket: nested/image brackets are not ID cites.
        const marker = /^SCHNIE:([0-9a-f]{16})$/.exec(label);
        if (marker && (i === 0 || prose[i - 1] !== '!')) found.push({ id: marker[1], index: i });
        i = end - 1;
      }
      return found;
    }

    function citationIds(text) {
      return [...new Set(citations(text).flatMap(citation => citation.id ? [citation.id] : []))];
    }

    function searchResult(value) {
      if (typeof value === 'string') {
        if (value.length > 262144) return null;
        try { value = JSON.parse(value); } catch { return null; }
      }
      return value?.schema === 1 && value.operation === 'search' && Array.isArray(value.sources) ? value : null;
    }

    function collectSources(nodes, turn, beforeSeq) {
      const byId = new Map(), conflicts = new Set();
      for (const node of nodes ?? []) {
        if (node.kind !== 'tool-call' || !['step', 'turn'].includes(node.location?.kind) || node.location.turn.turn !== turn) continue;
        const pending = [node.data?.root], visited = new Set();
        for (let index = 0; index < pending.length && index < 512; index++) {
          const block = pending[index];
          if (!block || visited.has(block)) continue;
          visited.add(block);
          pending.push(...(block.subCalls ?? []));
          if (block.kind !== 'tool-result' || block.isError || block.call?.name !== 'search_schnie' || !Number.isFinite(block.seq) || block.seq > beforeSeq) continue;
          // Native result.meta survives replay; PTC preserves the JSON text content.
          const payload = searchResult(block.meta) ?? (block.content ?? []).map(part => part?.type === 'text' ? searchResult(part.text) : null).find(Boolean);
          if (!payload) continue;
          for (const raw of payload.sources.slice(0, 64)) {
            const url = safeUrl(raw?.url);
            if (!ID.test(raw?.id) || !url || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 1000) continue;
            const source = { id: raw.id, title: raw.title.trim(), url, siteName: typeof raw.siteName === 'string' ? raw.siteName.slice(0, 100) : '', text: typeof raw.text === 'string' ? raw.text.slice(0, 1600) : '' };
            const previous = byId.get(source.id);
            if (previous && (previous.title !== source.title || previous.url !== source.url)) conflicts.add(source.id);
            else byId.set(source.id, source);
          }
        }
      }
      for (const id of conflicts) byId.delete(id);
      return byId;
    }

    function citedSources(text, nodes, turn, beforeSeq) {
      const byId = collectSources(nodes, turn, beforeSeq), shown = new Set(), sources = [];
      for (const cite of citations(text)) {
        const candidate = cite.id ? byId.get(cite.id) : [...byId.values()].find(source => source.title === cite.title && source.url === safeUrl(cite.url));
        if (!candidate) continue;
        const key = JSON.stringify([candidate.title, candidate.url]);
        if (shown.has(key)) continue;
        shown.add(key); sources.push(candidate);
      }
      return sources;
    }

    function retrievalActivity(input) {
      const nodes = [...input];
      const latest = Math.max(-1, ...nodes.map(node => node.location?.turn?.turn ?? -1));
      let count = 0;
      for (const node of nodes) {
        if (node.kind !== 'tool-call' || node.location?.turn?.turn !== latest) continue;
        const pending = [node.data?.root], seen = new Set();
        for (let i = 0; i < pending.length && i < 512; i++) {
          const block = pending[i];
          if (!block || seen.has(block)) continue;
          seen.add(block); pending.push(...(block.subCalls ?? []));
          if (['start', 'preparing'].includes(block.phase) && ['search_schnie', 'schnie_overview'].includes(block.name)) count++;
        }
      }
      return count;
    }

    const line = 'var(--dsw-alias-outline-primary,rgba(127,127,127,.2))';
    const muted = 'var(--dsw-alias-label-secondary,#7a8290)';
    function SourceCards(sources) {
      const h = React.createElement;
      return h('nav', {
        'aria-label': 'SCHNIE references', 'data-schnie-references': '',
        style: { border: `1px solid ${line}`, borderRadius: 12, padding: '12px 14px', margin: '12px 0', fontSize: 'var(--dsh-content-font-size-secondary,13px)', lineHeight: 1.6, overflowWrap: 'anywhere' },
      }, h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, color: muted, marginBottom: 6 } },
        h('span', { style: { fontSize: 11, letterSpacing: '.08em' } }, 'SCHNIE / ARCHIVE'),
        h('span', null, `参考来源 · ${sources.length}`)),
      h('ul', { style: { listStyle: 'none', margin: 0, padding: 0 } }, ...sources.map(source => h('li', {
        key: JSON.stringify([source.title, source.url]), style: { padding: '8px 0', borderTop: `1px solid ${line}` },
      }, h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 } },
        h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--dsw-alias-label-primary,inherit)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 4 } }, source.title),
        h('span', { style: { color: muted, fontSize: 11, flexShrink: 0 } }, new URL(source.url).hostname)),
        source.text ? h('details', { style: { marginTop: 5 } },
          h('summary', { style: { color: muted, cursor: 'pointer', fontSize: 12, width: 'fit-content' } }, '查看原文片段'),
          h('blockquote', { style: { whiteSpace: 'pre-wrap', margin: '10px 0 4px', paddingInlineStart: 12, borderInlineStart: `2px solid ${line}`, maxHeight: 240, overflow: 'auto' } }, source.text)) : null))));
    }

    /** Independent reference row; Harness remains the owner of answer rendering. */
    const referenceDefinition = {
      kind: KIND, target: 'chat',
      match(event) {
        const allowed = ['step/start', 'assistant/chunk', 'assistant/message', 'chunkrow/text-chunks', 'chunkrow/reasoning-chunks', 'chunkrow/tool-call-chunks', 'llm/retry'];
        if (!allowed.includes(event.type) || !Number.isSafeInteger(event.data?.turn) || !Number.isSafeInteger(event.data?.step)) return null;
        if (event.type === 'assistant/message' && event.surfaceOp !== 'append') return null;
        return { id: `${event.data.turn}:${event.data.step}`, role: event.type === 'step/start' ? 'start' : 'update' };
      },
      start() { return {}; }, update(context) { return context.state; },
      publication(match) { return /^(assistant\/chunk|chunkrow\/)/.test(match.event.type) ? 'animation-frame' : 'immediate'; },
      buildViewNode(context) {
        const location = context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' };
        const assistant = location.kind === 'step' ? location.step.data.get('assistant-step') : undefined;
        const text = (assistant?.blocks ?? []).filter(block => block.kind === 'text').map(block => block.text).join('\n');
        const beforeSeq = assistant?.finalNode?.seq ?? context.matches.at(-1)?.event.seq ?? context.start?.event.seq ?? 0;
        const visible = citations(text).length > 0 && !assistant?.blocks?.some(block => block.kind === 'tool-call');
        return { key: context.key, id: context.id, kind: KIND, target: 'chat', location, groupTree: 'turn',
          anchorSeq: beforeSeq + 0.001, visibility: visible ? 'visible' : 'hidden',
          data: { text, turn: assistant?.turn, beforeSeq } };
      },
    };

    function References({ node, useChat }) {
      const snapshot = useChat(value => value);
      const sources = citedSources(node.data.text, snapshot.nodes.values(), node.data.turn, node.data.beforeSeq);
      if (!sources.length) return null;
      return SourceCards(sources);
    }

    function RetrievalStatus({ useChat }) {
      const count = useChat(snapshot => retrievalActivity(snapshot.nodes.values()));
      return count ? React.createElement('div', {
        role: 'status', 'data-schnie-retrieving': '',
        style: { color: muted, fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 8 },
      }, React.createElement('span', { 'aria-hidden': true }, '◌'), 'SCHNIE · 正在检索资料', count > 1 ? ` (${count})` : '') : null;
    }

    function KnowledgeToolView({ phase, block, toolName }) {
      const payload = searchResult(block?.meta) ?? (block?.content ?? []).map(part => part?.type === 'text' ? searchResult(part.text) : null).find(Boolean);
      const failed = phase === 'result' && block?.isError;
      const label = phase !== 'result' ? '正在检索资料' : failed ? '资料服务暂不可用' : toolName === 'schnie_overview' ? '已读取内容总览' : `已检索 · ${payload?.sources?.length ?? 0} 条候选`;
      return React.createElement('div', {
        'data-schnie-search': '', role: phase === 'result' ? undefined : 'status',
        style: { padding: '8px 0', fontSize: 13, lineHeight: 1.6 },
      }, React.createElement('span', { style: { color: muted, marginInlineEnd: 10, fontSize: 11 } }, 'SCHNIE'), label,
      payload?.query ? React.createElement('div', { style: { color: muted, fontSize: 12, overflowWrap: 'anywhere' } }, payload.query.slice(0, 120)) : null);
    }

    function apply(ctx) {
      // Both APIs bind registrations to the caller Cordis context and dispose on unload.
      ctx.uiConversation.events.register(referenceDefinition);
      ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: KIND }, References));
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'schnie-retrieval' }, RetrievalStatus));
      for (const key of ['search_schnie', 'schnie_overview']) ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key }, KnowledgeToolView));
    }
    return { inject: ['uiConversation', 'slots'], apply, citationIds, citedSources, referenceDefinition, retrievalActivity };
  },
});
