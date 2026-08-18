# Musikverein Cäcilia 1907 Bietzen e.V. — Website

Statischer One-Pager, live unter **[mv-bietzen.de](https://mv-bietzen.de)** (Hosting: Netlify).

## Aufbau

Reines HTML/CSS/JavaScript, kein Build-Prozess nötig.

```
index.html          Startseite
musiktage.html       Unterseite Bietzer Musiktage
netlify.toml         Kalender-Proxy (/api/ics) + Caching-Regeln
robots.txt / sitemap.xml
favicon.png
assets/
  css/               index.css, musiktage.css
  js/                index.js, musiktage.js
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

Hero → Der Verein → Termine → Nachwuchs → Hauptorchester → Vorstand →
Chronik → Kontakt → Mitglied werden → Orte-Band → Footer
