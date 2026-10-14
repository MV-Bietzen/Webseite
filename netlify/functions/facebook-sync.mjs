import { isConfigured, isInstagramConfigured, syncFacebook, syncInstagram } from '../lib/facebook.mjs';

export default async () => {
  const channels = [
    ['Facebook', isConfigured, syncFacebook],
    ['Instagram', isInstagramConfigured, syncInstagram],
  ];
  // Beide Kanäle unabhängig: scheitert einer, bleibt dessen alter Stand
  // im Speicher und wird weiter angezeigt.
  for (const [name, configured, sync] of channels) {
    if (!configured()) {
      console.log(`${name}-Abruf übersprungen: Zugangsdaten fehlen.`);
      continue;
    }
    try {
      const feed = await sync();
      console.log(`${name}-Abruf ok: ${feed.posts.length} Beiträge.`);
    } catch (err) {
      console.error(`${name}-Abruf fehlgeschlagen:`, err.message);
    }
  }
};

export const config = {
  schedule: '@hourly',
};
