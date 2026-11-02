import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const output=path.resolve('qa-output/product-refinement');mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],resources:[],viewports:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const watch=page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.resources.push([r.status(),r.url()]);});};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();watch(page);await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1500);
 assert.ok(!(await page.title()).match(/muestra|demo/i));
 assert.ok(!(await page.locator('body').innerText()).match(/marca ficticia|imágenes generadas|demostración|conceptual/i));
 const signature=await page.locator('.author-signature').boundingBox();assert.ok(signature.width<=105&&signature.height<=52);
 await page.locator('.site-header').screenshot({path:output+'/header.png'});await page.screenshot({path:output+'/cover.png'});
 report.checks.push('Firma más pequeña, presentación de marca y textos públicos sin etiquetas de demostración');
 await page.locator('#estudio').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='ready',{},{timeout:45000});await page.waitForTimeout(1500);
 await page.locator('.palette-section').screenshot({path:output+'/polish-cherry.png'});
 await page.locator('[data-color="#7e9fb9"]').click();await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.turning==='false');await page.waitForTimeout(100);
 assert.equal(await page.locator('#polish-3d').getAttribute('data-color'),'7e9fb9');await page.locator('.palette-section').screenshot({path:output+'/polish-blue.png'});
 report.checks.push('Frasco 3D de menor escala, vidrio separado, tapa metálica y cambio de color');
 for(const section of ['services','faq']){
  const scene=page.locator('.'+section+'-scene');await scene.scrollIntoViewIfNeeded();await scene.locator('[aria-hidden=true] img').first().evaluate(image=>image.decode());await page.waitForTimeout(1500);
  const geometry=await scene.evaluate(el=>{const inner=el.querySelector('section'),art=el.querySelector('[aria-hidden=true]');return{scene:el.clientWidth,content:inner.clientWidth,background:art.clientWidth,behind:inner.contains(art)===false};});
  assert.equal(geometry.scene,1440);assert.ok(geometry.content<geometry.scene);assert.equal(geometry.background,1440);assert.equal(geometry.behind,true);
  await scene.screenshot({path:output+'/'+section+'.png'});
 }
 report.checks.push('Fondos fotográficos difuminados a todo el ancho, fuera del contenedor de texto');
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const m=await mobile.newPage();watch(m);await m.goto(url,{waitUntil:'networkidle'});await m.evaluate(()=>document.fonts.ready);
 for(const width of [390,320]){
  await m.setViewportSize({width,height:844});await m.waitForTimeout(300);
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok((await m.locator('.author-signature').boundingBox()).width<85);report.viewports.push(width);
 }
 await m.setViewportSize({width:390,height:844});await m.waitForTimeout(300);await m.screenshot({path:output+'/mobile-cover.png'});
 for(const section of ['services','faq']){const scene=m.locator('.'+section+'-scene');await scene.scrollIntoViewIfNeeded();await scene.locator('[aria-hidden=true] img').first().evaluate(image=>image.decode());await scene.screenshot({path:output+'/mobile-'+section+'.png'});}
 await mobile.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.resources,[]);
}catch(error){report.failure=error.stack;throw error;}finally{await browser.close();writeFileSync(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
