import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const cli=path.resolve('node_modules/netlify-cli/bin/run.js');
function run(script,args){
 const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',windowsHide:true,env:{...process.env,NETLIFY_TELEMETRY_DISABLED:'1'}});
 if(result.error)throw result.error;if(result.status!==0)throw Error('No se completó la preparación de Netlify.');
}
if(!process.argv.includes('--runtime-only'))run(cli,['build','--context','production']);
if(process.platform==='win32'){
 // Netlify executes functions on Linux; preserve the local Windows installation.
 const scratch=mkdtempSync(path.join(tmpdir(),'mora-linux-runtime-'));
 const npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const version=JSON.parse(readFileSync('package.json','utf8')).dependencies.sharp;
 run(npm,['install','--prefix',scratch,'--cpu=x64','--os=linux','--libc=glibc','--no-audit','--no-fund','sharp@'+version]);
 const target=path.resolve('.netlify/v1/functions/ssr/node_modules');
 if(!existsSync(target))throw Error('Primero generá la versión para Netlify.');
 cpSync(path.join(scratch,'node_modules'),target,{recursive:true});
 if(!existsSync(path.join(target,'@img/sharp-linux-x64/package.json')))throw Error('Falta el procesador de imágenes para Linux.');
}
if(!process.argv.includes('--runtime-only'))run(cli,['deploy','--prod','--no-build','--skip-functions-cache']);
