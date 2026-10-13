// Holt die neuesten Beiträge der Vereinsseite über die Facebook Graph API
// und legt sie samt Bildern im Netlify Blob Store ab. Die Webseite liest
// danach nur noch aus diesem Speicher — Besucher laden nichts von Facebook.

import { getStore } from '@netlify/blobs';

const MAX_POSTS = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const FEED_KEY = 'feed';
export const IMAGE_PREFIX = 'img/';

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

function isFacebookUrl(value) {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === 'https:' && (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'));
  } catch {
    return false;
  }
}

// Graph liefert z.B. "2026-10-01T12:34:56+0000" — Safari kann "+0000" nicht parsen.
function normalizeDate(value) {
  const date = new Date(String(value).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function storeImage(store, key, src) {
  const res = await fetch(src);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) return false;
  const data = await res.arrayBuffer();
  if (data.byteLength > MAX_IMAGE_BYTES) return false;
  await store.set(key, data, { metadata: { contentType: type } });
  return true;
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
    const id = String(post.id).replace(/[^0-9_]/g, '');
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
      link: isFacebookUrl(post.permalink_url) ? post.permalink_url : null,
      image,
    });
  }

  const feed = {
    updated: new Date().toISOString(),
    page: {
      name: page.name || '',
      link: isFacebookUrl(page.link) ? page.link : null,
    },
    posts,
  };
  await store.setJSON(FEED_KEY, feed);

  // Bilder von Beiträgen entfernen, die nicht mehr angezeigt werden.
  const keep = new Set(posts.filter((p) => p.image).map((p) => IMAGE_PREFIX + p.id));
  const { blobs } = await store.list({ prefix: IMAGE_PREFIX });
  await Promise.all(blobs.filter((b) => !keep.has(b.key)).map((b) => store.delete(b.key)));

  return feed;
}
