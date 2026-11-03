import type { APIRoute } from 'astro';
import { getContent, saveContent, login, logout, listBookings, changeBooking, changePassword, rateLimit, blockTime, reserve, adminAvailability, } from '../../server/store.mjs';
import { json, failure, body, sameOrigin, requireAdmin } from '../../server/http.mjs';
export const GET: APIRoute = async ({ cookies, url }) => {
    try {
        await requireAdmin(cookies);
        if (url.searchParams.get('view') === 'availability')
            return json(await adminAvailability(url.searchParams.get('service') || '', url.searchParams.get('date') || ''));
        return json({ content: await getContent(), bookings: await listBookings() });
    }
    catch (error) {
        return failure(error);
    }
};
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
    try {
        sameOrigin(request);
        const input = await body(request);
        if (input.action === 'login') {
            await rateLimit('login:' + clientAddress, 8, 15);
            const token = await login(input.password);
            cookies.set('bere_admin', token, {
                httpOnly: true,
                secure: (process.env.MORA_SITE_ORIGIN || process.env.BERE_SITE_ORIGIN || request.url).startsWith('https:'),
                sameSite: 'strict',
                path: '/',
                maxAge: 43200,
            });
            return json({ ok: true });
        }
        await requireAdmin(cookies);
        if (input.action === 'logout') {
            await logout(cookies.get('bere_admin')?.value);
            cookies.delete('bere_admin', { path: '/' });
            return json({ ok: true });
        }
        if (input.action === 'save')
            return json({ content: await saveContent(input.content) });
        if (input.action === 'create-booking') {
            const booking = await reserve(input, { administrator: true });
            return json({ booking, bookings: await listBookings() }, 201);
        }
        if (input.action === 'block') {
            await blockTime(input);
            return json({ bookings: await listBookings() });
        }
        if (input.action === 'booking') {
            await changeBooking(input.id, input.status);
            return json({ bookings: await listBookings() });
        }
        if (input.action === 'password') {
            await changePassword(input.password);
            cookies.delete('bere_admin', { path: '/' });
            return json({ ok: true });
        }
        return json({ error: 'Operación desconocida.' }, 400);
    }
    catch (error) {
        return failure(error);
    }
};
