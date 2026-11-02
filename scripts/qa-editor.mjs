import {chromium} from 'playwright-core';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {reviewServiceGroups} from './review-editor.mjs';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const output=path.resolve('qa-output/atmosphere/editor');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const report={checks:[],errors:[]};
const api=async(endpoint,input)=>{const response=input?await context.request.post(url+endpoint,{headers:{Origin:url},data:input}):await context.request.get(url+endpoint);return {status:response.status(),data:await response.json()};};
let snapshot;
try{
  const page=await context.newPage();await page.goto(url+'/admin',{waitUntil:'networkidle'});
  const password=readFileSync('.local-admin-access.txt','utf8').match(/Contraseña inicial: ([^\r\n]+)/)[1];
  await page.locator('#admin-password').fill(password);await page.locator('#login-form button[type=submit]').click();await page.locator('#admin-workspace').waitFor({state:'visible'});
  snapshot=structuredClone((await api('/api/admin')).data.content);
  await reviewServiceGroups({page,context,url,api,cookie:null,report,output});
}finally{
  if(snapshot){const latest=(await api('/api/admin')).data.content;assert.equal((await api('/api/admin',{action:'save',content:{...snapshot,version:latest.version}})).status,200);}
  writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
console.log(JSON.stringify(report));
