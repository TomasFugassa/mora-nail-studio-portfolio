import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const url = 'http://127.0.0.1:4397',
  password = randomUUID(),
  adminPassword = randomUUID();
const directory = mkdtempSync(path.join(os.tmpdir(), 'bere-review-test-'));
let processHandle,
  browser,
  logs = '';
const env = {
  ...process.env,
  BERE_REVIEW_PASSWORD: password,
  BERE_ADMIN_PASSWORD: adminPassword,
  BERE_DEMO_MODE: 'true',
  BERE_DATA_DIR: directory,
  BERE_SITE_ORIGIN: url,
  HOST: '127.0.0.1',
  PORT: '4397',
  BERE_INTERNAL_PORT: '4398',
};
async function start() {
  processHandle = spawn(process.execPath, ['scripts/review-server.mjs'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  processHandle.stdout.on('data', (d) => (logs += d));
  processHandle.stderr.on('data', (d) => (logs += d));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url + '/healthz')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('No inició la revisión: ' + logs);
}
async function stop() {
  if (processHandle?.exitCode !== null) return;
  await new Promise((resolve) => {
    processHandle.once('exit', resolve);
    processHandle.send({ action: 'shutdown' });
  });
}
const request = (route, options = {}) => fetch(url + route, { redirect: 'manual', ...options });
try {
  await start();
  for (const route of [
    '/',
    '/admin',
    '/admin-sw.js',
    '/admin.webmanifest',
    '/favicon.svg',
    '/media/' + randomUUID() + '.webp',
  ]) {
    const res = await request(route);
    assert.equal(res.status, 303);
    assert.ok(res.headers.get('location').startsWith('/revision?next='));
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await request('/api/admin')).status, 401);
  assert.equal((await request('/api/availability')).status, 401);
  const form = (value, next = '/') => ({
    method: 'POST',
    headers: { Origin: url, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: value, next }),
  });
  assert.equal((await request('/revision', form('incorrecta'))).status, 401);
  const cross = form(password);
  cross.headers.Origin = 'https://otro.example';
  assert.equal((await request('/revision', cross)).status, 403);
  const login = await request('/revision', form(password, 'https://otro.example'));
  assert.equal(login.status, 303);
  assert.equal(login.headers.get('location'), '/');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const spoof = cookie.slice(0, -3) + 'abc';
  assert.equal((await request('/', { headers: { Cookie: spoof } })).status, 303);
  const gate = { Cookie: cookie };
  assert.equal((await request('/', { headers: gate })).status, 200);
  assert.equal((await request('/admin', { headers: gate })).status, 200);
  assert.equal(
    (await request('/api/admin', { headers: gate })).status,
    401,
    'La contraseña de revisión no reemplaza la del panel',
  );
  const auth = await request('/api/admin', {
    method: 'POST',
    headers: { ...gate, Origin: url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', password: adminPassword }),
  });
  assert.equal(auth.status, 200);
  const adminCookie = cookie + '; ' + auth.headers.get('set-cookie').split(';')[0];
  const state = await (await request('/api/admin', { headers: { Cookie: adminCookie } })).json();
  assert.equal(state.bookings.length, 0);
  assert.ok(state.content.booking.windows.length > 0);
  assert.ok(state.content.collection.photos.length >= 7);
  const service = state.content.booking.services.find((s) => s.active),
    date = state.content.booking.windows[0].date;
  const slots = await (
    await request('/api/availability?service=' + service.id + '&date=' + date, { headers: gate })
  ).json();
  const bookingInput = {
    requestKey: randomUUID(),
    serviceId: service.id,
    start: slots.slots[0].start,
    name: 'Reserva de revisión',
    phone: '099123456',
  };
  const booked = await request('/api/booking', {
    method: 'POST',
    headers: { ...gate, Origin: url, 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingInput),
  });
  assert.equal(booked.status, 201);
  const receipt = await booked.json();
  assert.equal(
    (
      await request('/api/booking', {
        method: 'POST',
        headers: { ...gate, Origin: url, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingInput, requestKey: randomUUID() }),
      })
    ).status,
    409,
  );
  const file = new FormData();
  file.append(
    'file',
    new Blob([await import('node:fs').then((fs) => fs.readFileSync('src/assets/mora-cherry.png'))], {
      type: 'image/png',
    }),
    'prueba.png',
  );
  const uploaded = await request('/api/upload', {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: url },
    body: file,
  });
  assert.equal(uploaded.status, 201);
  const media = await uploaded.json();
  assert.equal((await request(media.url)).status, 303);
  assert.equal((await request(media.url, { headers: gate })).status, 200);
  const html = await (await request('/', { headers: gate })).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:webp|js|css|woff2))"/g)]
    .map((m) => m[1])
    .filter((a) => a.startsWith('/'));
  assert.ok(assets.length > 0);
  for (const asset of assets.slice(0, 8)) {
    assert.equal((await request(asset)).status, 303, 'Recurso protegido: ' + asset);
    const response = await request(asset, { headers: gate });
    assert.equal(response.status, 200, 'Recurso disponible: ' + asset);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  state.content.copy.heroDescription = 'Cambio persistente de revisión';
  const saved = await request('/api/admin', {
    method: 'POST',
    headers: { Cookie: adminCookie, Origin: url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save', content: state.content }),
  });
  assert.equal(saved.status, 200);
  await stop();
  await start();
  const persisted = await (
    await request('/api/admin', { headers: { Cookie: adminCookie } })
  ).json();
  assert.equal(persisted.content.copy.heroDescription, 'Cambio persistente de revisión');
  assert.equal(persisted.content.booking.windows.length, state.content.booking.windows.length);
  assert.equal(persisted.bookings[0].id, receipt.id);
  assert.equal((await request(media.url, { headers: gate })).status, 200);
  browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage();
  await page.goto(url + '/admin');
  await page.getByLabel('Contraseña del panel', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: 'Entrar a mi estudio' }).click();
  await page.waitForFunction(() => !document.querySelector('#admin-workspace').hidden);
  const manifestSession = await context.newCDPSession(page);
  await manifestSession.send('Page.enable');
  const manifest = await manifestSession.send('Page.getAppManifest');
  assert.equal(manifest.errors.length, 0, JSON.stringify(manifest.errors));
  assert.equal(
    await page.locator('link[rel=manifest]').getAttribute('crossorigin'),
    'use-credentials',
  );
  const wrongGate = await request('/revision', form(password, '/admin'));
  assert.equal(wrongGate.status, 401);
  assert.match(await wrongGate.text(), /contraseña del panel/);
  assert.equal(wrongGate.headers.get('set-cookie'), null);
  await page.locator('#more-nav').click();
  await page.locator('.more-grid').getByRole('button', { name: 'Acceso', exact: true }).click();
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
  const changedPassword = randomUUID();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(changedPassword);
  await page.getByLabel('Repetí la contraseña', { exact: true }).fill(changedPassword);
  await page.getByRole('button', { name: 'Cambiar y cerrar sesiones', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#admin-login').hidden);
  assert.equal(
    (await request('/api/admin', { headers: { Cookie: adminCookie } })).status,
    401,
    'Cambiar la contraseña revoca las sesiones anteriores',
  );
  for (const options of [
    { viewport: { width: 1440, height: 900 } },
    {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    },
    {
      viewport: { width: 393, height: 851 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    },
  ]) {
    const isolated = await browser.newContext(options),
      device = await isolated.newPage();
    await device.goto(url + '/admin');
    await device.getByLabel('Contraseña del panel', { exact: true }).fill(changedPassword);
    await device.getByRole('button', { name: 'Entrar a mi estudio' }).click();
    await device.waitForFunction(() => !document.querySelector('#admin-workspace').hidden);
    const data = await device.evaluate(async () => await (await fetch('/api/admin')).json());
    assert.equal(data.content.copy.heroDescription, 'Cambio persistente de revisión');
    const cookies = await isolated.cookies();
    assert.ok(cookies.some((c) => c.name === 'bere_review'));
    assert.ok(cookies.some((c) => c.name === 'bere_admin'));
    if (options.viewport.width === 393) {
      await isolated.clearCookies({ name: 'bere_review' });
      await device.locator('[data-route="agenda"]').click();
      await device.getByRole('button', { name: 'Actualizar agenda', exact: true }).click();
      await device.getByLabel('Contraseña del panel', { exact: true }).waitFor();
    }
    await isolated.close();
  }
  assert.equal(
    (await request('/revision', form(adminPassword, '/admin'))).status,
    401,
    'La contraseña inicial no vuelve a funcionar después del cambio',
  );
  await stop();
  env.BERE_ADMIN_PASSWORD = randomUUID();
  await start();
  const afterRestart = await request('/revision', form(changedPassword, '/admin'));
  assert.equal(
    afterRestart.status,
    303,
    'La contraseña del panel permanece en SQLite, independiente de la variable inicial',
  );
  assert.equal(
    (await request('/revision', form('otra-incorrecta', '/admin'))).status,
    429,
    'Se conserva el límite de intentos del acceso al panel',
  );
  const fresh = await browser.newContext({ viewport: { width: 320, height: 568 } }),
    entry = await fresh.newPage();
  await entry.goto(url);
  const axe = await new AxeBuilder({ page: entry })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
  assert.ok(await entry.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    'PASS: acceso directo al panel en contextos limpios de computadora y móvil, contraseña cambiada desde Acceso, rechazo de la anterior, persistencia al reiniciar, cookies y sesión vencida, límite de intentos y manifiesto con credenciales; datos conservados.',
  );
} finally {
  if (browser) await browser.close();
  await stop();
}
