import { IG_IMAGE_PREFIX, serveImage } from '../lib/facebook.mjs';

export default (req, context) => serveImage(IG_IMAGE_PREFIX, context.params.id);

export const config = {
  path: '/api/instagram-bild/:id',
};
