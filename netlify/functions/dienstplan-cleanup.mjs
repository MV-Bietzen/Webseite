import { cleanup } from '../lib/dienstplan.mjs';

// Löscht täglich die Namen abgelaufener Dienstpläne (30 Tage nach der
// Veranstaltung) und alter Veranstaltungen.
export default async () => {
  const removed = await cleanup();
  if (removed) console.log(`Dienstplan: ${removed} alte Einträge gelöscht.`);
};

export const config = {
  schedule: '@daily',
};
