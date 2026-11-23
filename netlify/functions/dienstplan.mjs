import {
  PLAN, cleanName, dienstplanStore, hasKey, isAdmin, isConfigured, isExpired, isOpen, loadEntries, seatKey,
} from '../lib/dienstplan.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function state(store) {
  return {
    plan: {
      title: PLAN.title,
      date: PLAN.date,
      seats: PLAN.seats,
      stations: PLAN.stations,
      shifts: PLAN.shifts,
      open: isOpen(),
    },
    entries: await loadEntries(store),
  };
}

export default async (req) => {
  if (!isConfigured()) return json({ reason: 'not-configured' }, 503);
  if (!hasKey(req)) {
    await wait(400); // Raten erschweren
    return json({ reason: 'invalid-key' }, 403);
  }
  if (isExpired()) return json({ reason: 'expired', plan: { title: PLAN.title, date: PLAN.date } }, 410);

  const store = dienstplanStore();
  if (req.method === 'GET') return json(await state(store));
  if (req.method !== 'POST') return json({ reason: 'method' }, 405);

  const raw = await req.text();
  if (raw.length > 2000) return json({ reason: 'too-large' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ reason: 'bad-request' }, 400);
  }

  const admin = isAdmin(req);
  if (body.action === 'admin-check') {
    if (!admin) await wait(400);
    return json({ admin }, admin ? 200 : 403);
  }

  const key = seatKey(body.seat);
  if (!key) return json({ reason: 'bad-seat' }, 400);

  if (body.action === 'add') {
    if (!isOpen() && !admin) return json({ reason: 'closed', ...(await state(store)) }, 423);
    const name = cleanName(body.name);
    if (!name) return json({ reason: 'bad-name' }, 400);
    // Nur in freie Plätze: zwei gleichzeitige Eintragungen können sich nicht überschreiben.
    const { modified } = await store.setJSON(key, { name, at: new Date().toISOString() }, { onlyIfNew: true });
    return json({ ...(await state(store)), ...(modified ? {} : { reason: 'taken' }) }, modified ? 200 : 409);
  }

  if (body.action === 'set' || body.action === 'delete') {
    if (!admin) {
      await wait(400);
      return json({ reason: 'admin-only' }, 403);
    }
    if (body.action === 'delete') {
      await store.delete(key);
    } else {
      const name = cleanName(body.name);
      if (!name) return json({ reason: 'bad-name' }, 400);
      await store.setJSON(key, { name, at: new Date().toISOString() });
    }
    console.log(`Dienstplan: Platz ${body.seat} ${body.action === 'delete' ? 'geleert' : 'geändert'} (Verwaltung).`);
    return json(await state(store));
  }

  return json({ reason: 'bad-request' }, 400);
};

export const config = {
  path: '/api/dienstplan',
};
