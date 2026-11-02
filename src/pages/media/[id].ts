import type { APIRoute } from 'astro';
import { getMedia } from '../../server/store.mjs';
export const GET: APIRoute = ({ params }) => {
  const id = params.id?.replace(/\.webp$/, '');
  if (!id || !/^[-a-f0-9]{36}$/.test(id)) return new Response('No encontrada', { status: 404 });
  const data = getMedia(id);
  return data
    ? new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public,max-age=31536000,immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    : new Response('No encontrada', { status: 404 });
};
