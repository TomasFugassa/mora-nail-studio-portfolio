import { getDatabase as db, demo } from './database.mjs';
import { Problem, digest, passwordHash } from './security.mjs';
import { localDate, timeNumber, zonedTime } from './time.mjs';
import { seedPhotos, createSeed } from './seed.mjs';
export { db, demo, Problem, digest, passwordHash, localDate, zonedTime };
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { extraHeroCopy } from '../data/hero-copy.mjs';
export async function getContent() {
    const database=await db();
    const row = await database.prepare('SELECT * FROM content WHERE id=1').get();
    const content = JSON.parse(row.payload);
    const windows=content.booking.windows;
    if(demo&&process.env.MORA_DEMO_ROLLING==='true'&&windows.length&&windows.every(window=>window.id.startsWith('demo-')&&window.date<localDate())){
      content.booking.windows=createSeed({demo:true}).booking.windows;
      const refreshed=await database.prepare('UPDATE content SET version=version+1,payload=? WHERE id=1 AND version=?').run(JSON.stringify(content),row.version);
      if(!refreshed.changes)return getContent();
      row.version++;
    }
    return { version: row.version, ...content, copy: { ...extraHeroCopy, ...content.copy } };
}
function text(value, max = 500) {
    if (typeof value !== 'string' || value.length > max)
        throw new Problem(400, 'Revisá los textos y su longitud.');
    return value.trim();
}
function list(value, max = 100) {
    if (!Array.isArray(value) || value.length > max)
        throw new Problem(400, 'Lista inválida.');
    return value;
}
function number(value, min, max) {
    if (!Number.isInteger(value) || value < min || value > max)
        throw new Problem(400, 'Valor numérico inválido.');
    return value;
}
function dateCheck(date) {
    const parsed = new Date(String(date) + 'T12:00:00Z');
    if (typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(+parsed) ||
        parsed.toISOString().slice(0, 10) !== date)
        throw new Problem(400, 'Fecha inválida.');
    return date;
}
async function imagePath(value) {
    const p = text(value, 250);
    if (/^\/src\/assets\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/.test(p) &&
        seedPhotos.some((photo) => photo.image === p))
        return p;
    if (/^\/media\/[a-f0-9-]{36}\.webp$/.test(p) && await (await db()).prepare('SELECT id FROM media WHERE id=?').get(p.split('/').pop().slice(0, -5)))
        return p;
    throw new Problem(400, 'Usá una foto de la galería o subí una imagen desde el panel.');
}
export async function saveContent(input) {
    return await (await db()).transaction(async () => {
        if (!input || typeof input !== 'object')
            throw new Problem(400, 'Faltan los datos a guardar.');
        const old = await getContent();
        const s = input.studio, c = input.collection, b = input.booking;
        if (!s || !c || !b || !input.copy || !input.location)
            throw new Problem(400, 'Faltan campos.');
        const studio = { ...old.studio };
        for (const k of [
            'name',
            'location',
            'intro',
            'email',
            'whatsappPhone',
            'instagram',
            'facebook',
            'whatsappProfile',
        ])
            studio[k] = text(s[k], k === 'intro' ? 2000 : 250);
        if (!/^598\d{8}$/.test(studio.whatsappPhone))
            throw new Problem(400, 'WhatsApp: 598 seguido de ocho dígitos.');
        for (const k of ['instagram', 'facebook', 'whatsappProfile']) {
            try {
                if (new URL(studio[k]).protocol !== 'https:')
                    throw Error();
            }
            catch {
                throw new Problem(400, 'Los enlaces deben comenzar con https://');
            }
        }
        studio.services = list(s.services, 20).map((x, i) => ({
            number: String(i + 1).padStart(2, '0'),
            title: text(x.title, 100),
            description: text(x.description, 1000),
            tags: list(x.tags, 15).map((t) => text(t, 80)),
        }));
        if (!studio.services.length ||
            studio.services.some((s) => !s.title || !s.tags.length || s.tags.some((tag) => !tag)))
            throw new Problem(400, 'Completá los servicios.');
        const photos = await Promise.all(list(c.photos, 80).map(async (x) => ({
            id: text(x.id, 50),
            title: text(x.title, 100),
            alt: text(x.alt, 250),
            category: text(x.category, 15),
            image: await imagePath(x.image),
        })));
        if (!photos.length ||
            new Set(photos.map((x) => x.id)).size !== photos.length ||
            photos.some((x) => !x.id || !x.title || !x.alt || !['sutil', 'arte', 'color'].includes(x.category)))
            throw new Problem(400, 'Revisá identificadores, títulos, categorías y descripciones de las fotos.');
        const collection = { heroId: text(c.heroId, 50), secondaryId: text(c.secondaryId, 50), photos };
        if (!photos.some((x) => x.id === collection.heroId) ||
            !photos.some((x) => x.id === collection.secondaryId))
            throw new Problem(400, 'Las dos fotos de portada deben existir.');
        const copy = {};
        for (const k of Object.keys(old.copy).filter((k) => k !== 'ribbon'))
            copy[k] = text(input.copy[k] ?? (Object.hasOwn(extraHeroCopy, k) ? old.copy[k] : undefined), k.endsWith('Description') ? 600 : 120);
        copy.ribbon = list(input.copy.ribbon, 12).map((x) => text(x, 60));
        if (!copy.ribbon.length)
            throw new Problem(400, 'Agregá al menos una frase.');
        const services = list(b.services, 25).map((x) => ({
            id: text(x.id, 50),
            name: text(x.name, 100),
            minutes: number(x.minutes, 15, 480),
            active: !!x.active,
        }));
        if (new Set(services.map((x) => x.id)).size !== services.length ||
            services.some((x) => !x.id || !x.name))
            throw new Problem(400, 'Revisá los servicios reservables.');
        const windows = list(b.windows, 400).map((x) => {
            const start = text(x.start, 5), end = text(x.end, 5);
            if (timeNumber(start) >= timeNumber(end))
                throw new Problem(400, 'El cierre debe ser posterior a la apertura.');
            return { id: text(x.id || randomUUID(), 60), date: dateCheck(x.date), start, end };
        });
        const booking = {
            enabled: !!b.enabled,
            services,
            windows,
            minLeadMinutes: number(b.minLeadMinutes, 0, 10080),
            bufferMinutes: number(b.bufferMinutes, 0, 120),
            maxAdvanceDays: number(b.maxAdvanceDays, 0, 180),
        };
        const location = {
            address: text(input.location.address, 250),
            confirmed: !!input.location.confirmed,
        };
        if (location.confirmed && !location.address)
            throw new Problem(400, 'Ingresá la dirección antes de mostrarla.');
        const faq = list(input.faq, 20).map((x) => ({
            question: text(x.question, 200),
            answer: text(x.answer, 1500),
        }));
        const payload = { studio, collection, copy, booking, location, faq };
        const result = await (await db()).prepare('UPDATE content SET version=version+1,payload=? WHERE id=1 AND version=?')
            .run(JSON.stringify(payload), input.version);
        if (!result.changes)
            throw new Problem(409, 'Otra sesión modificó el contenido. Recargá antes de guardar.');
        return await getContent();
    }, "agenda");
}
async function available(serviceId, date, now = Date.now(), content = undefined, administrator = false) {
    content ||= await getContent();
    dateCheck(date);
    const settings = administrator
        ? { ...content.booking, enabled: true, minLeadMinutes: 0, maxAdvanceDays: 0 }
        : content.booking, service = settings.services.find((s) => s.id === serviceId && s.active);
    if (!settings.enabled || !service)
        return [];
    if (date < localDate(now) ||
        (settings.maxAdvanceDays > 0 && date > localDate(now + settings.maxAdvanceDays * 86400000)))
        return [];
    const occupied = await (await db()).prepare(`SELECT "start","end" FROM bookings WHERE status IN ('confirmed','completed') AND "end">? AND "start"<?`)
        .all(zonedTime(date, 0), zonedTime(date, 1439) + 60000);
    const slots = new Map();
    // Adjacent or overlapping working ranges are one continuous shift; real breaks stay separate.
    const ranges = settings.windows
        .filter((w) => w.date === date)
        .map((w) => ({ start: timeNumber(w.start), end: timeNumber(w.end) }))
        .sort((a, b) => a.start - b.start);
    const shifts = [];
    for (const range of ranges) {
        const previous = shifts.at(-1);
        if (previous && range.start <= previous.end)
            previous.end = Math.max(previous.end, range.end);
        else
            shifts.push({ ...range });
    }
    for (const window of shifts)
        for (let m = window.start; m + service.minutes + settings.bufferMinutes <= window.end; m += 15) {
            const start = zonedTime(date, m), end = start + (service.minutes + settings.bufferMinutes) * 60000;
            if (start < now + settings.minLeadMinutes * 60000 ||
                occupied.some((b) => b.start < end && b.end > start))
                continue;
            slots.set(start, {
                start,
                time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
            });
        }
    return [...slots.values()].sort((a, b) => a.start - b.start);
}
async function availabilityResponse(serviceId, date, administrator = false) {
    const content = await getContent();
    const settings = administrator
        ? { ...content.booking, enabled: true, minLeadMinutes: 0, maxAdvanceDays: 0 }
        : content.booking;
    const dates = [...new Set(settings.windows.map((w) => w.date))]
        .filter((d) => d >= localDate() &&
        (settings.maxAdvanceDays === 0 ||
            d <= localDate(Date.now() + settings.maxAdvanceDays * 86400000)))
        .sort();
    return {
        demo,
        enabled: settings.enabled,
        services: settings.services.filter((s) => s.active),
        dates,
        slots: date && serviceId ? await available(serviceId, date, Date.now(), content, administrator) : [],
        timezone: 'America/Montevideo',
        rules: {
            minLeadMinutes: settings.minLeadMinutes,
            bufferMinutes: settings.bufferMinutes,
            startIntervalMinutes: 15,
        },
    };
}
export async function publicAvailability(serviceId, date) {
    return await availabilityResponse(serviceId, date);
}
export async function adminAvailability(serviceId, date) {
    return await availabilityResponse(serviceId, date, true);
}
function receipt(row) {
    return {
        id: row.id,
        name: row.name,
        service: row.service_name,
        start: row.start,
        end: row.end,
        status: row.status,
        token: row.token,
        demo,
    };
}
export async function reserve(input, { administrator = false } = {}) {
    const name = text(input.name, 100), phone = text(input.phone, 30).replace(/[\s()+-]/g, ''), serviceId = text(input.serviceId, 50), reference = text(input.reference || '', 180);
    if (name.length < 2 ||
        !/^\d{8,15}$/.test(phone) ||
        !Number.isSafeInteger(input.start) ||
        !/^[-\w]{16,100}$/.test(input.requestKey || ''))
        throw new Problem(400, 'Completá nombre, teléfono, servicio y horario.');
    const payloadHash = digest(JSON.stringify([name, phone, serviceId, input.start, reference]));
    const database = await db();

    return await database.transaction(async () => {
        try {
            const existing = await database
                .prepare('SELECT * FROM bookings WHERE request_key=?')
                .get(input.requestKey);
            if (existing) {
                if (existing.payload_hash !== payloadHash)
                    throw new Problem(409, 'Esta solicitud ya fue utilizada. Volvé a elegir el horario.');

                return receipt(existing);
            }
            const content = await getContent(), service = content.booking.services.find((s) => s.id === serviceId && s.active);
            if (!service ||
                !(await available(serviceId, localDate(input.start), Date.now(), content, administrator)).some((s) => s.start === input.start))
                throw new Problem(409, 'Ese horario ya no está disponible. Elegí otro de la lista.');
            const id = randomUUID(), token = randomBytes(32).toString('base64url'), end = input.start + (service.minutes + content.booking.bufferMinutes) * 60000;
            await database
                .prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)")
                .run(id, input.requestKey, payloadHash, digest(token), token, input.start, end, service.id, service.name, name, phone, reference, Date.now());
            const row = await database.prepare('SELECT * FROM bookings WHERE id=?').get(id);

            return receipt(row);
        }
        catch (error) {

            if (String(error).includes('booking_overlap'))
                throw new Problem(409, 'Ese horario acaba de reservarse. Elegí otro.');
            throw error;
        }
    }, "agenda");
}
export async function byToken(token) {
    if (typeof token !== 'string' || token.length !== 43)
        throw new Problem(404, 'No encontramos el turno.');
    const row = await (await db()).prepare('SELECT * FROM bookings WHERE token_hash=?').get(digest(token));
    if (!row)
        throw new Problem(404, 'No encontramos el turno.');
    return row;
}
export async function lookupBooking(token) {
    return receipt(await byToken(token));
}
export async function cancelBooking(token) {
    return await (await db()).transaction(async () => {
        const row = await byToken(token);
        if (row.status === 'completed' || row.start <= Date.now())
            throw new Problem(409, 'Consultá al estudio para modificar este turno.');
        await (await db()).prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(row.id);
        return receipt({ ...row, status: 'cancelled' });
    }, "agenda");
}
export async function listBookings() {
    return await (await db()).prepare('SELECT id,"start","end",service_name AS service,name,phone,reference,status,created FROM bookings ORDER BY "start" DESC LIMIT 1000')
        .all();
}
export async function blockTime(input) {
    return await (await db()).transaction(async () => {
        const date = dateCheck(input.date), start = zonedTime(date, timeNumber(input.start)), end = zonedTime(date, timeNumber(input.end));
        if (start >= end || start < Date.now())
            throw new Problem(400, 'Revisá el día y las horas del bloqueo.');
        const token = randomBytes(32).toString('base64url');
        try {
            await (await db()).prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)")
                .run(randomUUID(), randomUUID(), digest(token), digest(token), token, start, end, 'blocked', 'Horario bloqueado', text(input.note || 'Bloqueo del estudio', 100), '', '', Date.now());
        }
        catch (error) {
            if (String(error).includes('booking_overlap'))
                throw new Problem(409, 'Ese bloqueo se superpone con un turno. Revisá la agenda.');
            throw error;
        }
    }, "agenda");
}
export async function changeBooking(id, status) {
    return await (await db()).transaction(async () => {
        if (!['cancelled', 'completed'].includes(status))
            throw new Problem(400, 'Estado inválido.');
        const row = await (await db()).prepare('SELECT * FROM bookings WHERE id=?').get(id);
        if (!row)
            throw new Problem(404, 'Turno no encontrado.');
        if (status === 'completed' && row.status !== 'confirmed')
            throw new Problem(409, 'Solo se puede completar un turno confirmado.');
        if (status === 'completed' && row.start > Date.now())
            throw new Problem(409, 'Todavía no comenzó este turno. Podés marcarlo realizado desde su hora de inicio.');
        await (await db()).prepare('UPDATE bookings SET status=? WHERE id=?').run(status, id);
    }, "agenda");
}
export async function login(password) {
    return await (await db()).transaction(async () => {
        if (typeof password !== 'string' || password.length > 128)
            throw new Problem(401, 'Contraseña incorrecta.');
        const [salt, hash] = (await (await db()).prepare('SELECT password FROM admin WHERE id=1')
            .get()).password.split(':');
        if (!timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')))
            throw new Problem(401, 'Contraseña incorrecta.');
        const token = randomBytes(32).toString('base64url');
        await (await db()).prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
        await (await db()).prepare('INSERT INTO sessions VALUES(?,?)')
            .run(digest(token), Date.now() + 12 * 3600000);
        return token;
    }, "access");
}
export async function authenticated(token) {
    return (typeof token === 'string' &&
        token.length === 43 &&
        !!await (await db()).prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?')
            .get(digest(token), Date.now()));
}
export async function logout(token) {
    if (token)
        await (await db()).prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));
}
export async function changePassword(password) {
    return await (await db()).transaction(async () => {
        if (typeof password !== 'string' || password.length < 12 || password.length > 128)
            throw new Problem(400, 'Usá entre 12 y 128 caracteres.');
        await (await db()).prepare('UPDATE admin SET password=? WHERE id=1').run(passwordHash(password));
        await (await db()).prepare('DELETE FROM sessions').run();
    }, "access");
}
export async function rateLimit(key, max, minutes) {
    return await (await db()).transaction(async () => {
        const database = await db(), now = Date.now();
        await database.prepare('DELETE FROM limits WHERE until<?').run(now);
        const row = await database
            .prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=limits.count+1 RETURNING count')
            .get(digest(key), now + minutes * 60000);
        if (row.count > max)
            throw new Problem(429, 'Demasiados intentos. Esperá unos minutos y volvé a intentar.');
    }, "limits:" + key);
}
export async function addMedia(bytes) {
    const id = randomUUID();
    await (await db()).prepare('INSERT INTO media VALUES(?,?)').run(id, bytes);
    return '/media/' + id + '.webp';
}
export async function getMedia(id) {
    return (await (await db()).prepare('SELECT data FROM media WHERE id=?').get(id))?.data;
}
