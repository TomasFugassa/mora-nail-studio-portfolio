import { authenticated, Problem } from './store.mjs';
export function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
export function failure(error) {
    if (error instanceof Problem)
        return json({ error: error.message }, error.status);
    console.error('Mora API:', error instanceof Error ? error.message : 'Error interno');
    return json({ error: 'No pudimos completar la operación. Volvé a intentar.' }, 500);
}
export function sameOrigin(request) {
    const expected = process.env.MORA_SITE_ORIGIN || process.env.BERE_SITE_ORIGIN || new URL(request.url).origin;
    if (request.headers.get('origin') !== expected)
        throw new Problem(403, 'Solicitud no autorizada. Recargá la página.');
}
export async function body(request) {
    if (!request.headers.get('content-type')?.includes('application/json'))
        throw new Problem(415, 'Formato inválido.');
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 200000)
        throw new Problem(413, 'El contenido es demasiado grande.');
    try {
        const result = JSON.parse(raw);
        if (!result || typeof result !== 'object' || Array.isArray(result))
            throw Error();
        return result;
    }
    catch {
        throw new Problem(400, 'Revisá los datos enviados.');
    }
}
export async function requireAdmin(cookies) {
    if (!await authenticated(cookies.get('bere_admin')?.value))
        throw new Problem(401, 'Iniciá sesión para continuar.');
}
