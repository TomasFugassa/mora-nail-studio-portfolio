import {chromium} from 'playwright-core';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const url=process.env.MORA_TEST_URL||'http://192.168.1.2:4325';
if(new URL(url).port!=='4325')throw Error('Las reservas de prueba usan solamente el puerto 4325.');
const output=path.resolve('qa-output/cover-lan');mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],frames:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
let cancel;
try{
 const context=await browser.newContext({viewport:{width:1905,height:875},reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 const settle=()=>page.waitForFunction(()=>document.querySelector('.hero').dataset.transitioning==='false');
 for(const [width,height]of [[1905,875],[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[768,900],[1440,640],[1280,600]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(350);
  for(const index of [0,1,3]){
   await page.locator(`[data-slide="${index}"]`).click();await settle();
   const geometry=await page.evaluate(()=>{const cover=document.querySelector('.hero'),copy=document.querySelector('.hero-copy'),bar=document.querySelector('.hero-control-bar');return {width:innerWidth,height:innerHeight,bottom:bar.getBoundingClientRect().bottom,copyScroll:copy.scrollHeight,copyHeight:copy.clientHeight,tall:cover.classList.contains('is-tall'),horizontal:document.documentElement.scrollWidth};});
   report.frames.push({...geometry,index});
   if(geometry.bottom>height+1||geometry.tall||geometry.horizontal>width){await page.screenshot({path:output+`/failure-${width}-${height}-${index}.png`});throw Error('Portada fuera de pantalla: '+JSON.stringify(geometry));}
  }
  if(width===1905||width===1366)await page.screenshot({path:output+`/cover-${width}-${height}.png`});
 }
 report.checks.push('Foto, texto y miniaturas completos en nueve tamaños de escritorio con los tres mensajes');
 assert.equal(await page.evaluate(()=>window.isSecureContext),false,'La prueba reproduce HTTP por IP de red');
 assert.equal(await page.evaluate(()=>typeof crypto.randomUUID),'undefined');
 await page.locator('#booking-service').selectOption('semi');await page.waitForFunction(()=>document.querySelector('#booking-date').options.length>1);
 await page.locator('#booking-date').selectOption(await page.locator('#booking-date option').nth(1).getAttribute('value'));await page.locator('.slot-button').first().click();await page.locator('#booking-name').fill('Prueba LAN Mora');await page.locator('#booking-phone').fill('099123456');await page.locator('#booking-submit').click();await page.locator('#booking-result').waitFor({state:'visible'});
 const link=await page.locator('#booking-private-link').getAttribute('href');const token=new URLSearchParams(link.split('#')[1]).get('token');
 cancel=async()=>context.request.post(url+'/api/booking',{headers:{Origin:url},data:{action:'cancel',token}});assert.equal((await cancel()).status(),200);cancel=null;
 const forged=await context.request.post(url+'/api/booking',{headers:{Origin:'http://otra-pagina.invalid'},data:{action:'lookup',token}});assert.equal(forged.status(),403);
 report.checks.push('Reserva por HTTP local sin randomUUID nativo, cancelación y rechazo de otro origen');
 const admin=await context.newPage();admin.on('pageerror',e=>report.errors.push(e.message));await admin.goto(url+'/admin',{waitUntil:'networkidle'});
 const password=readFileSync('.local-admin-access.txt','utf8').match(/Contraseña inicial: ([^\r\n]+)/)[1];await admin.locator('#admin-password').fill(password);await admin.locator('#login-form button[type=submit]').click();await admin.locator('#admin-workspace').waitFor({state:'visible'});
 for(const [tab,label,title]of [['photos','Agregar diseño','Nuevo diseño'],['services','Agregar servicio','Nuevo servicio'],['hours','Agregar horario','Nuevo horario']]){
  await admin.locator(`[data-tab="${tab}"]`).click();await admin.getByRole('button',{name:label,exact:true}).click();assert.equal(await admin.locator('#dialog-heading').textContent(),title);await admin.keyboard.press('Escape');
 }
 await admin.locator('[data-tab="home"]').click();await admin.getByRole('button',{name:'Agendar un turno',exact:true}).click();await admin.locator('#manual-service').selectOption('semi');await admin.waitForFunction(()=>document.querySelector('#manual-date').options.length>1);await admin.locator('#manual-date').selectOption(await admin.locator('#manual-date option').nth(1).getAttribute('value'));await admin.locator('#manual-slots button').first().click();await admin.keyboard.press('Escape');
 report.checks.push('Acceso al panel y formularios de alta desde HTTP de red local');
 for(const [width,height]of [[390,844],[320,720]]){await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+`/mobile-${width}.png`});}
 await context.close();assert.deepEqual(report.errors,[]);
}catch(error){report.failure=error.stack;throw error;}finally{if(cancel)await cancel();await browser.close();writeFileSync(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:report.frames.length}));}
