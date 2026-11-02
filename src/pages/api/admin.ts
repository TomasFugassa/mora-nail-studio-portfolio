import type { APIRoute } from 'astro';
import {
  getContent,
  saveContent,
  login,
  logout,
  listBookings,
  changeBooking,
  changePassword,
  rateLimit,
  blockTime,
  reserve,
  adminAvailability,
} from '../../server/store.mjs';
import { json, failure, body, sameOrigin, requireAdmin } from '../../server/http.mjs';
export const GET: APIRoute = ({ cookies, url }) => {
  try {
    requireAdmin(cookies);
    if (url.searchParams.get('view') === 'availability')
      return json(
        adminAvailability(
          url.searchParams.get('service') || '',
          url.searchParams.get('date') || '',
        ),
      );
    return json({ content: getContent(), bookings: listBookings() });
  } catch (error) {
    return failure(error);
  }
};
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'login') {
      rateLimit('login:' + clientAddress, 8, 15);
      const token = login(input.password);
      cookies.set('bere_admin', token, {
        httpOnly: true,
        secure: (process.env.BERE_SITE_ORIGIN || request.url).startsWith('https:'),
        sameSite: 'strict',
        path: '/',
        maxAge: 43200,
      });
      return json({ ok: true });
    }
    requireAdmin(cookies);
    if (input.action === 'logout') {
      logout(cookies.get('bere_admin')?.value);
      cookies.delete('bere_admin', { path: '/' });
      return json({ ok: true });
    }
    if (input.action === 'save') return json({ content: saveContent(input.content) });
    if (input.action === 'create-booking') {
      const booking = reserve(input, { administrator: true });
      return json({ booking, bookings: listBookings() }, 201);
    }
    if (input.action === 'block') {
      blockTime(input);
      return json({ bookings: listBookings() });
    }
    if (input.action === 'booking') {
      changeBooking(input.id, input.status);
      return json({ bookings: listBookings() });
    }
    if (input.action === 'password') {
      changePassword(input.password);
      cookies.delete('bere_admin', { path: '/' });
      return json({ ok: true });
    }
    return json({ error: 'Operación desconocida.' }, 400);
  } catch (error) {
    return failure(error);
  }
};
