// Holt die neuesten Beiträge der Facebook-Seite und des verknüpften
// Instagram-Profils über die Graph API und legt sie samt Bildern im Netlify
// Blob Store ab. Die Webseite liest danach nur noch aus diesem Speicher —
// Besucher laden nichts von Facebook oder Instagram.

import { getStore } from '@netlify/blobs';

const MAX_POSTS = 6;
const MAX_IG_POSTS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Liegt der letzte erfolgreiche Abruf länger zurück (z.B. direkt nach dem
// ersten Deploy oder auf Branch-Deploys ohne Zeitplan), ruft der Endpunkt
// einmalig selbst ab.
const STALE_MS = 3 * 60 * 60 * 1000;

export const FEED_KEY = 'feed';
export const IMAGE_PREFIX = 'img/';
export const IG_FEED_KEY = 'instagram';
export const IG_IMAGE_PREFIX = 'ig/';

export function facebookStore() {
  return getStore({ name: 'facebook', consistency: 'strong' });
}

function graphBase() {
  const version = process.env.FB_GRAPH_VERSION || 'v24.0';
  return `https://graph.facebook.com/${version}`;
}

async function graphGet(path, params) {
  const url = new URL(`${graphBase()}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', process.env.FB_PAGE_TOKEN);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error ? `${body.error.code}: ${body.error.message}` : `HTTP ${res.status}`;
    throw new Error(`Graph API ${path} — ${msg}`);
  }
  return body;
}

function isHttpsOn(value, domain) {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === 'https:' && (hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

// Graph liefert z.B. "2026-10-01T12:34:56+0000" — Safari kann "+0000" nicht parsen.
function normalizeDate(value) {
  const date = new Date(String(value).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const safeId = (value) => String(value).replace(/[^0-9_]/g, '');

async function storeImage(store, key, src) {
  const res = await fetch(src);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) return false;
  const data = await res.arrayBuffer();
  if (data.byteLength > MAX_IMAGE_BYTES) return false;
  await store.set(key, data, { metadata: { contentType: type } });
  return true;
}

// Bilder von Beiträgen entfernen, die nicht mehr angezeigt werden.
async function pruneImages(store, prefix, keepIds) {
  const keep = new Set(keepIds.map((id) => prefix + id));
  const { blobs } = await store.list({ prefix });
  await Promise.all(blobs.filter((b) => !keep.has(b.key)).map((b) => store.delete(b.key)));
}

export function isConfigured() {
  return Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN);
}

export async function syncFacebook(store = facebookStore()) {
  const pageId = process.env.FB_PAGE_ID;

  const page = await graphGet(pageId, { fields: 'name,link' });
  const { data = [] } = await graphGet(`${pageId}/posts`, {
    fields: 'id,message,created_time,permalink_url,full_picture',
    limit: '15',
  });

  const posts = [];
  for (const post of data) {
    if (posts.length >= MAX_POSTS) break;
    const text = (post.message || '').trim();
    if (!text && !post.full_picture) continue;
    const id = safeId(post.id);
    if (!id) continue;

    let image = null;
    if (post.full_picture) {
      const ok = await storeImage(store, IMAGE_PREFIX + id, post.full_picture).catch(() => false);
      if (ok) image = `/api/facebook-bild/${id}`;
    }

    posts.push({
      id,
      text,
      date: normalizeDate(post.created_time),
      link: isHttpsOn(post.permalink_url, 'facebook.com') ? post.permalink_url : null,
      image,
    });
  }

  const feed = {
    updated: new Date().toISOString(),
    page: {
      name: page.name || '',
      link: isHttpsOn(page.link, 'facebook.com') ? page.link : null,
    },
    posts,
  };
  await store.setJSON(FEED_KEY, feed);
  await pruneImages(store, IMAGE_PREFIX, posts.filter((p) => p.image).map((p) => p.id));
  return feed;
}

// Das Instagram-Profil muss ein Business- oder Creator-Konto sein, das mit
// der Facebook-Seite verknüpft ist; der Seiten-Token braucht instagram_basic.
export async function syncInstagram(store = facebookStore()) {
  let igId = process.env.IG_USER_ID;
  if (!igId) {
    const page = await graphGet(process.env.FB_PAGE_ID, { fields: 'instagram_business_account' });
    igId = page.instagram_business_account && page.instagram_business_account.id;
    if (!igId) throw new Error('Kein Instagram-Konto mit der Facebook-Seite verknüpft');
  }

  const profile = await graphGet(igId, { fields: 'username' });
  const { data = [] } = await graphGet(`${igId}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
    limit: '15',
  });

  const posts = [];
  for (const item of data) {
    if (posts.length >= MAX_IG_POSTS) break;
    const id = safeId(item.id);
    const src = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
    if (!id || !src) continue;
    const ok = await storeImage(store, IG_IMAGE_PREFIX + id, src).catch(() => false);
    if (!ok) continue;

    posts.push({
      id,
      text: (item.caption || '').trim(),
      date: normalizeDate(item.timestamp),
      link: isHttpsOn(item.permalink, 'instagram.com') ? item.permalink : null,
      image: `/api/instagram-bild/${id}`,
      video: item.media_type === 'VIDEO',
    });
  }

  const username = /^[A-Za-z0-9._]+$/.test(profile.username || '') ? profile.username : null;
  const feed = {
    updated: new Date().toISOString(),
    profile: {
      username,
      link: username ? `https://www.instagram.com/${username}/` : null,
    },
    posts,
  };
  await store.setJSON(IG_FEED_KEY, feed);
  await pruneImages(store, IG_IMAGE_PREFIX, posts.map((p) => p.id));
  return feed;
}

const json = (body, status = 200, maxAge = 300) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });

// Antwort für /api/facebook bzw. /api/instagram. Bei fehlenden Beiträgen
// steht der Grund in "reason" — die Graph-Fehlermeldung enthält nie den Token.
export async function serveFeed(key, sync) {
  if (!isConfigured()) {
    console.log('FB_PAGE_ID / FB_PAGE_TOKEN fehlen in diesem Deploy.');
    return json({ posts: [], reason: 'not-configured' }, 503, 60);
  }

  const store = facebookStore();
  let feed = await store.get(key, { type: 'json' });
  let error = null;

  const age = feed ? Date.now() - new Date(feed.updated).getTime() : Infinity;
  if (!(age < STALE_MS)) {
    try {
      feed = await sync(store);
    } catch (err) {
      error = err.message;
      console.error(`Abruf ${key} fehlgeschlagen:`, error);
    }
  }

  if (!feed) return json({ posts: [], reason: 'fetch-failed', error }, 503, 60);
  return json(feed);
}

export async function serveImage(prefix, rawId) {
  const id = safeId(rawId || '');
  if (!id) return new Response('Not found', { status: 404 });

  const result = await facebookStore().getWithMetadata(prefix + id, { type: 'arrayBuffer' });
  if (!result) return new Response('Not found', { status: 404 });

  return new Response(result.data, {
    headers: {
      'Content-Type': result.metadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
