import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { addMedia, Problem } from '../../server/store.mjs';
import { json, failure, sameOrigin, requireAdmin } from '../../server/http.mjs';
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    sameOrigin(request);
    requireAdmin(cookies);
    if (Number(request.headers.get('content-length') || 0) > 6500000)
      throw new Problem(413, 'La imagen debe pesar menos de 6 MB.');
    const data = await request.formData(),
      file = data.get('file');
    if (!(file instanceof File) || file.size > 6000000)
      throw new Problem(400, 'Elegí una imagen de hasta 6 MB.');
    const bytes = Buffer.from(await file.arrayBuffer()),
      image = sharp(bytes, { limitInputPixels: 24000000 });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format || ''))
      throw new Problem(400, 'Usá JPG, PNG o WebP.');
    const result = await image
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return json({ url: addMedia(result) }, 201);
  } catch (error) {
    return failure(error);
  }
};
