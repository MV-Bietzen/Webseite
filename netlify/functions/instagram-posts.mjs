import { IG_FEED_KEY, isInstagramConfigured, serveFeed, syncInstagram } from '../lib/facebook.mjs';

export default () => serveFeed(IG_FEED_KEY, syncInstagram, isInstagramConfigured);

export const config = {
  path: '/api/instagram',
};
