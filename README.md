# Musikverein Cäcilia 1907 Bietzen e.V. — Website

Statischer One-Pager, live unter **[mv-bietzen.de](https://mv-bietzen.de)** (Hosting: Netlify).

## Aufbau

Reines HTML/CSS/JavaScript, kein Build-Prozess nötig. Nur die Netlify Functions
für die Facebook-Beiträge haben eine Abhängigkeit (`package.json`).

```
index.html          Startseite
musiktage.html       Unterseite Bietzer Musiktage
netlify.toml         Kalender-Proxy (/api/ics) + Caching-Regeln
netlify/functions/   Facebook-Abruf (stündlich) + /api/facebook, /api/facebook-bild/:id
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

Hero → Der Verein → Termine → Aktuelles (Facebook, nur sichtbar wenn Beiträge da) → Nachwuchs → Hauptorchester → Vorstand →
Chronik → Kontakt → Mitglied werden → Orte-Band → Footer

## Facebook-Beiträge („Aktuelles")

Eine Scheduled Function holt stündlich die neuesten Beiträge der Vereinsseite über die
Facebook Graph API und speichert Texte und Bilder in Netlify Blobs. Besucher laden
dadurch nichts direkt von Facebook. Benötigte Umgebungsvariablen in Netlify
(*Site configuration → Environment variables*):

- `FB_PAGE_ID` — ID der Facebook-Seite
- `FB_PAGE_TOKEN` — dauerhafter Seiten-Zugriffstoken (Berechtigung `pages_read_engagement`), als *Secret* markieren
- `FB_GRAPH_VERSION` — optional, Standard `v24.0`

Läuft der Token ab, bleibt der letzte Stand sichtbar; Fehler stehen im Function-Log
von `facebook-sync`.
