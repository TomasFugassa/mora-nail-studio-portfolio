import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.BERE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'bere-manual-test-'));
process.env.BERE_DEMO_MODE = 'true';
process.env.BERE_ADMIN_PASSWORD = randomUUID();
const realNow = Date.now;
const date = '2026-11-02';
const at = (time, day = date) => Date.parse(day + 'T' + time + ':00-03:00');
Date.now = () => at('11:01');
const { getContent, saveContent, adminAvailability, publicAvailability, reserve, cancelBooking, blockTime, db, } = await import('../src/server/store.mjs');
const settings = async (changes) => {
    const content = await getContent();
    return await saveContent({ ...content, booking: { ...content.booking, ...changes } });
};
const payload = (time, serviceId = 'softgel', day = date) => ({
    requestKey: randomUUID(),
    serviceId,
    start: at(time, day),
    name: 'Cliente presencial',
    phone: '099123456',
});
try {
    await settings({
        enabled: true,
        minLeadMinutes: 120,
        bufferMinutes: 15,
        maxAdvanceDays: 30,
        windows: [{ id: 'shift', date, start: '09:00', end: '18:00' }],
    });
    assert.equal((await publicAvailability('softgel', date)).slots[0].time, '13:15');
    assert.equal((await adminAvailability('softgel', date)).slots[0].time, '11:15');
    await assert.rejects(async () => await reserve({ ...payload('11:15'), administrator: true }), { status: 409 });
    const input = payload('11:15');
    const manual = await reserve(input, { administrator: true });
    assert.equal(manual.status, 'confirmed');
    assert.equal(manual.end, at('12:30'));
    assert.equal((await reserve(input, { administrator: true })).id, manual.id);
    await assert.rejects(async () => await reserve({ ...input, name: 'Otro cliente' }, { administrator: true }), {
        status: 409,
    });
    await assert.rejects(async () => await reserve(payload('11:30', 'semi'), { administrator: true }), { status: 409 });
    assert.equal((await adminAvailability('softgel', date)).slots[0].time, '12:30');
    await cancelBooking(manual.token);
    assert.equal((await adminAvailability('softgel', date)).slots[0].time, '11:15');
    await assert.rejects(async () => await reserve(payload('10:00'), { administrator: true }), { status: 409 });
    await assert.rejects(async () => await reserve(payload('17:00'), { administrator: true }), { status: 409 });
    await blockTime({ date, start: '13:00', end: '14:00', note: 'Pausa' });
    await assert.rejects(async () => await reserve(payload('13:15'), { administrator: true }), { status: 409 });
    const publicBooking = await reserve(payload('14:00'));
    await assert.rejects(async () => await reserve(payload('14:15'), { administrator: true }), { status: 409 });
    assert.ok(!(await adminAvailability('semi', date)).slots.some((s) => s.start >= at('14:00') && s.start < at('15:15')));
    await cancelBooking(publicBooking.token);
    await settings({ enabled: false });
    assert.equal((await publicAvailability('softgel', date)).slots.length, 0);
    assert.ok((await adminAvailability('softgel', date)).slots.length > 0);
    await assert.rejects(async () => await reserve(payload('15:00')), { status: 409 });
    const paused = await reserve(payload('15:00'), { administrator: true });
    await cancelBooking(paused.token);
    const far = '2027-02-01';
    await settings({ enabled: true, windows: [{ id: 'far', date: far, start: '09:00', end: '18:00' }] });
    assert.ok(!(await publicAvailability()).dates.includes(far));
    assert.ok((await adminAvailability()).dates.includes(far));
    await assert.rejects(async () => await reserve(payload('09:00', 'softgel', far)), { status: 409 });
    const farBooking = await reserve(payload('09:00', 'softgel', far), { administrator: true });
    await cancelBooking(farBooking.token);
    const content = await getContent();
    content.booking.services.find((s) => s.id === 'softgel').active = false;
    await saveContent(content);
    assert.equal((await adminAvailability('softgel', far)).slots.length, 0);
    await assert.rejects(async () => await reserve(payload('09:00', 'softgel', far), { administrator: true }), {
        status: 409,
    });
    console.log('PASS: alta manual, reintentos, duración y descanso, cruces público/panel, bloqueo, pasado, fin de jornada, pausa pública, anticipación y límite exclusivos de visitantes; servicios ocultos respetados.');
}
finally {
    Date.now = realNow;
    await (await db()).close();
}
