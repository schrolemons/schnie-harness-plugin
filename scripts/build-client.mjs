import { build } from 'esbuild';
import fs from 'node:fs';
const result=await build({entryPoints:['ui/native-cards.js'],bundle:true,format:'cjs',platform:'browser',target:'es2022',external:['react'],write:false,legalComments:'none'});
const source=`/* Generated from ui/native-cards.js. */\nwindow.__ModuleLoader__.load({id:'dsh-schnie-archive',factory(require){const module={exports:{}};const exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`;
fs.writeFileSync(new URL('../client.js',import.meta.url),source);
console.log('Built native conversation citation renderer');
