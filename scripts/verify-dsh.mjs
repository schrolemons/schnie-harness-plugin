/** Optional actual-host registry check; does not open a profile or call a model. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
if(!root)throw Error('Usage: node --expose-internals scripts/verify-dsh.mjs /path/to/node_modules/@deepseek-ai/dsh [installed-plugin-directory]');
const pluginDir=process.argv[3]?path.resolve(process.argv[3]):path.resolve(import.meta.dirname,'..');
const manifest=path.resolve(root,'package.json'),metadata=JSON.parse(fs.readFileSync(manifest,'utf8'));
assert.equal(metadata.name,'@deepseek-ai/dsh');
const require=createRequire(manifest),load=name=>import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href);
const {Context}=await load('cordis');
const {LlmRuntime}=await load('dsh-llm');
const {PluginPackages,createRuntimeResolution,loadProfileDirectory}=await load('dsh-app-boot');
const ctx=new Context(),profileDir=process.argv[3]?path.resolve(pluginDir,'../..'):undefined;
try{
 await ctx.plugin(PluginPackages,{resolution:await createRuntimeResolution({installAnchor:manifest,...(profileDir?{profile:loadProfileDirectory('dsh',profileDir,manifest),home:path.resolve(profileDir,'../..')}:{})})});
 const plugin=await import(pathToFileURL(path.join(pluginDir,'index.js')).href);
 await ctx.plugin(LlmRuntime,{});
 const mounted=await ctx.plugin(plugin,{endpoint:''});
 assert.ok(ctx.llm.listProviders().some(p=>p.id==='external-sse'));
 const chunks=[];
 let failure;
 try{for await(const item of ctx.llm.stream({provider:'external-sse',model:'answer',messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'configuration check'}]}]}))chunks.push(item);}catch(error){failure=error;}
 // 0.2.1 throws adapter failures; 0.2.2 represents them as a finish outcome.
 assert.equal(failure?.code??chunks.at(-1)?.reason?.failure?.code,'SSE_NOT_CONFIGURED');
 await mounted.dispose();assert.equal(ctx.llm.listProviders().length,0);
 console.log(JSON.stringify({ok:true,dsh:metadata.version,checks:['actual native LLM adapter registration','missing configuration fails without network','unload removes provider'],note:'No browser or model acceptance claim'}));
}finally{await ctx.fiber.dispose();}
