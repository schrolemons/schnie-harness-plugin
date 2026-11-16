import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const git=(args,extra={})=>execFileSync('git',['-c','core.quotepath=false','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],...extra});
let ownGit=false;
try{ownGit=fs.realpathSync(git(['rev-parse','--show-toplevel']).trim())===fs.realpathSync(root);}catch{}
const fingerprints=new Set(JSON.parse(fs.readFileSync(new URL('../.private-prompt-fingerprints.json',import.meta.url),'utf8')));
const checks=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['github-credential',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['provider-key',/\bsk-[A-Za-z0-9_-]{24,}\b/],
 ['aws-credential',/\bAKIA[A-Z0-9]{16}\b/],
 ['credential-in-url',/https?:\/\/[^\s/@]+:[^\s/@]+@/],
 ['personal-path',/[A-Za-z]:[\\/](?:Users|PERSONAL INFORMATION)[\\/]/i],
];
const findings=[];
function inspect(file,bytes,commit){
 const text=bytes.toString('utf8');if(text.includes('\0'))return;
 const report=reason=>findings.push({file,reason,...(commit?{object:commit}:{})});
 if((/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.env.example'))||/(^|\/)(?:id_rsa|id_ed25519)$|\.(?:pem|key)$/.test(file))report('private-file');
 for(const [reason,pattern]of checks)if(pattern.test(text))report(reason);
 if(text.split(/\r?\n/).some(line=>fingerprints.has(createHash('sha256').update(line.trim()).digest('hex'))))report('private-prompt-fingerprint');
}
let count=0;
if(process.argv.includes('--history')){
 if(!ownGit)throw new Error('History check requires a Git checkout rooted at this project.');
 const objects=git(['rev-list','--objects','HEAD']).trim().split('\n');
 for(const entry of objects){const space=entry.indexOf(' ');if(space<0)continue;const sha=entry.slice(0,space),file=entry.slice(space+1);const type=git(['cat-file','-t',sha]).trim();if(type!=='blob')continue;count++;inspect(file,git(['cat-file','-p',sha],{encoding:'buffer',maxBuffer:4*1024*1024}),sha);}
}else{
 const excluded=new Set(['.git','node_modules','dist','release','.reports','.sources','.vercel','coverage']);
 const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const relative=path.join(dir,entry.name);
  return excluded.has(entry.name)?[]:entry.isDirectory()&&!entry.isSymbolicLink()?walk(relative):[relative];
 });
 const files=ownGit?git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean):walk('');
 for(const file of files){const full=path.join(root,file);if(!fs.existsSync(full))continue;const stat=fs.lstatSync(full);if(stat.isSymbolicLink()){findings.push({file,reason:'symbolic-link'});continue;}if(!stat.isFile()||stat.size>2_000_000)continue;count++;inspect(file,fs.readFileSync(full));}
}
console.log(JSON.stringify({ok:findings.length===0,scope:process.argv.includes('--history')?'reachable HEAD history':'current public files',checked:count,findings},null,2));
if(findings.length)process.exitCode=1;
