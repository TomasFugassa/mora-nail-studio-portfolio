import {chromium} from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {reviewServiceGroups} from './review-editor.mjs';
const url=process.env.MORA_TEST_URL||'http://127.0.0.1:4325';
const quick=process.argv.includes('--quick');
if(new URL(url).port!=='4325')throw Error('Esta revisión usa únicamente el servidor de pruebas 4325.');
const output=path.resolve('qa-output/admin-mora'+(quick?'/quick':''));mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],resources:[],accessibility:[],viewports:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const watch=page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/admin'))report.resources.push([r.status(),r.url()]);});};
const password=readFileSync('.local-admin-access.txt','utf8').match(/Contraseña inicial: ([^\r\n]+)/)[1];
const dialog=page=>page.locator('#editor-dialog');
const closed=page=>page.waitForFunction(()=>!document.querySelector('#editor-dialog').open);
const save=async page=>{await dialog(page).getByRole('button',{name:'Guardar cambios',exact:true}).click();await closed(page);};
const screenshot=async(page,file)=>{await page.waitForTimeout(650);await page.locator('img').evaluateAll(async images=>{await Promise.all(images.filter(image=>image.getBoundingClientRect().bottom>0&&image.getBoundingClientRect().top<innerHeight).map(image=>image.decode().catch(()=>{})));});await page.screenshot({path:path.join(output,file),fullPage:true});};
let snapshot,api;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();watch(page);await page.goto(url+'/admin',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('body').getAttribute('data-mora-panel'),'atelier-1');
 await screenshot(page,'login.png');
 const unsigned=await context.request.get(url+'/api/admin');assert.equal(unsigned.status(),401);
 if(!quick){await page.locator('#admin-password').fill('contraseña incorrecta de prueba');await page.locator('#login-form button[type=submit]').click();await page.locator('#login-error').filter({hasText:/contraseña/i}).waitFor();}
 await page.locator('#admin-password').fill('muestra');await page.locator('#show-password').click();assert.equal(await page.locator('#admin-password').getAttribute('type'),'text');await page.locator('#show-password').click();
 await page.locator('#admin-password').fill(password);await page.locator('#login-form button[type=submit]').click();await page.locator('#admin-workspace').waitFor({state:'visible'});
 api=async(endpoint,input)=>{const res=input?await context.request.post(url+endpoint,{headers:{Origin:url},data:input}):await context.request.get(url+endpoint);return {status:res.status(),data:await res.json()};};
 snapshot=structuredClone((await api('/api/admin')).data.content);
 assert.ok(!(await page.locator('body').innerText()).match(/belén|espacio de prueba|✳/i));
 await screenshot(page,'home.png');
 for(const tab of ['agenda','photos','services','hours','content','location','access','clients']){
  await page.locator(`[data-tab="${tab}"]`).click();assert.equal(await page.locator('#admin-editor').getAttribute('data-view'),tab);await screenshot(page,tab+'.png');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab+' sin desborde');
 }
 report.checks.push('Acceso privado, contraseña visible/oculta, nueve pantallas con identidad Mora y sin referencias a Belén');
 await page.locator('[data-tab="photos"]').click();await page.locator('.photo-edit').first().click();await screenshot(page,'photo-editor.png');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const footer=await dialog(page).locator('.modal-actions').boundingBox();assert.ok(footer.y+footer.height<=844,'Acciones de edición dentro de la pantalla');
  await screenshot(page,'photo-editor-'+width+'.png');
 }
 await page.keyboard.press('Escape');await closed(page);
 await page.setViewportSize({width:1440,height:1000});
 if(!quick){
  await page.locator('[data-tab="home"]').click();await page.getByRole('button',{name:'Agendar un turno',exact:true}).click();
  await page.locator('#manual-service').selectOption('softgel');await page.waitForFunction(()=>document.querySelector('#manual-date').options.length>1);
  const date=await page.locator('#manual-date option').nth(1).getAttribute('value');await page.locator('#manual-date').selectOption(date);await page.locator('#manual-slots button').first().click();
  await page.getByLabel('Nombre del cliente',{exact:true}).fill('Cliente QA Mora');await page.getByLabel('Celular / WhatsApp',{exact:true}).fill('099123456');
  await screenshot(page,'manual-booking.png');await dialog(page).getByRole('button',{name:'Agendar turno',exact:true}).click();await closed(page);
  const booking=(await api('/api/admin')).data.bookings.find(b=>b.name==='Cliente QA Mora'&&b.status==='confirmed');assert.ok(booking);
  const available=(await api('/api/availability?service=softgel&date='+date)).data.slots;assert.ok(!available.some(s=>s.start<booking.end&&s.start+60*60000>booking.start));
  await page.locator('.booking-row').filter({hasText:'Cliente QA Mora'}).click();await screenshot(page,'booking-detail.png');await dialog(page).getByRole('button',{name:'Cancelar turno',exact:true}).click();await dialog(page).getByRole('button',{name:'Liberar horario',exact:true}).click();await closed(page);
  assert.equal((await api('/api/admin')).data.bookings.find(b=>b.id===booking.id).status,'cancelled');
  report.checks.push('Agendar desde Inicio, duración y exclusión de cruces, detalle y cancelación del turno');
  await page.locator('[data-tab="photos"]').click();await page.getByRole('button',{name:'Agregar diseño',exact:true}).click();
  await page.locator('#editor-dialog input[type=file]').setInputFiles('src/assets/mora-atmosphere-card.png');await page.getByLabel('Nombre del diseño',{exact:true}).fill('Diseño QA Mora');await page.locator('.upload-status').filter({hasText:/Foto lista/i}).waitFor();
  await screenshot(page,'upload.png');await dialog(page).locator('button[type=submit]').click();await closed(page);assert.ok((await api('/api/admin')).data.content.collection.photos.some(p=>p.title==='Diseño QA Mora'));
  await page.locator('.photo-card').filter({hasText:'Diseño QA Mora'}).locator('.photo-edit').click();await page.getByLabel('Nombre del diseño',{exact:true}).fill('Diseño QA actualizado');await dialog(page).locator('button[type=submit]').click();await closed(page);assert.ok((await api('/api/admin')).data.content.collection.photos.some(p=>p.title==='Diseño QA actualizado'));
  report.checks.push('Subir una fotografía y guardar y editar su diseño desde la galería');
  await reviewServiceGroups({page,context,url,api,cookie:null,report,output});
  await page.locator('[data-tab="content"]').click();await page.locator('.settings-card').filter({hasText:'Portada · Color'}).click();await page.getByLabel('Primera línea',{exact:true}).fill('Un tono');await save(page);assert.equal((await api('/api/admin')).data.content.copy.hero2Line1,'Un tono');
  const publicPage=await context.newPage();watch(publicPage);await publicPage.goto(url,{waitUntil:'networkidle'});assert.ok((await publicPage.locator('#hero-copies').textContent()).includes('Un tono'));await publicPage.close();
  report.checks.push('Los textos editados en el panel se reflejan en la portada pública');
  await page.locator('[data-tab="access"]').click();await page.locator('.install-access').click();assert.ok(!(await dialog(page).innerText()).includes('Belén'));await screenshot(page,'install.png');await page.keyboard.press('Escape');
  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.locator('#offline-notice').waitFor({state:'visible'});await context.setOffline(false);await page.locator('#offline-notice').waitFor({state:'hidden'});
  report.checks.push('Instalación de Mi Mora e indicador de falta de conexión');
 }
 // Restore edited site content; synthetic bookings stay cancelled in the test database only.
 if(snapshot){const latest=(await api('/api/admin')).data.content;assert.equal((await api('/api/admin',{action:'save',content:{...snapshot,version:latest.version}})).status,200);snapshot=null;await page.reload({waitUntil:'networkidle'});await page.locator('#admin-workspace').waitFor({state:'visible'});}
 if(!quick){
  for(const tab of ['home','agenda','photos','services','hours','content','location','access','clients']){
   await page.locator(`[data-tab="${tab}"]`).click();await page.waitForTimeout(650);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.accessibility.push({tab,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  }
 }
 for(const width of [1024,768,390,360,320]){
  await page.setViewportSize({width,height:900});
  for(const tab of ['home','agenda','photos','services','hours','content','location','access','clients']){
   if(width>760)await page.locator(`[data-tab="${tab}"]`).click();else{
    const primary=page.locator(`[data-route="${tab}"]`);if(await primary.count())await primary.click();else{await page.locator('#more-nav').click();await dialog(page).getByRole('button',{name:({services:'Servicios',hours:'Horarios',content:'Tu página',location:'Ubicación',access:'Acceso',clients:'Clientes'})[tab],exact:true}).click();}
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab+' sin desborde a '+width);
  }
  report.viewports.push(width);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-route="home"]').click();await screenshot(page,'mobile-home.png');await page.locator('[data-route="photos"]').click();await screenshot(page,'mobile-photos.png');await page.locator('[data-route="agenda"]').click();await screenshot(page,'mobile-agenda.png');
 if(!quick){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.accessibility.push({tab:'mobile-agenda',violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});}
 await page.locator('#logout').click();await dialog(page).getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.locator('#admin-login').waitFor({state:'visible'});assert.equal((await context.request.get(url+'/api/admin')).status(),401);await screenshot(page,'mobile-login.png');
 report.checks.push('Navegación completa en cinco tamaños, formularios móviles con acciones visibles y cierre de sesión');
 await context.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.resources,[]);assert.ok(report.accessibility.every(a=>!a.violations.length),'Accesibilidad sin infracciones detectadas');
}catch(error){report.failure=error.stack;throw error;}finally{
 if(snapshot&&api){const latest=(await api('/api/admin')).data.content;await api('/api/admin',{action:'save',content:{...snapshot,version:latest.version}});}
 await browser.close();writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
