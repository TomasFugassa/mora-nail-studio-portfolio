import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const output=path.resolve('qa-output/final-polish');mkdirSync(output,{recursive:true});
const report={url,viewports:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
  for(const width of [1440,768,390]){
    const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},hasTouch:width<1000,isMobile:width<761});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(url+'/?motion=full',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.body.classList.contains('motion-ready'));
    const animation=await page.evaluate(async()=>{
      const nodes=[...document.querySelectorAll('[data-scroll-reveal]')];
      const entered=new Set(),intermediate=new Set();
      let checking=true;
      const watch=()=>{
        for(const [i,el]of nodes.entries()){
          if(el.dataset.revealState==='entering'){
            entered.add(i);const opacity=Number(getComputedStyle(el).opacity);
            if(opacity>.02&&opacity<.98)intermediate.add(i);
          }
        }
        if(checking)requestAnimationFrame(watch);
      };watch();
      for(let position=0;position<document.documentElement.scrollHeight;position+=innerHeight*.42){
        scrollTo({top:position,behavior:'instant'});await new Promise(r=>setTimeout(r,440));
      }
      await new Promise(r=>setTimeout(r,1600));checking=false;
      const missing=nodes.filter(el=>el.dataset.revealState!=='visible'||Number(getComputedStyle(el).opacity)<.99).map(el=>({tag:el.tagName,class:el.className,state:el.dataset.revealState}));
      const lower=nodes.filter(el=>el.closest('#estudio,.services-scene,.booking-section,#contacto,.faq-scene,.site-footer'));
      const notAnimated=lower.filter(el=>!intermediate.has(nodes.indexOf(el))).map(el=>({tag:el.tagName,class:el.className}));
      return {total:nodes.length,entered:entered.size,intermediate:intermediate.size,missing,notAnimated};
    });
    assert.deepEqual(animation.missing,[],`${width}: todo el contenido termina visible`);
    assert.deepEqual(animation.notAnimated,[],`${width}: todas las entradas inferiores tienen fotogramas intermedios`);
    assert.equal(await page.locator('.pin-spacer').count(),0);
    const rail=page.locator('.gallery-window'),slider=page.locator('#collection-scroll');
    await slider.scrollIntoViewIfNeeded();
    const box=await slider.boundingBox(),before=await page.evaluate(()=>scrollY);
    await page.mouse.click(box.x+box.width*.78,box.y+box.height/2);await page.waitForTimeout(180);
    const railState=await rail.evaluate(el=>({left:el.scrollLeft,max:el.scrollWidth-el.clientWidth,transform:getComputedStyle(el.firstElementChild).transform}));
    assert.ok(railState.left>railState.max*.6,`${width}: la barra mueve la colección`);
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<2);
    assert.equal(railState.transform,'none');
    await slider.focus();await page.keyboard.press('Home');await page.waitForTimeout(100);
    assert.ok(await rail.evaluate(el=>el.scrollLeft)<2);
    await page.keyboard.press('End');await page.waitForTimeout(100);
    assert.ok(await rail.evaluate(el=>Math.abs(el.scrollLeft-(el.scrollWidth-el.clientWidth)))<2);
    await rail.evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-30,behavior:'instant'}));
    const horizontal=await rail.evaluate(el=>el.scrollLeft),vertical=await page.evaluate(()=>scrollY);
    await page.mouse.move(width*.5,220);await page.mouse.wheel(0,220);await page.waitForTimeout(220);
    assert.ok(await page.evaluate(()=>scrollY)>vertical+100);
    assert.ok(Math.abs(await rail.evaluate(el=>el.scrollLeft)-horizontal)<2,`${width}: la rueda vertical no cambia los diseños`);
    await page.locator('.filter').nth(1).click();await page.waitForTimeout(500);
    const visible=await page.locator('.gallery-item:not([hidden])').count();
    assert.equal(Number(await page.locator('#photo-count').textContent()),visible);
    assert.ok(await rail.evaluate(el=>el.scrollLeft)<2);
    await page.locator('[data-filter="all"]').click();await page.waitForTimeout(500);
    await page.locator('.collection').screenshot({path:path.join(output,width+'-collection.png')});
    await page.locator('#estudio').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='ready',null,{timeout:45000});
    const alignment=await page.locator('.palette-art').evaluate(el=>{
      const disc=el.querySelector('.palette-disc').getBoundingClientRect(),host=el.querySelector('#polish-3d').getBoundingClientRect();
      return {x:Math.abs(disc.x+disc.width/2-host.x-host.width/2),y:Math.abs(disc.y+disc.height/2-host.y-host.height/2),round:Math.abs(disc.width-disc.height)};
    });
    assert.ok(alignment.x<2&&alignment.y<2&&alignment.round<2);
    await page.locator('.palette-section').screenshot({path:path.join(output,width+'-bottle.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    report.viewports.push({width,animation,independentCollection:true,alignment});
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}
finally{await browser.close();writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
