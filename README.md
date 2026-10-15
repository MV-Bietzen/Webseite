# Musikverein Cäcilia 1907 Bietzen e.V. — Website

Statischer One-Pager, live unter **[mv-bietzen.de](https://mv-bietzen.de)** (Hosting: Netlify).

## Aufbau

Reines HTML/CSS/JavaScript, kein Build-Prozess nötig. Nur die Netlify Functions
für die Facebook- und Instagram-Beiträge haben eine Abhängigkeit (`package.json`).

```
index.html          Startseite
musiktage.html       Unterseite Bietzer Musiktage
netlify.toml         Kalender-Proxy (/api/ics) + Caching-Regeln
netlify/functions/   Abruf (stündlich) + /api/facebook, /api/instagram und Bild-Routen
netlify/lib/         gemeinsame Abruflogik (Graph API → Netlify Blobs)
robots.txt / sitemap.xml
favicon.png
assets/
  css/               style.css
  js/                script.js
  fonts/             Lora, Poppins, DejaVu Sans Condensed (lokal eingebettet)
  wappen-*.png        Vereinswappen + Ortswappen (freigestellt)
```

## Wichtig beim Deploy

- Netlify baut bei Verknüpfung mit diesem Repo automatisch bei jedem Push auf `main`.
- Der Kalender läuft über den Proxy in `netlify.toml` (`/api/ics` → Konzertmeister),
  um das CORS-Problem der Kalenderquelle zu umgehen.
- Dateien in `assets/` werden serverseitig ein Jahr lang gecacht (siehe `netlify.toml`).
  Bei Bildaustausch daher **neuen Dateinamen** verwenden und Verweis in der HTML anpassen,
  sonst zeigen Browser monatelang die alte Version.
- Formular „Mitglied werden" nutzt Netlify Forms (kostenlos) + reCAPTCHA.
  Muss einmalig im Netlify-Dashboard unter *Forms* aktiviert werden.

## Abschnitte (index.html)

Hero → Der Verein → Termine → Aktuelles (Facebook/Instagram, nur sichtbar wenn Beiträge da) → Nachwuchs → Hauptorchester → Vorstand →
Chronik → Kontakt → Mitglied werden → Orte-Band → Footer

## Facebook- und Instagram-Beiträge („Aktuelles")

Eine Scheduled Function (`facebook-sync`) holt stündlich die neuesten Beiträge der
Facebook-Seite und des damit verknüpften Instagram-Profils über die Graph API und
speichert Texte und Bilder in Netlify Blobs. Besucher laden dadurch nichts direkt von
Meta. Benötigte Umgebungsvariablen in Netlify (*Site configuration → Environment variables*):

- `FB_PAGE_ID` — ID der Facebook-Seite
- `FB_PAGE_TOKEN` — dauerhafter Seiten-Zugriffstoken mit `pages_read_engagement`
  und für Instagram zusätzlich `instagram_basic`; als *Secret* markieren
- `IG_ACCESS_TOKEN` — Instagram-Token aus der „Instagram API mit Instagram-Login“
  (Berechtigung `instagram_business_basic`); damit ist keine Verknüpfung mit der
  Facebook-Seite nötig. Der Token wird wöchentlich automatisch verlängert und im
  Blob Store gespeichert. Ohne diese Variable wird das mit der Seite verknüpfte
  Konto über `FB_PAGE_TOKEN` (zusätzlich `instagram_basic`) genutzt.
- `IG_USER_ID` — optional für den Weg über die Facebook-Seite
- `FB_GRAPH_VERSION` — optional, Standard `v24.0`

Instagram muss in beiden Fällen ein Business- oder Creator-Konto sein. Aktuelle Instagram-Stories
(nur die gerade online sind) erscheinen als Story-Kreis über dem Instagram-Raster und
verschwinden auf der Seite automatisch nach 24 Stunden. Läuft der Token ab, bleibt der letzte Stand sichtbar. Den Grund für
fehlende Beiträge zeigen `/api/facebook` bzw. `/api/instagram` im Feld `reason`.
