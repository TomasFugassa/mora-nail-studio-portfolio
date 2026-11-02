import {chromium} from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {reviewServiceGroups} from './review-editor.mjs';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4324';
const output=path.resolve('qa-output/product-refinement/general'+(process.argv.includes('--quick')?'/quick':''));mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const report={checks:[],errors:[],resources:[],accessibility:[],viewports:[]};
const watch=page=>{
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',response=>{
    if(response.status()<400)return;
    const admin=new URL(response.url()).pathname==='/api/admin';
    if(admin&&response.status()===401)return; // Initial unsigned-in request.
    let payload;try{payload=response.request().postDataJSON();}catch{}
    // This deliberate invalid-input test must return 400; other failures remain visible.
    const emptyGroup=payload?.action==='save'&&payload?.content?.studio?.services?.some(s=>!s.tags?.length||s.tags.some(t=>!t.trim()));
    if(admin&&response.status()===400&&emptyGroup)return;
    report.resources.push([response.status(),response.url()]);
  });
};
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();watch(page);
  await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1700);
  const hiddenIntro=await page.locator('.services-header > div').first().evaluate(element=>getComputedStyle(element).opacity);
  assert.equal(hiddenIntro,'0','El encabezado espera su entrada al hacer scroll');
  await page.screenshot({path:path.join(output,'desktop-cover.png')});
  const first=await page.locator('#hero-position').textContent();
  await page.locator('#hero-next').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.hero-slide')].every(layer=>{const opacity=Number(getComputedStyle(layer).opacity);return opacity>.02&&opacity<.98;}));
  await page.screenshot({path:path.join(output,'desktop-transition.png')});
  await page.waitForFunction(()=>document.querySelector('.hero').dataset.transitioning==='false');
  assert.notEqual(await page.locator('#hero-position').textContent(),first);
  await page.waitForFunction(()=>document.querySelector('.hero').dataset.activeSlide==='2',{},{timeout:11000});
  assert.equal(await page.locator('#hero-position').textContent(),'03');
  await page.locator('[data-slide="0"]').click();await page.waitForFunction(()=>document.querySelector('.hero').dataset.transitioning==='false');
  assert.equal(await page.locator('#hero-caption').textContent(),'Cherry');
  assert.equal(await page.locator('.image-credit').count(),0);
  report.checks.push('Portada: cambio manual, reproducción automática, selección por miniatura y texto coordinado');
  await page.locator('#coleccion').scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
  // Start at the first card; centering the full pinned section lands midway through it.
  await page.evaluate(()=>{const spacer=document.querySelector('#coleccion .pin-spacer');if(spacer)window.scrollTo({top:scrollY+spacer.getBoundingClientRect().top-35,behavior:'instant'});});await page.waitForTimeout(1000);
  await page.screenshot({path:path.join(output,'desktop-collection.png')});
  const firstPhoto=page.locator('[data-photo-id="cherry"] img');
  await page.mouse.move(2,2);await page.waitForTimeout(1000);
  await page.locator('[data-photo-id="cherry"]').hover();
  await page.waitForFunction(()=>{const image=document.querySelector('[data-photo-id="cherry"] img');const scale=new DOMMatrixReadOnly(getComputedStyle(image).transform).m11;return scale>1.005&&scale<1.05;});
  const midZoom=await firstPhoto.evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m11);
  assert.ok(midZoom>1&&midZoom<1.055,'El zoom atraviesa estados intermedios');
  await page.waitForTimeout(1000);await page.mouse.move(2,2);await page.waitForTimeout(200);
  assert.ok(await firstPhoto.evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m11>1),'El regreso del zoom también es gradual');
  report.checks.push('Zoom progresivo de entrada y salida sin salto instantáneo');
  assert.equal(await page.locator('.collection.is-pinned').count(),1);
  await page.evaluate(()=>{const spacer=document.querySelector('#coleccion .pin-spacer');window.scrollTo({top:scrollY+spacer.getBoundingClientRect().top+350,behavior:'instant'});});
  await page.waitForTimeout(1100);
  assert.ok(await page.locator('.gallery').evaluate(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m41 < -50));
  report.checks.push('Colección: avance horizontal vinculado al desplazamiento de la página');
  await page.locator('#estudio').scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
  await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.state==='ready',{},{timeout:45000});
  await page.locator('[data-color-name="03 — BLUE"]').click();
  await page.waitForFunction(()=>document.querySelector('#polish-3d').dataset.turning==='false');await page.waitForTimeout(80);
  assert.equal(await page.locator('.palette-color-name').textContent(),'03 — BLUE');
  await page.screenshot({path:path.join(output,'desktop-palette.png')});
  await page.locator('#servicios').scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
  assert.equal(await page.locator('.services-header > div').first().evaluate(element=>getComputedStyle(element).opacity),'1');
  const service=page.locator('.service-row').first();
  const closedHeight=await service.evaluate(element=>element.getBoundingClientRect().height);
  await service.locator('summary').click();await page.waitForTimeout(220);
  const intermediateHeight=await service.evaluate(element=>element.getBoundingClientRect().height);
  await page.waitForTimeout(650);
  const openHeight=await service.evaluate(element=>element.getBoundingClientRect().height);
  assert.ok(intermediateHeight>closedHeight&&intermediateHeight<openHeight,'Apertura progresiva del servicio');
  assert.equal(await page.locator('.service-inquiry').first().evaluate(element=>getComputedStyle(element).borderBottomWidth),'0px');
  await page.screenshot({path:path.join(output,'desktop-services.png')});
  await service.locator('summary').click();await page.waitForTimeout(750);
  assert.equal(await service.evaluate(element=>element.open),false);
  assert.equal(await page.locator('.photo-caption').first().evaluate(element=>getComputedStyle(element).borderTopWidth),'0px');
  assert.equal(await page.locator('.faq-list article').first().evaluate(element=>getComputedStyle(element).borderTopWidth),'0px');
  report.checks.push('Entradas con scroll, apertura y cierre graduales, y separadores sustituidos');
  await page.locator('#reservas').scrollIntoViewIfNeeded();await page.waitForTimeout(1400);await page.screenshot({path:path.join(output,'desktop-booking.png')});
  await page.locator('#contacto').scrollIntoViewIfNeeded();await page.waitForTimeout(1400);await page.screenshot({path:path.join(output,'desktop-contact.png')});
  report.checks.push('Cambio de color del esmalte y estado de selección');
  if(!process.argv.includes('--quick')){
    const reduced=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const web=await reduced.newPage();watch(web);await web.goto(url,{waitUntil:'networkidle'});
    assert.equal(await web.locator('h1').count(),1);
    const entries=await web.locator('.gallery-item').evaluateAll(elements=>elements.map(element=>element.dataset.category));
    assert.equal(entries.length,7);
    assert.ok(!(await web.locator('body').textContent()).includes('BeRe'));
    assert.equal(await web.locator('#inquiry-form').getAttribute('data-phone'),'59895983487');
    for(const id of ['sutil','color','arte','all']){
      const count=id==='all'?entries.length:entries.filter(category=>category===id).length;
      await web.locator(`[data-filter="${id}"]`).click();
      assert.equal(await web.locator('.gallery-item:visible').count(),count);
    }
    await web.locator('[data-photo-id="cherry"]').click();assert.equal(await web.locator('#photo-dialog').evaluate(e=>e.open),true);
    await web.keyboard.press('ArrowRight');assert.equal(await web.locator('#dialog-title').textContent(),'Pearl');
    await web.locator('#use-reference').click();assert.ok((await web.locator('#reference-name').textContent()).includes('Pearl'));
    await web.locator('#service').selectOption('SoftGel');await web.locator('#idea').fill('Me interesa una web para mi negocio');
    await web.evaluate(()=>{window.open=url=>{window.__qaWhatsApp=String(url);return null;};});
    await web.locator('#inquiry-form button[type=submit]').click();
    const wa=await web.evaluate(()=>window.__qaWhatsApp);assert.equal(new URL(wa).pathname,'/59895983487');assert.ok(new URL(wa).searchParams.get('text').includes('Pearl'));
    report.checks.push('Filtros, visor, navegación, referencia y consulta hacia el WhatsApp de Tomás sin enviar mensajes');
    await web.locator('#booking-service').selectOption('semi');
    await web.waitForFunction(()=>document.querySelector('#booking-date').options.length>1);
    const date=await web.locator('#booking-date option').nth(1).getAttribute('value');await web.locator('#booking-date').selectOption(date);
    await web.locator('.slot-button').first().click();await web.locator('#booking-name').fill('Persona QA');await web.locator('#booking-phone').fill('099123456');
    await web.locator('#booking-submit').click();await web.locator('#booking-result').waitFor({state:'visible'});
    const privateLink=await web.locator('#booking-private-link').getAttribute('href');
    assert.equal(new URL(await web.locator('#booking-whatsapp').getAttribute('href')).pathname,'/59895983487');
    const token=new URLSearchParams(privateLink.split('#')[1]).get('token');
    const cancelled=await web.request.post(url+'/api/booking',{headers:{Origin:url},data:{action:'cancel',token}});assert.equal(cancelled.status(),200);
    report.checks.push('Reserva pública guardada, enlace privado, WhatsApp correcto y cancelación del turno de prueba');
    const password=readFileSync('.local-admin-access.txt','utf8').match(/Contraseña inicial: ([^\r\n]+)/)[1];
    const admin=await reduced.newPage();watch(admin);await admin.goto(url+'/admin',{waitUntil:'networkidle'});
    await admin.locator('#admin-password').fill(password);await admin.locator('#login-form button[type=submit]').click();
    await admin.locator('#admin-workspace').waitFor({state:'visible'});
    await admin.locator('[data-tab="agenda"]').click();
    await admin.locator('.calendar-day').filter({hasText:new RegExp('^'+Number(date.slice(-2))+'$')}).click();
    assert.ok((await admin.locator('#admin-editor').textContent()).includes('Persona QA'));
    await admin.screenshot({path:path.join(output,'desktop-admin.png')});
    await admin.locator('[data-tab="content"]').click();assert.ok(!(await admin.locator('#admin-editor').textContent()).includes('Cinta en movimiento'));
    report.checks.push('Acceso al panel, reserva visible en agenda y opciones del editor acordes a la nueva web');
    const api=async(endpoint,input)=>{
      const response=input?await reduced.request.post(url+endpoint,{headers:{Origin:url},data:input}):await reduced.request.get(url+endpoint);
      return {status:response.status(),data:await response.json()};
    };
    const snapshot=structuredClone((await api('/api/admin')).data.content);
    try{await reviewServiceGroups({page:admin,context:reduced,url,api,cookie:null,report,output});}
    finally{const latest=(await api('/api/admin')).data.content;assert.equal((await api('/api/admin',{action:'save',content:{...snapshot,version:latest.version}})).status,200);}
    for(const width of [1440,1024,768,390,360,320]){
      await web.setViewportSize({width,height:900});
      const measure=await web.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));report.viewports.push(measure);assert.ok(measure.scroll<=width,'Sin desborde a '+width);
    }
    await web.setViewportSize({width:390,height:844});await web.evaluate(()=>window.scrollTo(0,0));
    await web.locator('.menu-toggle').click();assert.equal(await web.locator('#mobile-nav').isVisible(),true);await web.locator('#mobile-nav a').first().click();assert.equal(await web.locator('#mobile-nav').isVisible(),false);
    await web.evaluate(()=>window.scrollTo(0,0));await web.screenshot({path:path.join(output,'mobile-cover.png')});
    await web.locator('#reservas').screenshot({path:path.join(output,'mobile-booking.png')});
    for(const [name,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
      await web.setViewportSize({width,height});await web.reload({waitUntil:'networkidle'});await web.evaluate(async()=>{for(const image of document.images){image.loading='eager';await image.decode().catch(()=>{});}});
      const axe=await new AxeBuilder({page:web}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.accessibility.push({name,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
      await web.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
      await web.screenshot({path:path.join(output,name+'-full.png'),fullPage:true});
    }
    await reduced.close();
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const m=await mobile.newPage();watch(m);await m.goto(url,{waitUntil:'networkidle'});await m.waitForTimeout(1500);await m.screenshot({path:path.join(output,'mobile-animated-cover.png')});
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.close();await context.close();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.resources,[]);assert.ok(report.accessibility.every(a=>!a.violations.length),'Accesibilidad sin infracciones detectadas');
}catch(error){report.failure=error.stack;throw error;}finally{writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
