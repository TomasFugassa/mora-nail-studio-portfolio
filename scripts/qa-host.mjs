import { NetlifyDB } from '@netlify/database-dev';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const postgres=process.argv.includes('--postgres');
const emulator=postgres?new NetlifyDB({logger:()=>{}}):null;
const password=randomUUID();
const environment={...process.env,MORA_DEMO_MODE:'true',MORA_ADMIN_PASSWORD:password,MORA_DATA_DIR:mkdtempSync(path.join(os.tmpdir(),'mora-flow-test-'))};
if(emulator){environment.MORA_DATABASE_URL=await emulator.start();environment.MORA_DATABASE_DRIVER='postgres';await emulator.applyMigrations('./netlify/database/migrations');}
writeFileSync('.local-admin-access.txt',`Panel: http://127.0.0.1:4325/admin\nContraseña inicial: ${password}\nDatos aislados de prueba.\n`,{mode:0o600});
const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4325','--ignore-lock'],{env:environment,stdio:'inherit',windowsHide:true});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;child.kill();if(emulator)await emulator.stop();}
process.on('SIGINT',()=>{void stop();});process.on('SIGTERM',()=>{void stop();});
child.on('exit',async code=>{await stop();process.exitCode=code??0;});
