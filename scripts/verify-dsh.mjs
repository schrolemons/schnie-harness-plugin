/** Optional check against an explicitly supplied DSH installation, without a user profile or model. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import * as plugin from '../index.js';
const root=process.argv[2];
if(!root)throw Error('Usage: node scripts/verify-dsh.mjs /path/to/node_modules/@deepseek-ai/dsh');
const manifest=path.resolve(root,'package.json');
const metadata=JSON.parse(fs.readFileSync(manifest,'utf8'));
assert.equal(metadata.name,'@deepseek-ai/dsh');
const require=createRequire(manifest);
const load=name=>import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href);
const {Context}=await load('cordis');
const {SystemPrompt}=await load('dsh-system-prompt');
const {ToolsService}=await load('dsh-tools');
const ctx=new Context();
ctx.plugin(SystemPrompt,{});ctx.plugin(ToolsService,{});
const mounted=ctx.plugin(plugin,{endpoint:''});
await new Promise(resolve=>setTimeout(resolve,50));
try{
 assert.deepEqual(ctx.tools.definitions().map(t=>t.name).sort(),['knowledge_overview','search_knowledge']);
 assert.equal(ctx.tools.schemas().length,2);
 await assert.rejects(ctx.tools.get('search_knowledge').execute({query:'setup'},{signal:new AbortController().signal}),{code:'NOT_CONFIGURED'});
}finally{await mounted.dispose();}
assert.equal(ctx.tools.definitions().length,0);
console.log(JSON.stringify({ok:true,dsh:metadata.version,checks:['actual Cordis plugin mount','actual ToolsService registration and schema projection','not-configured fails without network','unload removes tools'],note:'No model call, MCP exposure test, browser session or user profile'}));
