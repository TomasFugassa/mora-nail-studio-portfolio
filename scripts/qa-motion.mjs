import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const output=path.resolve('qa-output/motion-final');mkdirSync(output,{recursive:true});
const report={checks:[],rotations:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const track=page=>{
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
};
async function enter(page,suffix=''){
  track(page);await page.goto(url+suffix,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.hero').dataset.transitioning==='false');
}
async function reveal(page){
  const target=page.locator('.faq-list article').first();
  assert.equal(await target.getAttribute('data-scroll-reveal'),'true');
  assert.equal(await target.evaluate(el=>Number(getComputedStyle(el).opacity)),0);
  const samples=await target.evaluate(async el=>{
    scrollTo({top:scrollY+el.getBoundingClientRect().top-innerHeight*.75,behavior:'instant'});
    const values=[],start=performance.now();
    while(performance.now()-start<1900){values.push(Number(getComputedStyle(el).opacity));await new Promise(requestAnimationFrame);}
    return values;
  });
  assert.ok(samples.some(v=>v>.02&&v<.98),'La entrada incluye fotogramas intermedios');
  assert.equal(samples.at(-1),1);
}
async function bottle(page){
  await page.locator('#estudio').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='ready',null,{timeout:45000});
  await page.waitForTimeout(300);
}
async function fullTurn(page,label){
  const samples=await page.evaluate(async()=>{
    const host=document.querySelector('#polish-3d'),values=[Number(host.dataset.yaw)];
    let maxDiscOffset=0;
    document.querySelector('[data-color="#7e9fb9"]').click();
    const start=performance.now();
    do{
      await new Promise(requestAnimationFrame);values.push(Number(host.dataset.yaw));
      const disc=document.querySelector('.palette-disc').getBoundingClientRect(),frame=host.getBoundingClientRect();
      maxDiscOffset=Math.max(maxDiscOffset,Math.abs(disc.x+disc.width/2-frame.x-frame.width/2),Math.abs(disc.y+disc.height/2-frame.y-frame.height/2));
    }
    while(host.dataset.turning==='true'&&performance.now()-start<6500);
    await new Promise(r=>setTimeout(r,100));values.push(Number(host.dataset.yaw));
    return {values,color:host.dataset.color,turning:host.dataset.turning,maxDiscOffset};
  });
  let travel=0,reverse=0;
  for(let i=1;i<samples.values.length;i++){
    let delta=samples.values[i]-samples.values[i-1];
    while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
    travel+=delta;if(delta<-.01)reverse++;
  }
  assert.ok(Math.abs(travel-Math.PI*2)<.05,`${label}: giro completo, ${travel}`);
  assert.equal(reverse,0,`${label}: sin volver hacia atrás`);
  assert.equal(samples.color,'7e9fb9');assert.equal(samples.turning,'false');
  assert.ok(Math.abs(samples.values.at(-1)+.32)<.005);
  assert.ok(samples.maxDiscOffset<2,`${label}: el círculo permanece centrado (${samples.maxDiscOffset}px)`);
  report.rotations.push({label,degrees:Math.round(travel*180/Math.PI),frames:samples.values.length,maxDiscOffset:samples.maxDiscOffset});
}
try{
  for(const [label,settings] of [
    ['desktop',{viewport:{width:1440,height:1000},reducedMotion:'no-preference'}],
    ['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'}],
    ['desktop-windows-reduced',{viewport:{width:1440,height:1000},reducedMotion:'reduce'}],
  ]){
    const context=await browser.newContext(settings),page=await context.newPage();
    await page.addInitScript(()=>localStorage.setItem('mora:motion','reduce'));
    await enter(page,'/');
    assert.equal(await page.locator('html').getAttribute('data-motion'),'full');
    assert.equal(new URL(page.url()).search,'');
    await page.locator('#hero-next').click();
    await page.waitForFunction(()=>document.querySelector('.hero').dataset.activeSlide==='1'&&document.querySelector('.hero').dataset.transitioning==='false');
    await reveal(page);await bottle(page);await fullTurn(page,label);
    await page.locator('[data-color="#db9b76"]').click();await page.waitForTimeout(220);
    await page.locator('[data-color="#29272c"]').click();
    await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.turning==='false');await page.waitForTimeout(80);
    assert.equal(await page.locator('#polish-3d').getAttribute('data-color'),'29272c');
    assert.ok(Math.abs(Number(await page.locator('#polish-3d').getAttribute('data-yaw'))+.32)<.005);
    assert.ok(await page.locator('.palette-disc').evaluate(el=>{
      const disc=el.getBoundingClientRect(),host=document.querySelector('#polish-3d').getBoundingClientRect();
      return Math.abs(disc.x+disc.width/2-host.x-host.width/2)<2&&Math.abs(disc.y+disc.height/2-host.y-host.height/2)<2;
    }),'El círculo sigue centrado después de varios cambios rápidos');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('.palette-section').screenshot({path:path.join(output,label+'-polish.png')});
    if(label==='desktop'){
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(350);
      const frame=Number(await page.locator('#polish-3d').getAttribute('data-frames'));
      await page.waitForTimeout(400);
      assert.ok(Number(await page.locator('#polish-3d').getAttribute('data-frames'))-frame<=1);
      await page.locator('#estudio').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
      await page.evaluate(()=>{
        const gl=document.querySelector('#polish-3d canvas').getContext('webgl2');
        gl.getExtension('WEBGL_lose_context').loseContext();
      });
      await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='fallback');
      const angles=await page.evaluate(async()=>{
        const glass=document.querySelector('.polish-glass'),values=[];
        document.querySelector('[data-color="#647253"]').click();
        const start=performance.now();
        while(performance.now()-start<2100){values.push(getComputedStyle(glass).transform);await new Promise(requestAnimationFrame);}
        return values;
      });
      assert.ok(new Set(angles).size>5,'La alternativa sin WebGL también gira');
      assert.equal(await page.locator('.polish-bottle').evaluate(el=>getComputedStyle(el).visibility),'visible');
      report.checks.push('Render suspendido fuera de pantalla y alternativa animada al perder WebGL');
    }
    report.checks.push(label+': entradas, giro de 360°, clics rápidos y ancho sin desbordes');
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  await enter(page,'/?motion=full');
  assert.equal(new URL(page.url()).search,'');
  assert.equal(await page.locator('html').getAttribute('data-motion'),'full');
  await page.goto(url+'/?motion=auto',{waitUntil:'networkidle'});
  assert.equal(new URL(page.url()).search,'');
  assert.equal(await page.locator('html').getAttribute('data-motion'),'full');
  report.checks.push('Una sola presentación en la URL normal; enlaces anteriores normalizados');
  await context.close();assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}
finally{await browser.close();writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
