import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const password = process.env.BERE_REVIEW_PASSWORD || '';
const adminPassword = process.env.BERE_ADMIN_PASSWORD || '';
const origin = new URL(process.env.BERE_SITE_ORIGIN || 'http://127.0.0.1:4324');
if (password.length < 16 || password.length > 128)
    throw Error('Configurar BERE_REVIEW_PASSWORD de 16 a 128 caracteres');
if (adminPassword.length < 12 || adminPassword.length > 128)
    throw Error('Configurar BERE_ADMIN_PASSWORD de 12 a 128 caracteres');
if (process.env.BERE_DEMO_MODE !== 'true')
    throw Error('El servidor de revisión requiere BERE_DEMO_MODE=true');
if (origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !['http:', 'https:'].includes(origin.protocol))
    throw Error('Revisar BERE_SITE_ORIGIN');
const port = Number(process.env.PORT || 4321);
const insidePort = Number(process.env.BERE_INTERNAL_PORT || 4331);
if (!Number.isInteger(port) || !Number.isInteger(insidePort) || port === insidePort)
    throw Error('Revisar los puertos');
const ttl = 12 * 3600;
const cookieName = 'bere_review';
const seedFile = process.env.BERE_CONTENT_SEED;
const dataDirectory = path.resolve(process.env.BERE_DATA_DIR || '.bere-review-data');
process.env.BERE_DATA_DIR = dataDirectory;
// Import only the explicitly exported public content into a fresh review database.
// Never copy customer data, admin passwords, sessions, or the original SQLite file.
if (!existsSync(path.join(dataDirectory, 'bere.sqlite')) && seedFile) {
    const { content, media } = JSON.parse(readFileSync(seedFile, 'utf8'));
    const { getContent, saveContent, db } = await import('../src/server/store.mjs');
    const initial = await getContent();
    for (const item of media || []) {
        if (!/^[-a-f0-9]{36}$/.test(item.id))
            throw Error('Imagen de revisión inválida');
        await (await db()).prepare('INSERT OR IGNORE INTO media VALUES(?,?)')
            .run(item.id, Buffer.from(item.base64, 'base64'));
    }
    await saveContent({
        ...content,
        version: initial.version,
        booking: { ...content.booking, enabled: true, windows: initial.booking.windows },
    });
    await (await db()).close();
}
const child = spawn(process.execPath, ['dist/server/entry.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(insidePort) },
    stdio: ['ignore', 'inherit', 'inherit'],
});
let closing = false, server;
child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
    shutdown();
});
child.on('exit', (code) => {
    if (!closing) {
        console.error('El servidor de revisión se detuvo');
        process.exitCode = code || 1;
        shutdown();
    }
});
let healthy = false;
for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null)
        throw Error('No inició el servidor');
    try {
        const response = await fetch('http://127.0.0.1:' + insidePort + '/api/availability');
        if (response.ok) {
            healthy = true;
            break;
        }
    }
    catch { }
    await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!healthy) {
    child.kill();
    throw Error('El servidor no respondió a tiempo');
}
const digest = (value) => createHash('sha256').update(value).digest();
const signature = (value) => createHmac('sha256', password)
    .update(origin.origin + ':' + value)
    .digest('base64url');
