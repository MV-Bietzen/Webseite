import { FEED_KEY, facebookStore, isConfigured, syncFacebook } from '../lib/facebook.mjs';

// Liegt der letzte erfolgreiche Abruf länger zurück (z.B. direkt nach dem
// ersten Deploy, bevor der stündliche Abruf gelaufen ist), wird hier
// einmalig selbst abgerufen.
const STALE_MS = 3 * 60 * 60 * 1000;

const json = (body, status = 200, maxAge = 300) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });

export default async () => {
  if (!isConfigured()) return json({ posts: [] }, 503, 60);

  const store = facebookStore();
  let feed = await store.get(FEED_KEY, { type: 'json' });

  const age = feed ? Date.now() - new Date(feed.updated).getTime() : Infinity;
  if (!(age < STALE_MS)) {
    try {
      feed = await syncFacebook(store);
    } catch (err) {
      console.error('Facebook-Abruf fehlgeschlagen:', err.message);
    }
  }

  if (!feed) return json({ posts: [] }, 503, 60);
  return json(feed);
};

export const config = {
  path: '/api/facebook',
};
