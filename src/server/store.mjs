import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { extraHeroCopy } from '../data/hero-copy.mjs';

export const demo = process.env.MORA_DEMO_MODE !== 'false';
const dataDir = path.resolve(process.env.MORA_DATA_DIR || '.mora-data');
let connection;
export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function localDate(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}
function timeNumber(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Problem(400, 'Revisá las horas.');
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) throw new Problem(400, 'Hora inválida.');
  return h * 60 + m;
}
export function zonedTime(date, minutes) {
  const [y, m, d] = date.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montevideo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(result)
        .map((p) => [p.type, p.value]),
    );
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    result += target - shown;
  }
  return result;
}
export function db() {
  if (connection) return connection;
  mkdirSync(dataDir, { recursive: true });
  connection = new DatabaseSync(path.join(dataDir, 'mora.sqlite'));
  connection.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  connection.exec(`CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,data BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,payload_hash TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,token TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,service_id TEXT NOT NULL,service_name TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,reference TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','completed')),created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_range ON bookings(status,start,end);
    CREATE TRIGGER IF NOT EXISTS no_overlap_insert BEFORE INSERT ON bookings WHEN NEW.status IN ('confirmed','completed') BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE status IN ('confirmed','completed') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'booking_overlap') END; END;
    CREATE TRIGGER IF NOT EXISTS no_overlap_update BEFORE UPDATE OF start,end,status ON bookings WHEN NEW.status IN ('confirmed','completed') BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE id<>NEW.id AND status IN ('confirmed','completed') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'booking_overlap') END; END;`);
  if (!connection.prepare('SELECT id FROM content WHERE id=1').get()) {
    const studio = JSON.parse(readFileSync(path.resolve('content/studio.json'), 'utf8')),
      collection = JSON.parse(readFileSync(path.resolve('content/collection.json'), 'utf8'));
    const windows = [];
    if (demo)
      for (let i = 1; i <= 8; i++) {
        const day = localDate(Date.now() + i * 86400000);
        if (new Date(day + 'T12:00:00Z').getUTCDay() !== 0)
          windows.push({ id: randomUUID(), date: day, start: '09:00', end: '18:00' });
      }
    const site = {
      studio,
      collection,
      copy: {
        heroLine1: 'Uñas',
        heroLine2: 'a tu',
        heroAccent: 'manera',
        heroDescription:
          'Explorá la colección, elegí tu diseño y encontrá un espacio en la agenda.',
        collectionLine1: 'De cerca,',
        collectionLine2: 'otro detalle',
        studioLine1: 'El color',
        studioLine2: 'es el comienzo',
        studioLead: 'Una paleta para explorar. Un diseño para hacerlo propio.',
        contactLine1: '¿Tenés una',
        contactLine2: 'idea en mente?',
        ribbon: ['NAIL ART', 'COLOR CON ACTITUD', 'UN POQUITO DE VOS', 'Mora STUDIO'],
      },
      faq: [
        {
          question: '¿Cómo reservo un turno?',
          answer:
            'La agenda usa horarios ficticios y las consultas no se envían a ningún contacto real.',
        },
        {
          question: '¿Puedo compartir un diseño?',
          answer:
            'Abrí un diseño de la colección y elegí Usar como inspiración. Podés llevar esa referencia a tu reserva o consulta.',
        },
        {
          question: '¿Cómo cambio o cancelo un turno?',
          answer:
            'Guardá el enlace privado que aparece al reservar. Desde allí podés cancelar; para cambiarlo, consultá al estudio.',
        },
      ],
      location: { address: '', confirmed: false },
      booking: {
        enabled: demo,
        minLeadMinutes: 120,
        bufferMinutes: 15,
        maxAdvanceDays: 60,
        services: [
          { id: 'semi', name: 'Esmaltado semipermanente', minutes: 30, active: true },
          { id: 'kapping', name: 'Kapping', minutes: 60, active: true },
          { id: 'builder', name: 'Builder', minutes: 60, active: true },
          { id: 'softgel', name: 'SoftGel', minutes: 60, active: true },
          { id: 'reconstruccion', name: 'Reconstrucción de uñas', minutes: 60, active: true },
          { id: 'pies', name: 'Estética de pies', minutes: 30, active: true },
          { id: 'podologia', name: 'Podología', minutes: 60, active: true },
          { id: 'nailart', name: 'Nail art y decoraciones', minutes: 30, active: true },
        ],
        windows,
      },
    };
    connection.prepare('INSERT INTO content VALUES(1,1,?)').run(JSON.stringify(site));
  }
  if (!connection.prepare('SELECT id FROM admin WHERE id=1').get()) {
    let password = process.env.MORA_ADMIN_PASSWORD;
    if (!password) {
      if (!demo) throw new Error('Configurar MORA_ADMIN_PASSWORD antes del primer inicio.');
      password = randomBytes(18).toString('base64url');
      writeFileSync(
        '.local-admin-access.txt',
        `Panel: http://127.0.0.1:4324/admin\nContraseña inicial: ${password}\nModo demostración. Cambiar la contraseña desde el panel.\n`,
        { mode: 0o600 },
      );
    }
    if (password.length < 12 || password.length > 128)
      throw new Error('La contraseña inicial debe tener al menos 12 caracteres.');
    connection.prepare('INSERT INTO admin VALUES(1,?)').run(passwordHash(password));
  }
  try {
    chmodSync(path.join(dataDir, 'mora.sqlite'), 0o600);
  } catch {}
  return connection;
}
export function getContent() {
  const row = db().prepare('SELECT * FROM content WHERE id=1').get();
  const content = JSON.parse(row.payload);
  return { version: row.version, ...content, copy: { ...extraHeroCopy, ...content.copy } };
}
function text(value, max = 500) {
  if (typeof value !== 'string' || value.length > max)
    throw new Problem(400, 'Revisá los textos y su longitud.');
  return value.trim();
}
function list(value, max = 100) {
  if (!Array.isArray(value) || value.length > max) throw new Problem(400, 'Lista inválida.');
  return value;
}
function number(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Problem(400, 'Valor numérico inválido.');
  return value;
}
function dateCheck(date) {
  const parsed = new Date(String(date) + 'T12:00:00Z');
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Problem(400, 'Fecha inválida.');
  return date;
}
function imagePath(value) {
  const p = text(value, 250);
  if (
    /^\/src\/assets\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/.test(p) &&
    JSON.parse(readFileSync(path.resolve('content/collection.json'), 'utf8')).photos.some(
      (photo) => photo.image === p,
    )
  )
    return p;
  if (/^\/media\/[a-f0-9-]{36}\.webp$/.test(p) && getMedia(p.split('/').pop().slice(0, -5)))
    return p;
  throw new Problem(400, 'Usá una foto de la galería o subí una imagen desde el panel.');
}
export function saveContent(input) {
  if (!input || typeof input !== 'object') throw new Problem(400, 'Faltan los datos a guardar.');
  const old = getContent();
  const s = input.studio,
    c = input.collection,
    b = input.booking;
  if (!s || !c || !b || !input.copy || !input.location) throw new Problem(400, 'Faltan campos.');
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
      if (new URL(studio[k]).protocol !== 'https:') throw Error();
    } catch {
      throw new Problem(400, 'Los enlaces deben comenzar con https://');
    }
  }
  studio.services = list(s.services, 20).map((x, i) => ({
    number: String(i + 1).padStart(2, '0'),
    title: text(x.title, 100),
    description: text(x.description, 1000),
    tags: list(x.tags, 15).map((t) => text(t, 80)),
  }));
  if (
    !studio.services.length ||
    studio.services.some((s) => !s.title || !s.tags.length || s.tags.some((tag) => !tag))
  )
    throw new Problem(400, 'Completá los servicios.');
  const photos = list(c.photos, 80).map((x) => ({
    id: text(x.id, 50),
    title: text(x.title, 100),
    alt: text(x.alt, 250),
    category: text(x.category, 15),
    image: imagePath(x.image),
  }));
  if (
    !photos.length ||
    new Set(photos.map((x) => x.id)).size !== photos.length ||
    photos.some(
      (x) => !x.id || !x.title || !x.alt || !['sutil', 'arte', 'color'].includes(x.category),
    )
  )
    throw new Problem(
      400,
      'Revisá identificadores, títulos, categorías y descripciones de las fotos.',
    );
  const collection = { heroId: text(c.heroId, 50), secondaryId: text(c.secondaryId, 50), photos };
  if (
    !photos.some((x) => x.id === collection.heroId) ||
    !photos.some((x) => x.id === collection.secondaryId)
  )
    throw new Problem(400, 'Las dos fotos de portada deben existir.');
  const copy = {};
  for (const k of Object.keys(old.copy).filter((k) => k !== 'ribbon'))
    copy[k] = text(input.copy[k] ?? (Object.hasOwn(extraHeroCopy,k) ? old.copy[k] : undefined), k.endsWith('Description') ? 600 : 120);
  copy.ribbon = list(input.copy.ribbon, 12).map((x) => text(x, 60));
  if (!copy.ribbon.length) throw new Problem(400, 'Agregá al menos una frase.');
  const services = list(b.services, 25).map((x) => ({
    id: text(x.id, 50),
    name: text(x.name, 100),
    minutes: number(x.minutes, 15, 480),
    active: !!x.active,
  }));
  if (
    new Set(services.map((x) => x.id)).size !== services.length ||
    services.some((x) => !x.id || !x.name)
  )
    throw new Problem(400, 'Revisá los servicios reservables.');
  const windows = list(b.windows, 400).map((x) => {
    const start = text(x.start, 5),
      end = text(x.end, 5);
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
  const result = db()
    .prepare('UPDATE content SET version=version+1,payload=? WHERE id=1 AND version=?')
    .run(JSON.stringify(payload), input.version);
  if (!result.changes)
    throw new Problem(409, 'Otra sesión modificó el contenido. Recargá antes de guardar.');
  return getContent();
}
function available(
  serviceId,
  date,
  now = Date.now(),
  content = getContent(),
  administrator = false,
) {
  dateCheck(date);
  const settings = administrator
      ? { ...content.booking, enabled: true, minLeadMinutes: 0, maxAdvanceDays: 0 }
      : content.booking,
    service = settings.services.find((s) => s.id === serviceId && s.active);
  if (!settings.enabled || !service) return [];
  if (
    date < localDate(now) ||
    (settings.maxAdvanceDays > 0 && date > localDate(now + settings.maxAdvanceDays * 86400000))
  )
    return [];
  const occupied = db()
    .prepare(
      "SELECT start,end FROM bookings WHERE status IN ('confirmed','completed') AND end>? AND start<?",
    )
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
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else shifts.push({ ...range });
  }
  for (const window of shifts)
    for (
      let m = window.start;
      m + service.minutes + settings.bufferMinutes <= window.end;
      m += 15
    ) {
      const start = zonedTime(date, m),
        end = start + (service.minutes + settings.bufferMinutes) * 60000;
      if (
        start < now + settings.minLeadMinutes * 60000 ||
        occupied.some((b) => b.start < end && b.end > start)
      )
        continue;
      slots.set(start, {
        start,
        time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      });
    }
  return [...slots.values()].sort((a, b) => a.start - b.start);
}
function availabilityResponse(serviceId, date, administrator = false) {
  const content = getContent();
  const settings = administrator
    ? { ...content.booking, enabled: true, minLeadMinutes: 0, maxAdvanceDays: 0 }
    : content.booking;
  const dates = [...new Set(settings.windows.map((w) => w.date))]
    .filter(
      (d) =>
        d >= localDate() &&
        (settings.maxAdvanceDays === 0 ||
          d <= localDate(Date.now() + settings.maxAdvanceDays * 86400000)),
    )
    .sort();
  return {
    demo,
    enabled: settings.enabled,
    services: settings.services.filter((s) => s.active),
    dates,
    slots: date && serviceId ? available(serviceId, date, Date.now(), content, administrator) : [],
    timezone: 'America/Montevideo',
    rules: {
      minLeadMinutes: settings.minLeadMinutes,
      bufferMinutes: settings.bufferMinutes,
      startIntervalMinutes: 15,
    },
  };
}
export function publicAvailability(serviceId, date) {
  return availabilityResponse(serviceId, date);
}
export function adminAvailability(serviceId, date) {
  return availabilityResponse(serviceId, date, true);
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
export function reserve(input, { administrator = false } = {}) {
  const name = text(input.name, 100),
    phone = text(input.phone, 30).replace(/[\s()+-]/g, ''),
    serviceId = text(input.serviceId, 50),
    reference = text(input.reference || '', 180);
  if (
    name.length < 2 ||
    !/^\d{8,15}$/.test(phone) ||
    !Number.isSafeInteger(input.start) ||
    !/^[-\w]{16,100}$/.test(input.requestKey || '')
  )
    throw new Problem(400, 'Completá nombre, teléfono, servicio y horario.');
  const payloadHash = digest(JSON.stringify([name, phone, serviceId, input.start, reference]));
  const database = db();
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = database
      .prepare('SELECT * FROM bookings WHERE request_key=?')
      .get(input.requestKey);
    if (existing) {
      if (existing.payload_hash !== payloadHash)
        throw new Problem(409, 'Esta solicitud ya fue utilizada. Volvé a elegir el horario.');
      database.exec('COMMIT');
      return receipt(existing);
    }
    const content = getContent(),
      service = content.booking.services.find((s) => s.id === serviceId && s.active);
    if (
      !service ||
      !available(serviceId, localDate(input.start), Date.now(), content, administrator).some(
        (s) => s.start === input.start,
      )
    )
      throw new Problem(409, 'Ese horario ya no está disponible. Elegí otro de la lista.');
    const id = randomUUID(),
      token = randomBytes(32).toString('base64url'),
      end = input.start + (service.minutes + content.booking.bufferMinutes) * 60000;
    database
      .prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)")
      .run(
        id,
        input.requestKey,
        payloadHash,
        digest(token),
        token,
        input.start,
        end,
        service.id,
        service.name,
        name,
        phone,
        reference,
        Date.now(),
      );
    const row = database.prepare('SELECT * FROM bookings WHERE id=?').get(id);
    database.exec('COMMIT');
    return receipt(row);
  } catch (error) {
    database.exec('ROLLBACK');
    if (String(error).includes('booking_overlap'))
      throw new Problem(409, 'Ese horario acaba de reservarse. Elegí otro.');
    throw error;
  }
}
export function byToken(token) {
  if (typeof token !== 'string' || token.length !== 43)
    throw new Problem(404, 'No encontramos el turno.');
  const row = db().prepare('SELECT * FROM bookings WHERE token_hash=?').get(digest(token));
  if (!row) throw new Problem(404, 'No encontramos el turno.');
  return row;
}
export function lookupBooking(token) {
  return receipt(byToken(token));
}
export function cancelBooking(token) {
  const row = byToken(token);
  if (row.status === 'completed' || row.start <= Date.now())
    throw new Problem(409, 'Consultá al estudio para modificar este turno.');
  db().prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(row.id);
  return receipt({ ...row, status: 'cancelled' });
}
export function listBookings() {
  return db()
    .prepare(
      'SELECT id,start,end,service_name AS service,name,phone,reference,status,created FROM bookings ORDER BY start DESC LIMIT 1000',
    )
    .all();
}
export function blockTime(input) {
  const date = dateCheck(input.date),
    start = zonedTime(date, timeNumber(input.start)),
    end = zonedTime(date, timeNumber(input.end));
  if (start >= end || start < Date.now())
    throw new Problem(400, 'Revisá el día y las horas del bloqueo.');
  const token = randomBytes(32).toString('base64url');
  try {
    db()
      .prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?)")
      .run(
        randomUUID(),
        randomUUID(),
        digest(token),
        digest(token),
        token,
        start,
        end,
        'blocked',
        'Horario bloqueado',
        text(input.note || 'Bloqueo del estudio', 100),
        '',
        '',
        Date.now(),
      );
  } catch (error) {
    if (String(error).includes('booking_overlap'))
      throw new Problem(409, 'Ese bloqueo se superpone con un turno. Revisá la agenda.');
    throw error;
  }
}
export function changeBooking(id, status) {
  if (!['cancelled', 'completed'].includes(status)) throw new Problem(400, 'Estado inválido.');
  const row = db().prepare('SELECT * FROM bookings WHERE id=?').get(id);
  if (!row) throw new Problem(404, 'Turno no encontrado.');
  if (status === 'completed' && row.status !== 'confirmed')
    throw new Problem(409, 'Solo se puede completar un turno confirmado.');
  if (status === 'completed' && row.start > Date.now())
    throw new Problem(
      409,
      'Todavía no comenzó este turno. Podés marcarlo realizado desde su hora de inicio.',
    );
  db().prepare('UPDATE bookings SET status=? WHERE id=?').run(status, id);
}
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function login(password) {
  if (typeof password !== 'string' || password.length > 128)
    throw new Problem(401, 'Contraseña incorrecta.');
  const [salt, hash] = db()
    .prepare('SELECT password FROM admin WHERE id=1')
    .get()
    .password.split(':');
  if (!timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')))
    throw new Problem(401, 'Contraseña incorrecta.');
  const token = randomBytes(32).toString('base64url');
  db().prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db()
    .prepare('INSERT INTO sessions VALUES(?,?)')
    .run(digest(token), Date.now() + 12 * 3600000);
  return token;
}
export function authenticated(token) {
  return (
    typeof token === 'string' &&
    token.length === 43 &&
    !!db()
      .prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?')
      .get(digest(token), Date.now())
  );
}
export function logout(token) {
  if (token) db().prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));
}
export function changePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new Problem(400, 'Usá entre 12 y 128 caracteres.');
  db().prepare('UPDATE admin SET password=? WHERE id=1').run(passwordHash(password));
  db().prepare('DELETE FROM sessions').run();
}
export function rateLimit(key, max, minutes) {
  const database = db(),
    now = Date.now();
  database.prepare('DELETE FROM limits WHERE until<?').run(now);
  const row = database
    .prepare(
      'INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
    .get(digest(key), now + minutes * 60000);
  if (row.count > max)
    throw new Problem(429, 'Demasiados intentos. Esperá unos minutos y volvé a intentar.');
}
export function addMedia(bytes) {
  const id = randomUUID();
  db().prepare('INSERT INTO media VALUES(?,?)').run(id, bytes);
  return '/media/' + id + '.webp';
}
export function getMedia(id) {
  return db().prepare('SELECT data FROM media WHERE id=?').get(id)?.data;
}

