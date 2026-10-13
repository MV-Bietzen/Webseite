import { IMAGE_PREFIX, facebookStore } from '../lib/facebook.mjs';

export default async (req, context) => {
  const id = String(context.params.id || '').replace(/[^0-9_]/g, '');
  if (!id) return new Response('Not found', { status: 404 });

  const result = await facebookStore().getWithMetadata(IMAGE_PREFIX + id, { type: 'arrayBuffer' });
  if (!result) return new Response('Not found', { status: 404 });

  return new Response(result.data, {
    headers: {
      'Content-Type': result.metadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const config = {
  path: '/api/facebook-bild/:id',
};
