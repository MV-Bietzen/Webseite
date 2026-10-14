import { isConfigured, syncFacebook, syncInstagram } from '../lib/facebook.mjs';

export default async () => {
  if (!isConfigured()) {
    console.log('Abruf übersprungen: FB_PAGE_ID / FB_PAGE_TOKEN fehlen.');
    return;
  }
  // Beide Kanäle unabhängig: scheitert einer, bleibt dessen alter Stand
  // im Speicher und wird weiter angezeigt.
  for (const [name, sync] of [['Facebook', syncFacebook], ['Instagram', syncInstagram]]) {
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
