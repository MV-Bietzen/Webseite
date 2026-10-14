import { IG_FEED_KEY, serveFeed, syncInstagram } from '../lib/facebook.mjs';

export default () => serveFeed(IG_FEED_KEY, syncInstagram);

export const config = {
  path: '/api/instagram',
};
