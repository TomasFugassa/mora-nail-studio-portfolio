import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/astro/bin/astro.mjs','build'],{stdio:'inherit',windowsHide:true,env:{...process.env,MORA_PLATFORM:'netlify'}});
if(result.error)throw result.error;
process.exit(result.status??1);
