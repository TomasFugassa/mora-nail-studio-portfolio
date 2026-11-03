import { NetlifyDB } from '@netlify/database-dev';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const emulator=new NetlifyDB({logger:()=>{}});
let database;
try{
  process.env.MORA_DATABASE_URL=await emulator.start();
  process.env.MORA_DATABASE_DRIVER='postgres';
  process.env.MORA_DEMO_MODE='true';process.env.MORA_ADMIN_PASSWORD=randomUUID();
  await emulator.applyMigrations('./netlify/database/migrations');
  const store=await import('../src/server/store.mjs');database=await store.db();
  const initial=await store.getContent();assert.equal(initial.collection.photos.length,7);
  await store.rateLimit('test-rate',1,15);await assert.rejects(()=>store.rateLimit('test-rate',1,15),{status:429});
  const day=(await store.publicAvailability()).dates[0];
  const slots=(await store.publicAvailability('softgel',day)).slots;
  const request={requestKey:randomUUID(),name:'Cliente de prueba',phone:'099123456',serviceId:'softgel',start:slots[0].start};
  const race=await Promise.allSettled([store.reserve(request),store.reserve({...request,requestKey:randomUUID()})]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(race.find(r=>r.status==='rejected').reason.status,409);
  const booking=race.find(r=>r.status==='fulfilled').value;
  await assert.rejects(()=>database.prepare(`INSERT INTO bookings SELECT ?,?,payload_hash,?,?,"start","end",service_id,service_name,name,phone,reference,status,created FROM bookings WHERE id=?`).run(randomUUID(),randomUUID(),store.digest(randomUUID()),randomUUID(),booking.id),{code:'23P01'});
  const duplicate=await Promise.all([store.reserve(request),store.reserve(request)]);
  assert.ok(duplicate.every(b=>b.id===booking.id));
  assert.equal(booking.end-booking.start,75*60000);
  await store.cancelBooking(booking.token);
  assert.ok((await store.publicAvailability('softgel',day)).slots.some(s=>s.start===booking.start));
  const media=await store.addMedia(Buffer.from('media-data-for-storage-test'));
  assert.equal(Buffer.from(await store.getMedia(media.split('/').pop().slice(0,-5))).toString(),'media-data-for-storage-test');
  const token=await store.login(process.env.MORA_ADMIN_PASSWORD);assert.ok(await store.authenticated(token));
  const saved=await store.saveContent({...initial,copy:{...initial.copy,heroLine1:'Un diseño'}});
  assert.equal(saved.copy.heroLine1,'Un diseño');
  await assert.rejects(()=>store.saveContent(initial),{status:409});
  await store.changePassword(randomUUID());assert.equal(await store.authenticated(token),false);
  await database.close();database=await store.db();assert.equal((await store.getContent()).copy.heroLine1,'Un diseño');
  assert.equal((await store.listBookings()).find(b=>b.id===booking.id).status,'cancelled');
  const realNow=Date.now;process.env.MORA_DEMO_ROLLING='true';
  try{
    Date.now=()=>realNow()+10*86400000;
    assert.ok((await store.publicAvailability()).dates.length>0,'La agenda automática de muestra sigue teniendo fechas disponibles');
    const renewed=await store.getContent();
    await store.saveContent({...renewed,booking:{...renewed.booking,windows:[]}});
    assert.equal((await store.publicAvailability()).dates.length,0,'Los horarios retirados manualmente se respetan');
  }finally{Date.now=realNow;}
  console.log('PASS Postgres: migraciones, persistencia, consultas, reservas simultáneas, reintentos, cancelación, medios, acceso y versiones.');
}finally{if(database)await database.close();await emulator.stop();}
