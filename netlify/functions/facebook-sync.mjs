import { isConfigured, syncFacebook } from '../lib/facebook.mjs';

export default async () => {
  if (!isConfigured()) {
    console.log('Facebook-Abruf übersprungen: FB_PAGE_ID / FB_PAGE_TOKEN fehlen.');
    return;
  }
  try {
    const feed = await syncFacebook();
    console.log(`Facebook-Abruf ok: ${feed.posts.length} Beiträge.`);
  } catch (err) {
    // Alter Stand bleibt im Speicher und wird weiter angezeigt.
    console.error('Facebook-Abruf fehlgeschlagen:', err.message);
  }
};

export const config = {
  schedule: '@hourly',
};
