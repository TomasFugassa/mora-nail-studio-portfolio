import type { APIRoute } from 'astro';
import { publicAvailability, rateLimit } from '../../server/store.mjs';
import { json, failure } from '../../server/http.mjs';
export const GET: APIRoute = async ({ url, clientAddress }) => {
    try {
        await rateLimit('availability:' + clientAddress, 180, 1);
        return json(await publicAvailability(url.searchParams.get('service') || '', url.searchParams.get('date') || ''));
    }
    catch (error) {
        return failure(error);
    }
};
