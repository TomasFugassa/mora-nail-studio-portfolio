import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=portIndex<0?'4324':args.splice(portIndex,2)[1];
if(!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Elegí un puerto entre 1024 y 65535.');
if(args.some(flag=>!['--background','--ignore-lock'].includes(flag)))throw Error('Opción desconocida para la vista de red.');
const replace=args.includes('--ignore-lock')?[]:['--force'];
console.log('Mora · Vista en la red del router. Usá en el celular la dirección Network de la PC.');
const child=spawnSync(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','0.0.0.0','--port',port,...replace,...args],{
  stdio:'inherit',windowsHide:true,env:{...process.env,MORA_LAN:'1',MORA_LAN_PORT:port},
});
if(child.error)throw child.error;
process.exit(child.status??1);
