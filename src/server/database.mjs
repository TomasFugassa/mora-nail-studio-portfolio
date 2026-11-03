import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { passwordHash } from './security.mjs';
import { createSeed } from './seed.mjs';

const context = new AsyncLocalStorage();
let initialized;
class Mutex {
  tail = Promise.resolve();
  async run(work) {
    let release;
    const next = new Promise(resolve => { release = resolve; });
    const previous = this.tail; this.tail = next;
    await previous;
    try { return await work(); } finally { release(); }
  }
}
const numericColumns = new Set(['version', 'start', 'end', 'created', 'expires', 'until', 'count']);
function normalize(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    numericColumns.has(key) && typeof value === 'string' ? Number(value) : value,
  ]));
}
class Database {
  constructor(driver, connection) { this.driver = driver; this.connection = connection; this.mutex = new Mutex(); }
  async query(sql, parameters = [], mode = 'all') {
    const active = context.getStore();
    const execute = async connection => {
      if (this.driver === 'sqlite') {
        const statement = connection.prepare(sql);
        return mode === 'run' ? statement.run(...parameters) : mode === 'get' ? statement.get(...parameters) : statement.all(...parameters);
      }
      let index = 0;
      const result = await connection.query(sql.replace(/\?/g, () => '$' + (++index)), parameters);
      if (mode === 'run') return { changes: result.rowCount };
      const rows = result.rows.map(normalize);
      return mode === 'get' ? rows[0] : rows;
    };
    if (active?.database === this) return execute(active.connection);
    if (this.driver === 'sqlite') return this.mutex.run(() => execute(this.connection));
    return execute(this.refreshPool ? this.refreshPool() : this.connection);
  }
  prepare(sql) {
    return {
      get: (...parameters) => this.query(sql, parameters, 'get'),
      all: (...parameters) => this.query(sql, parameters, 'all'),
      run: (...parameters) => this.query(sql, parameters, 'run'),
    };
  }
  async exec(sql) {
    const active = context.getStore();
    if (active?.database === this) return this.driver === 'sqlite' ? active.connection.exec(sql) : active.connection.query(sql);
    if (this.driver === 'sqlite') return this.mutex.run(() => this.connection.exec(sql));
    return (this.refreshPool ? this.refreshPool() : this.connection).query(sql);
  }
  async transaction(work, resource = 'agenda') {
    if (context.getStore()?.database === this) return work();
    if (this.driver === 'sqlite') return this.mutex.run(async () => {
      this.connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await context.run({ database: this, connection: this.connection }, work);
        this.connection.exec('COMMIT'); return result;
      } catch (error) { this.connection.exec('ROLLBACK'); throw error; }
    });
    const pool=this.refreshPool ? this.refreshPool() : this.connection;
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['mora:' + resource]);
      const result = await context.run({ database: this, connection }, work);
      await connection.query('COMMIT'); return result;
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
  }
  async close() {
    if (this.driver === 'sqlite') this.connection.close(); else await this.connection.end();
    initialized = undefined;
  }
}
export const demo = (process.env.MORA_DEMO_MODE ?? process.env.BERE_DEMO_MODE) !== 'false';
async function open() {
  const postgres = process.env.MORA_DATABASE_DRIVER === 'postgres' || process.env.NETLIFY === 'true';
  let database;
  if (postgres) {
    const { getDatabase, getConnectionString } = await import('@netlify/database');
    const options = process.env.MORA_DATABASE_URL ? { connectionString: process.env.MORA_DATABASE_URL } : undefined;
    database = new Database('postgres', getDatabase(options).pool);
    let connectionString=options?.connectionString||getConnectionString();
    const monitor=pool=>pool.on('error',error=>console.error('Mora database connection:',error.code||'unavailable'));
    monitor(database.connection);
    database.refreshPool=()=>{
      const next=options?.connectionString||getConnectionString();
      if(next!==connectionString){
        const previous=database.connection;database.connection=getDatabase(options).pool;monitor(database.connection);
        connectionString=next;void previous.end().catch(()=>{});
      }
      return database.connection;
    };
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const directory = path.resolve(process.env.MORA_DATA_DIR || process.env.BERE_DATA_DIR || '.bere-data');
    mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, 'bere.sqlite');
    const connection = new DatabaseSync(filename);
    connection.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    database = new Database('sqlite', connection);
    await database.exec(`CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,data BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,payload_hash TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,token TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,service_id TEXT NOT NULL,service_name TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,reference TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','completed')),created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS bookings_range ON bookings(status,start,end);
      CREATE TRIGGER IF NOT EXISTS no_overlap_insert BEFORE INSERT ON bookings WHEN NEW.status IN ('confirmed','completed') BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE status IN ('confirmed','completed') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'booking_overlap') END; END;
      CREATE TRIGGER IF NOT EXISTS no_overlap_update BEFORE UPDATE OF start,end,status ON bookings WHEN NEW.status IN ('confirmed','completed') BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE id<>NEW.id AND status IN ('confirmed','completed') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'booking_overlap') END; END;`);
    try { chmodSync(filename, 0o600); } catch { /* Some platforms do not expose file modes. */ }
  }
  try {
  if (!await database.prepare('SELECT id FROM content WHERE id=1').get()) {
    await database.prepare('INSERT INTO content VALUES(1,1,?) ON CONFLICT(id) DO NOTHING').run(JSON.stringify(createSeed({ demo })));
  }
  if (!await database.prepare('SELECT id FROM admin WHERE id=1').get()) {
    let password = process.env.MORA_ADMIN_PASSWORD || process.env.BERE_ADMIN_PASSWORD;
    if (!password) {
      if (postgres || !demo) throw Error('Configurá MORA_ADMIN_PASSWORD antes del primer inicio.');
      password = randomBytes(18).toString('base64url');
      writeFileSync('.local-admin-access.txt', `Panel: http://127.0.0.1:4324/admin\nContraseña inicial: ${password}\nModo demostración. Cambiar la contraseña desde el panel.\n`, { mode: 0o600 });
    }
    if (password.length < 12 || password.length > 128) throw Error('La contraseña inicial debe tener entre 12 y 128 caracteres.');
    await database.prepare('INSERT INTO admin VALUES(1,?) ON CONFLICT(id) DO NOTHING').run(passwordHash(password));
  }
  return database;
  } catch(error) { await database.close(); throw error; }
}
export async function getDatabase() {
  initialized ||= open().catch(error => { initialized = undefined; throw error; });
  return initialized;
}
