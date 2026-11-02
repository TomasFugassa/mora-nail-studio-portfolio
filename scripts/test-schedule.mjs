import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
process.env.BERE_DATA_DIR=mkdtempSync(path.join(os.tmpdir(),'bere-schedule-'));process.env.BERE_DEMO_MODE='true';process.env.BERE_ADMIN_PASSWORD=randomUUID();
const realNow=Date.now;let now=Date.parse('2026-11-02T11:01:00-03:00');Date.now=()=>now;
const {getContent,saveContent,publicAvailability,reserve,cancelBooking,changeBooking,db}=await import('../src/server/store.mjs');
const date='2026-11-02';
function settings(update){const content=getContent();return saveContent({...content,booking:{...content.booking,...update}})}
function times(){return publicAvailability('softgel',date).slots.map(s=>s.time)}
function at(time){return Date.parse(date+'T'+time+':00-03:00')}
try{
 settings({enabled:true,minLeadMinutes:120,bufferMinutes:15,windows:[{id:'morning',date,start:'09:00',end:'18:00'}]});
 assert.equal(times()[0],'13:15');assert.equal(times().at(-1),'16:45');assert.ok(times().includes('14:00'));assert.ok(times().includes('14:15'));
 const booking=reserve({requestKey:randomUUID(),name:'Prueba aislada',phone:'099123456',serviceId:'softgel',start:at('14:00')});assert.equal(booking.end,at('15:15'));assert.deepEqual(times().filter(t=>t>='13:00'),['15:15','15:30','15:45','16:00','16:15','16:30','16:45']);
 assert.throws(()=>changeBooking(booking.id,'completed'),{status:409});cancelBooking(booking.token);assert.ok(times().includes('14:00'));
 settings({windows:[{id:'one',date,start:'09:00',end:'18:00'},{id:'two',date,start:'18:00',end:'18:30'}]});assert.equal(times().at(-1),'17:15');
 settings({minLeadMinutes:0,windows:[{id:'one',date,start:'09:00',end:'12:00'},{id:'two',date,start:'13:00',end:'18:00'}]});now=Date.parse('2026-11-02T08:00:00-03:00');assert.equal(times()[0],'09:00');assert.ok(!times().includes('11:00'));assert.ok(times().includes('10:45'));assert.ok(times().includes('13:00'));
 const done=reserve({requestKey:randomUUID(),name:'Historial aislado',phone:'099123456',serviceId:'softgel',start:at('09:00')});now=at('09:30');changeBooking(done.id,'completed');assert.ok(!times().includes('10:00'));assert.ok(times().includes('10:15'));
 const future='2027-02-01';settings({maxAdvanceDays:30,windows:[{id:'far',date:future,start:'09:00',end:'18:00'}]});assert.equal(publicAvailability('softgel',future).slots.length,0);assert.ok(!publicAvailability().dates.includes(future));settings({maxAdvanceDays:0});assert.ok(publicAvailability().dates.includes(future));assert.equal(publicAvailability('softgel',future).slots[0].time,'09:00');
 console.log('PASS: 13:15 por anticipación de 2 h; servicio de 60 + descanso 15; inicios cada 15; franjas continuas unidas; pausa respetada; límite opcional; realizado conserva ocupación.');
}finally{Date.now=realNow;db().close()}
