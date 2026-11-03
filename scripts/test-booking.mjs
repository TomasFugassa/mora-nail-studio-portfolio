import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
if (!process.argv.includes('--race-worker')) {
    process.env.BERE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'bere-booking-test-'));
    process.env.BERE_DEMO_MODE = 'true';
    process.env.BERE_ADMIN_PASSWORD = randomUUID();
}
const store = await import('../src/server/store.mjs');
if (process.argv.includes('--race-worker')) {
    await store.db();
    process.send({ ready: true });
    process.on('message', async (input) => {
        try {
            process.send({ status: 200, result: await store.reserve(input) });
        }
        catch (error) {
            process.send({ status: error.status || 500 });
        }
        finally {
            await (await store.db()).close();
            process.disconnect();
        }
    });
}
else {
    const { getContent, publicAvailability, reserve, cancelBooking, saveContent, blockTime, changeBooking, lookupBooking, db, login, authenticated, changePassword, } = store;
    const base = await getContent();
    assert.equal(base.location.confirmed, false);
    assert.ok(base.booking.services.every((s) => [30, 60].includes(s.minutes)));
    const date = (await publicAvailability()).dates[0], initial = (await publicAvailability('semi', date)).slots;
    assert.ok(initial.length > 6);
    const payload = (start, serviceId = 'semi') => ({
        name: 'Persona de prueba',
        phone: '099123456',
        serviceId,
        start,
        reference: 'Referencia de prueba',
        requestKey: randomUUID(),
    });
    const input = payload(initial[0].start), first = await reserve(input);
    assert.equal((await reserve(input)).id, first.id);
    await assert.rejects(async () => await reserve({ ...input, name: 'Otra persona' }), { status: 409 });
    await assert.rejects(async () => await reserve(payload(initial[1].start, 'softgel')), { status: 409 });
    await assert.rejects(async () => await reserve(payload(initial[0].start)), { status: 409 });
    assert.ok(!(await publicAvailability('semi', date)).slots.some((s) => s.start === first.start));
    assert.ok(!JSON.stringify(await publicAvailability('semi', date)).includes('Persona de prueba'));
    assert.equal((await lookupBooking(first.token)).id, first.id);
    await assert.rejects(async () => await lookupBooking('x'.repeat(43)), { status: 404 });
    await cancelBooking(first.token);
    assert.ok((await publicAvailability('semi', date)).slots.some((s) => s.start === first.start));
    await assert.rejects(async () => await reserve(payload(Date.now() - 86400000)), { status: 409 });
    await assert.rejects(async () => await publicAvailability('semi', '2026-99-99'), { status: 400 });
    await assert.rejects(async () => await reserve({ ...payload(initial[0].start), phone: 'hola' }), { status: 400 });
    async function race(a, b) {
        const workers = [
            fork(new URL(import.meta.url), ['--race-worker'], {
                env: process.env,
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            }),
            fork(new URL(import.meta.url), ['--race-worker'], {
                env: process.env,
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
            }),
        ];
        await Promise.all(workers.map((worker) => new Promise((resolve, reject) => {
            worker.once('message', resolve);
            worker.once('error', reject);
        })));
        const promises = workers.map((worker) => new Promise((resolve, reject) => {
            worker.once('message', resolve);
            worker.once('error', reject);
        }));
        workers[0].send(a);
        workers[1].send(b);
        return Promise.all(promises);
    }
    const raceOne = await race(payload(initial[4].start), payload(initial[4].start));
    assert.deepEqual(raceOne.map((r) => r.status).sort(), [200, 409]);
    await cancelBooking(raceOne.find((r) => r.status === 200).result.token);
    const raceOverlap = await race(payload(initial[4].start, 'softgel'), payload(initial[5].start));
    assert.deepEqual(raceOverlap.map((r) => r.status).sort(), [200, 409]);
    await cancelBooking(raceOverlap.find((r) => r.status === 200).result.token);
    await blockTime({ date, start: '09:00', end: '10:00', note: 'Compromiso de prueba' });
    assert.ok(!(await publicAvailability('semi', date)).slots.some((s) => s.time < '10:00'));
    await assert.rejects(async () => await reserve(payload(initial[0].start)), { status: 409 });
    const block = await (await db()).prepare("SELECT id FROM bookings WHERE service_id='blocked'").get();
    await changeBooking(block.id, 'cancelled');
    assert.ok((await publicAvailability('semi', date)).slots.some((s) => s.time === '09:00'));
    const done = await reserve(payload(initial[0].start));
    await assert.rejects(async () => await changeBooking(done.id, 'completed'), { status: 409 });
    const realNow = Date.now;
    try {
        Date.now = () => done.start + 1000;
        await changeBooking(done.id, 'completed');
    }
    finally {
        Date.now = realNow;
    }
    await assert.rejects(async () => await cancelBooking(done.token), { status: 409 });
    assert.ok(!(await publicAvailability('semi', date)).slots.some((s) => s.start === done.start));
    const newer = await saveContent({
        ...await getContent(),
        booking: { ...(await getContent()).booking, enabled: false },
    });
    assert.equal(newer.booking.enabled, false);
    await assert.rejects(async () => await reserve(payload(initial[10].start)), { status: 409 });
    await assert.rejects(async () => await saveContent(base), { status: 409 });
    const token = await login(process.env.BERE_ADMIN_PASSWORD);
    assert.ok(await authenticated(token));
    await changePassword(randomUUID());
    assert.equal(await authenticated(token), false);
    const backup = path.join(process.env.BERE_DATA_DIR, 'backup.sqlite');
    await (await db()).exec("VACUUM INTO '" + backup.replaceAll("'", "''") + "'");
    const { DatabaseSync } = await import('node:sqlite'), snapshot = new DatabaseSync(backup, { readOnly: true });
    assert.equal(snapshot.prepare('SELECT COUNT(*) AS n FROM bookings').get().n, (await (await db()).prepare('SELECT COUNT(*) AS n FROM bookings').get()).n);
    snapshot.close();
    await (await db()).close();
    console.log('OK: concurrencia entre procesos, superposiciones, reintentos, cancelación, bloqueos, fechas de Uruguay, acceso y copia recuperable.');
}
