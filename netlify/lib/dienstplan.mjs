// Online-Dienstplan für Vereinsveranstaltungen.
//
// Die Seite dienstplan.html ist nicht verlinkt; der Zugang läuft über einen
// geheimen Schlüssel im Link (dienstplan.html#SCHLÜSSEL). Der Schlüssel steht
// nur in Netlify (DIENSTPLAN_KEY), nicht im öffentlichen Repository.
// Jeder mit Link darf sich in ein freies Feld eintragen; Ändern und Löschen
// nur mit dem Verwaltungs-Code (DIENSTPLAN_ADMIN_CODE).
//
// Für die nächste Veranstaltung nur PLAN anpassen (neue id!) — die Einträge
// der alten Veranstaltung löscht dann der tägliche Aufräum-Job.

import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const PLAN = {
  // id bleibt (interne Kennung, schon eingetragene Namen hängen daran)
  id: 'weihnachtsmarkt-2027',
  title: 'Bietzer Weihnachtsmarkt',
  date: '2026-12-06',
  seats: 2,
  stations: [
    { id: 'burger', name: 'Burger' },
    { id: 'puffer', name: 'Kartoffelpuffer' },
    { id: 'getraenke', name: 'Getränke' },
  ],
  shifts: [
    { id: 'frueh', label: '11:00 – 14:00 Uhr' },
    { id: 'spaet', label: '14:00 – 18:00 Uhr' },
    // gemeinsam: keine Aufteilung nach Stationen, eigene Platzzahl
    { id: 'abbau', label: 'ab 18:00 Uhr · Abbau', together: true, seats: 6 },
  ],
};

// Station für Schichten ohne Aufteilung (together: true).
export const ALL_STATIONS = 'alle';

// Eintragen bis zum Ende des Veranstaltungstags, Löschen aller Namen
// 30 Tage danach.
const KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const planEnd = () => new Date(`${PLAN.date}T23:59:59+01:00`).getTime();
export const isOpen = (now = Date.now()) => now <= planEnd();
export const isExpired = (now = Date.now()) => now > planEnd() + KEEP_DAYS * DAY_MS;

export function dienstplanStore() {
  return getStore({ name: 'dienstplan', consistency: 'strong' });
}

const digest = (value) => createHash('sha256').update(String(value)).digest();
const sameSecret = (given, expected) =>
  Boolean(given) && Boolean(expected) && timingSafeEqual(digest(given), digest(expected));

export const isConfigured = () => Boolean(process.env.DIENSTPLAN_KEY);
export const hasKey = (req) => sameSecret(req.headers.get('x-dienstplan-key'), process.env.DIENSTPLAN_KEY);
export const isAdmin = (req) => sameSecret(req.headers.get('x-dienstplan-admin'), process.env.DIENSTPLAN_ADMIN_CODE);

// Platz-Kennung "schicht/station/platz", z.B. "frueh/burger/0" oder "abbau/alle/5".
export function seatKey(seat) {
  const [shift, station, index, ...rest] = String(seat || '').split('/');
  if (rest.length) return null;
  const shiftDef = PLAN.shifts.find((s) => s.id === shift);
  if (!shiftDef) return null;
  const validStation = shiftDef.together
    ? station === ALL_STATIONS
    : PLAN.stations.some((s) => s.id === station);
  if (!validStation) return null;
  const seats = shiftDef.seats || PLAN.seats;
  if (!/^\d{1,2}$/.test(index || '') || Number(index) >= seats) return null;
  return `${PLAN.id}/${shift}/${station}/${index}`;
}

// Nur Namen: Buchstaben, Leerzeichen und wenige Satzzeichen, beginnend mit
// einem Buchstaben (verhindert auch Formeln beim CSV-Export).
export function cleanName(value) {
  const name = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 40) return null;
  if (!/^\p{L}[\p{L}\p{M} .'’\-()&+/]*$/u.test(name)) return null;
  return name;
}

export async function loadEntries(store = dienstplanStore()) {
  const prefix = `${PLAN.id}/`;
  const { blobs } = await store.list({ prefix });
  const entries = {};
  await Promise.all(blobs.map(async ({ key }) => {
    const value = await store.get(key, { type: 'json' });
    if (value && value.name) entries[key.slice(prefix.length)] = value.name;
  }));
  return entries;
}

// Löscht Einträge abgelaufener oder alter Veranstaltungen.
export async function cleanup(store = dienstplanStore(), now = Date.now()) {
  const { blobs } = await store.list();
  const current = `${PLAN.id}/`;
  const stale = blobs.filter(({ key }) => !key.startsWith(current) || isExpired(now));
  await Promise.all(stale.map(({ key }) => store.delete(key)));
  return stale.length;
}
