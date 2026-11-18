import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const files=['index.js','client.js'];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:js|mjs)$/.test(file))files.push(file);}}
for(const root of ['lib','ui','scripts','protocol','examples'])if(fs.existsSync(root))walk(root);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`Syntax checked: ${files.length} files`);
