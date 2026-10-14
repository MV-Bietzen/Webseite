import { IMAGE_PREFIX, serveImage } from '../lib/facebook.mjs';

export default (req, context) => serveImage(IMAGE_PREFIX, context.params.id);

export const config = {
  path: '/api/facebook-bild/:id',
};
