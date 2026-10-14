import { FEED_KEY, serveFeed, syncFacebook } from '../lib/facebook.mjs';

export default () => serveFeed(FEED_KEY, syncFacebook);

export const config = {
  path: '/api/facebook',
};
