import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const output=path.resolve('qa-output/signature-3d');mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],viewports:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const track=page=>page.on('pageerror',e=>report.errors.push(e.message));
const settled=page=>page.waitForFunction(()=>document.querySelector('.hero').dataset.transitioning==='false');
const ready=page=>page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='ready',{},{timeout:45000});
const turned=page=>page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.turning==='false');
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();track(page);await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1300);
 assert.equal(await page.locator('.author-signature').count(),1);assert.equal(await page.locator('.header-cta').count(),0);
 await page.locator('.author-signature').screenshot({path:path.join(output,'signature.png')});
 await page.screenshot({path:path.join(output,'desktop-cover.png')});
 for(const [index,copy]of[[1,1],[2,0],[3,2],[6,0]]){
  await page.locator(`[data-slide="${index}"]`).click();await settled(page);
  assert.equal(await page.locator('#hero-title').getAttribute('data-copy-index'),String(copy));
 }
 report.checks.push('Firma en la cabecera y tres textos de portada repetidos entre las fotografías');
 await page.locator('#estudio').scrollIntoViewIfNeeded();await ready(page);await page.waitForTimeout(1500);
 assert.equal(await page.locator('.palette-art').getAttribute('data-polish-renderer'),'three');
 assert.equal(await page.locator('#polish-3d canvas').count(),1);
 await page.locator('.palette-section').screenshot({path:path.join(output,'desktop-polish.png')});
 const yaw=Number(await page.locator('#polish-3d').getAttribute('data-yaw'));
 await page.locator('[data-color="#7e9fb9"]').click();await page.waitForTimeout(400);
 assert.equal(await page.locator('#polish-3d').getAttribute('data-turning'),'true');
 assert.ok(Math.abs(Number(await page.locator('#polish-3d').getAttribute('data-yaw'))-yaw)>.2);
 await page.locator('.palette-section').screenshot({path:path.join(output,'desktop-turn.png')});
 await turned(page);await page.waitForTimeout(80);
 assert.equal(await page.locator('#polish-3d').getAttribute('data-color'),'7e9fb9');
 await page.locator('.palette-section').screenshot({path:path.join(output,'desktop-blue.png')});
 await page.locator('[data-color="#db9b76"]').click();await page.waitForTimeout(180);await page.locator('[data-color="#29272c"]').click();await turned(page);await page.waitForTimeout(80);
 assert.equal(await page.locator('#polish-3d').getAttribute('data-color'),'29272c');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(450);
 const paused=Number(await page.locator('#polish-3d').getAttribute('data-frames'));await page.waitForTimeout(350);
 assert.ok(Number(await page.locator('#polish-3d').getAttribute('data-frames'))-paused<=1);
 report.checks.push('Frasco WebGL real: giro, cambio de material, clics rápidos y render pausado fuera de pantalla');
 if(!process.argv.includes('--quick')){
  await page.locator('#estudio').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  await page.evaluate(()=>{const canvas=document.querySelector('#polish-3d canvas');const gl=canvas.getContext('webgl2');gl.getExtension('WEBGL_lose_context').loseContext();});
  await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='fallback');
  await page.locator('[data-color="#647253"]').click();assert.equal(await page.locator('.palette-color-name').textContent(),'04 — OLIVE');
  assert.equal(await page.locator('.polish-bottle').evaluate(e=>getComputedStyle(e).visibility),'visible');
  report.checks.push('Alternativa visual y controles disponibles si se pierde WebGL');
  const reduced=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const mobile=await reduced.newPage();track(mobile);await mobile.goto(url,{waitUntil:'networkidle'});await mobile.evaluate(()=>document.fonts.ready);
  for(const width of [390,320]){
    await mobile.setViewportSize({width,height:844});await mobile.waitForTimeout(250);
    for(const index of [0,1,3]){
      await mobile.locator(`[data-slide="${index}"]`).click();await settled(mobile);
      const fits=await mobile.locator('#hero-title').evaluate(heading=>[...heading.children].every(line=>{const range=document.createRange();range.selectNodeContents(line);return range.getBoundingClientRect().right<=heading.getBoundingClientRect().right+1;}));
      assert.ok(fits,'Los tres textos caben en '+width+'px');
    }
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.viewports.push(width);
  }
  await mobile.setViewportSize({width:390,height:844});await mobile.waitForTimeout(250);await mobile.screenshot({path:path.join(output,'mobile-cover.png')});
  await mobile.locator('#estudio').scrollIntoViewIfNeeded();await ready(mobile);await mobile.locator('[data-color="#7e9fb9"]').click();await turned(mobile);await mobile.waitForTimeout(80);
  assert.equal(await mobile.locator('#polish-3d').getAttribute('data-color'),'7e9fb9');
  assert.ok(Math.abs(Number(await mobile.locator('#polish-3d').getAttribute('data-yaw'))+.32)<.01);
  await mobile.locator('.palette-section').screenshot({path:path.join(output,'mobile-polish.png')});
  report.checks.push('Firma y mensajes a 390/320px, frasco móvil y cambio de color con movimiento reducido');
  await reduced.close();
 }
 await context.close();assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}finally{await browser.close();writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
