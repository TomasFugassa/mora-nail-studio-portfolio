import type { APIRoute } from 'astro';
import { reserve, lookupBooking, cancelBooking, rateLimit } from '../../server/store.mjs';
import { json, failure, body, sameOrigin } from '../../server/http.mjs';
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    sameOrigin(request);
    rateLimit('booking:' + clientAddress, 30, 15);
    const input = await body(request);
    if (input.action === 'lookup') return json(lookupBooking(input.token));
    if (input.action === 'cancel') return json(cancelBooking(input.token));
    return json(reserve(input), 201);
  } catch (error) {
    return failure(error);
  }
};