const equal = (a, b) => {
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
};
function authenticated(request) {
    const cookie = request.headers.cookie
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(cookieName + '='))
        ?.slice(cookieName.length + 1);
    if (!cookie)
        return false;
    const [expiry, nonce, mac, extra] = cookie.split('.');
    return (!extra &&
        /^\d{10,13}$/.test(expiry || '') &&
        /^[\w-]{16}$/.test(nonce || '') &&
        Number(expiry) > Date.now() &&
        Number(expiry) <= Date.now() + ttl * 1000 &&
        equal(mac || '', signature(expiry + '.' + nonce)));
}
function destination(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\'))
        return '/';
    try {
        const next = new URL(raw, origin);
        if (next.origin !== origin.origin ||
            next.pathname.startsWith('/revision') ||
            next.pathname === '/healthz')
            return '/';
        return next.pathname + next.search;
    }
    catch {
        return '/';
    }
}
function respond(response, status, body = '', headers = {}) {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        ...headers,
    });
    response.end(body);
}
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function panelDestination(next) {
    return /^\/admin(?:\/|\?|$)/.test(next);
}
function reviewCookie() {
    const value = String(Date.now() + ttl * 1000) + '.' + randomBytes(12).toString('base64url');
    return (cookieName +
        '=' +
        value +
        '.' +
        signature(value) +
        '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
        ttl +
        (origin.protocol === 'https:' ? '; Secure' : ''));
}
function page(next, error = '') {
    const panel = panelDestination(next);
    const title = panel ? 'Tu estudio,<br>en tus manos' : 'Un espacio para<br>imaginar lo que viene';
    const description = panel
        ? 'Entrá con la contraseña actual de tu panel. Es la misma que usás desde la computadora y que podés cambiar en Acceso.'
        : 'Acceso privado para revisar la página, probar sus funciones y compartir comentarios.';
    const label = panel ? 'Contraseña del panel' : 'Contraseña de la demostración';
    const button = panel ? 'Entrar a mi estudio' : 'Entrar a la demostración';
    return `<!doctype html><html lang="es-UY"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Mora Studio · ${panel ? 'Acceso al panel' : 'Revisión privada'}</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f2e9;color:#352127;font:16px/1.6 Arial,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}.card{max-width:470px;width:100%;padding:clamp(25px,6vw,48px);border:1px solid #e4dcd5;border-radius:24px;background:#fffdf9}.brand{font-size:12px;letter-spacing:2px;color:#bf174f}h1{font:400 clamp(36px,8vw,48px)/1.1 Georgia,serif;letter-spacing:-1.8px;margin:24px 0}p{color:#75646b;font-size:14px}label{display:block;font-size:13px;margin:28px 0 9px}input{width:100%;border:1px solid #b7a6ad;background:#f7f2e9;border-radius:10px;padding:15px;font:inherit;color:inherit}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #bf174f;outline-offset:3px}button{width:100%;padding:15px;border:0;border-radius:30px;background:#352127;color:#fffdf9;font:600 14px Arial,sans-serif;margin-top:20px;cursor:pointer}small{display:block;color:#75646b;font-size:11px;margin-top:23px}.error{color:#a41040;font-size:13px;min-height:20px;margin:8px 0 0}.back{display:block;margin-top:18px;font-size:12px;color:#75646b;text-align:center;text-underline-offset:4px}</style></head><body><main class="card"><span class="brand">Mora STUDIO · ${panel ? 'TU PANEL' : 'VISTA PREVIA'}</span><h1>${title}</h1><p>${description}</p><form method="post" action="/revision"><input type="hidden" name="next" value="${escape(next)}"><label for="review-password">${label}</label><input id="review-password" name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="128" ${error ? 'aria-invalid="true" aria-describedby="review-error"' : ''}><p class="error" id="review-error" role="alert">${escape(error)}</p><button type="submit">${button} ↗</button></form>${panel ? '<a class="back" href="/">Ver la página de Mora</a>' : ''}<small>Los turnos y horarios son de prueba. Todavía no son reservas reales del estudio.</small></main></body></html>`;
}
const attempts = new Map();
const security = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url || '/', origin);
        if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(request.method))
            return respond(response, healthy ? 200 : 503, 'ok', {
                'Content-Type': 'text/plain; charset=utf-8',
            });
        if (request.headers.host?.toLowerCase() !== origin.host.toLowerCase() ||
            url.origin !== origin.origin)
            return respond(response, 400, 'Solicitud inválida');
        const signedIn = authenticated(request);
        if (url.pathname === '/revision') {
            const next = destination(url.searchParams.get('next'));
            if (request.method === 'GET')
                return signedIn
                    ? respond(response, 303, '', { Location: next })
                    : respond(response, 200, page(next), security);
            if (request.method !== 'POST')
                return respond(response, 405, 'Método no permitido', { Allow: 'GET, POST' });
            if (request.headers.origin !== origin.origin)
                return respond(response, 403, 'Solicitud no autorizada');
            if (!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
                return respond(response, 415, 'Formato inválido');
            const key = request.socket.remoteAddress || 'unknown', now = Date.now();
            for (const [ip, entry] of attempts)
                if (entry.until <= now)
                    attempts.delete(ip);
            const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
            if (entry.count >= 8 || attempts.size >= 2000)
                return respond(response, 429, page(next, 'Demasiados intentos. Volvé a probar en unos minutos.'), { ...security, 'Retry-After': '900' });
            entry.count++;
            attempts.set(key, entry);
            let raw = '';
            for await (const chunk of request) {
                raw += chunk;
                if (Buffer.byteLength(raw) > 2048)
                    return respond(response, 413, 'El formulario es demasiado grande');
            }
            const form = new URLSearchParams(raw), go = destination(form.get('next'));
            const candidate = form.get('password') || '';
            if (panelDestination(go)) {
                const result = await fetch('http://127.0.0.1:' + insidePort + '/api/admin', {
                    method: 'POST',
                    redirect: 'manual',
                    signal: AbortSignal.timeout(15000),
                    headers: {
                        'Content-Type': 'application/json',
                        Origin: origin.origin,
                        Host: origin.host,
                        'X-Forwarded-Host': origin.host,
                        'X-Forwarded-Proto': origin.protocol.slice(0, -1),
                    },
                    body: JSON.stringify({ action: 'login', password: candidate }),
                });
                if (result.status === 401)
                    return respond(response, 401, page(go, 'Revisá la contraseña del panel. Usá la que cambiaste desde Acceso.'), security);
                if (result.status === 429)
                    return respond(response, 429, page(go, 'Demasiados intentos. Volvé a probar en unos minutos.'), { ...security, 'Retry-After': '900' });
                const adminCookie = result.headers.get('set-cookie');
                if (!result.ok || !adminCookie?.startsWith('bere_admin='))
                    return respond(response, 502, page(go, 'No pudimos conectar con tu panel. Volvé a intentar.'), security);
                attempts.delete(key);
                return respond(response, 303, '', {
                    Location: go,
                    'Set-Cookie': [reviewCookie(), adminCookie],
                });
            }
            if (candidate.length > 128 || !timingSafeEqual(digest(candidate), digest(password)))
                return respond(response, 401, page(go, 'Revisá la contraseña e intentá de nuevo.'), security);
            attempts.delete(key);
            return respond(response, 303, '', { Location: go, 'Set-Cookie': reviewCookie() });
        }
        if (!signedIn) {
            if (url.pathname.startsWith('/api/'))
                return respond(response, 401, JSON.stringify({
                    error: 'Volvé a ingresar para continuar.',
                    reviewRequired: true,
                }), { 'Content-Type': 'application/json; charset=utf-8' });
            return respond(response, 303, '', {
                Location: '/revision?next=' + encodeURIComponent(destination(url.pathname + url.search)),
            });
        }
        const headers = {
            ...request.headers,
            host: origin.host,
            'x-forwarded-host': origin.host,
            'x-forwarded-proto': origin.protocol.slice(0, -1),
            'x-forwarded-for': request.socket.remoteAddress,
        };
        delete headers.forwarded;
        const upstream = http.request({
            hostname: '127.0.0.1',
            port: insidePort,
            path: url.pathname + url.search,
            method: request.method,
            headers,
        }, (remote) => {
            // Keep the entire review, including photographs and generated assets, private.
            const out = {
                ...remote.headers,
                'cache-control': 'no-store',
                'x-robots-tag': 'noindex, nofollow, noarchive',
                vary: 'Cookie',
            };
            response.writeHead(remote.statusCode || 502, out);
            remote.pipe(response);
        });
        upstream.on('error', () => {
            if (!response.headersSent)
                respond(response, 502, 'No pudimos conectar con la demostración. Volvé a intentar.');
            else
                response.destroy();
        });
        request.on('aborted', () => upstream.destroy());
        request.pipe(upstream);
    }
    catch (error) {
        console.error('Revisión:', error.message);
        if (!response.headersSent)
            respond(response, 500, 'No pudimos completar la solicitud.');
        else
            response.destroy();
    }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log('Demostración protegida disponible en ' + origin.origin));
async function shutdown() {
    if (closing)
        return;
    closing = true;
    healthy = false;
    await server?.close();
    child.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('message', (message) => {
    if (process.connected && message?.action === 'shutdown')
        shutdown();
});
