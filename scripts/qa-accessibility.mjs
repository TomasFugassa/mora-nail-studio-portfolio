import {chromium} from 'playwright-core';
import {staticAccessibility} from './review-accessibility.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4325',{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;for(const image of document.images){image.loading='eager';await image.decode().catch(()=>{});}});
 const axe=await staticAccessibility(page);report.push({width,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
 await context.close();
}assert.ok(report.every(r=>r.violations.length===0));}finally{await browser.close();mkdirSync('qa-output/accessibility',{recursive:true});writeFileSync('qa-output/accessibility/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
