  // Sticky header shrink
  const header = document.getElementById('site-header');
  const onScroll = () => {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile nav toggle
  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });
  primaryNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      primaryNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  // Footer year
  document.getElementById('copyright').textContent =
    '© ' + new Date().getFullYear() + ' Musikverein Cäcilia 1907 Bietzen e.V.';

  /* =========================================================
     LIVE-TERMINE AUS ICS-KALENDER (Konzertmeister)
     ========================================================= */

  // Die Original-Kalender-URL. Auf Netlify wird sie über den Proxy /api/ics (siehe netlify.toml)
  // aufgerufen, wodurch das CORS-Problem entfällt.
  const ICS_URL = 'https://rest.konzertmeister.app/api/v1/ical/422429ef-62e5-4d3c-9c5b-5c30bc913d2e?orgId=81108&history=false&global=true&includeOrgName=false&appointmentTypeIds=1,2,3&excludeMeetingPoints=true';

  const ICS_VISIBLE_EVENTS = 10;      // zunächst sichtbar, Rest per Button aufklappbar
  const ICS_REFRESH_MS = 15 * 60 * 1000; // alle 15 Minuten automatisch neu laden

  const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const WEEKDAYS_LONG = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  // Entfernt ICS-Zeilenumbrüche (fortgesetzte Zeilen beginnen mit Leerzeichen/Tab)
  function unfoldICS(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  }

  // Löst ICS-Textescapes auf: \, \; \n \\
  function unescapeICSText(str) {
    if (!str) return '';
    return str
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  // Parst ein ICS-Datum (YYYYMMDD oder YYYYMMDDTHHMMSS[Z]) zu einem JS Date
  function parseICSDate(value) {
    if (!value) return null;
    const isAllDay = /^\d{8}$/.test(value);
    if (isAllDay) {
      const y = +value.slice(0, 4), m = +value.slice(4, 6), d = +value.slice(6, 8);
      return { date: new Date(y, m - 1, d), allDay: true };
    }
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    const date = z
      ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
      : new Date(+y, +mo - 1, +d, +h, +mi, +s);
    return { date, allDay: false };
  }

  // Parst den kompletten ICS-Text in ein Array von Terminobjekten
  function parseICS(rawText) {
    const text = unfoldICS(rawText);
    const events = [];
    const blocks = text.split('BEGIN:VEVENT').slice(1);

    blocks.forEach(block => {
      const body = block.split('END:VEVENT')[0];
      const lines = body.split('\n').filter(Boolean);
      const ev = {};

      lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return;
        const rawKey = line.slice(0, colonIdx);   // z.B. "DTSTART;VALUE=DATE" oder "DTSTART"
        const value = line.slice(colonIdx + 1);
        const key = rawKey.split(';')[0].toUpperCase();

        switch (key) {
          case 'SUMMARY': ev.summary = unescapeICSText(value); break;
          case 'LOCATION': ev.location = unescapeICSText(value); break;
          case 'DESCRIPTION': ev.description = unescapeICSText(value); break;
          case 'URL': ev.url = value.trim(); break;
          case 'UID': ev.uid = value.trim(); break;
          case 'DTSTART': ev.dtstart = parseICSDate(value.trim()); break;
          case 'DTEND': ev.dtend = parseICSDate(value.trim()); break;
        }
      });

      if (ev.dtstart) events.push(ev);
    });

    return events;
  }

  function formatTimeRange(ev) {
    if (ev.dtstart.allDay) return 'ganztägig';
    const opts = { hour: '2-digit', minute: '2-digit' };
    const start = ev.dtstart.date.toLocaleTimeString('de-DE', opts);
    if (ev.dtend && !ev.dtend.allDay) {
      const sameDay = ev.dtend.date.toDateString() === ev.dtstart.date.toDateString();
      if (sameDay) return start + ' – ' + ev.dtend.date.toLocaleTimeString('de-DE', opts) + ' Uhr';
    }
    return start + ' Uhr';
  }

  function renderICSEvents(events) {
    const content = document.getElementById('icsContent');
    const moreEl = document.getElementById('icsMore');
    const now = new Date();

    const upcoming = events
      .filter(ev => (ev.dtend ? ev.dtend.date : ev.dtstart.date) >= now)
      .sort((a, b) => a.dtstart.date - b.dtstart.date);

    if (upcoming.length === 0) {
      content.innerHTML = '<p class="ics-empty">Aktuell sind keine kommenden Termine im Kalender eingetragen.</p>';
      moreEl.hidden = true;
      return;
    }

    const list = document.createElement('ul');
    list.className = 'ics-list';

    // Alle Termine werden ins Dokument geschrieben (wichtig für Suchmaschinen),
    // die über ICS_VISIBLE_EVENTS hinausgehenden zunächst nur optisch ausgeblendet.
    upcoming.forEach((ev, index) => {
      const li = document.createElement('li');
      const tag = ev.url ? 'a' : 'div';
      const el = document.createElement(tag);
      el.className = 'ics-event';
      if (ev.url) { el.href = ev.url; el.target = '_blank'; el.rel = 'noopener'; }

      if (index >= ICS_VISIBLE_EVENTS) li.classList.add('ics-hidden');

      const d = ev.dtstart.date;
      const metaParts = [formatTimeRange(ev)];
      if (ev.location) metaParts.push(ev.location);

      el.innerHTML = `
        <div class="ics-date-badge">
          <span class="day">${d.getDate()}</span>
          <span class="month">${MONTHS_SHORT[d.getMonth()]}</span>
        </div>
        <div class="ics-event-main">
          <div class="title">${escapeHTML(ev.summary || 'Termin')}</div>
          <div class="meta"><span>${WEEKDAYS_LONG[d.getDay()]} · ${escapeHTML(metaParts.join(' · '))}</span></div>
        </div>
        ${ev.url ? '<span class="ics-event-arrow" aria-hidden="true">→</span>' : ''}
      `;
      li.appendChild(el);
      list.appendChild(li);
    });

    content.innerHTML = '';
    content.appendChild(list);

    // Suchmaschinen erhalten immer alle Termine, unabhängig von der Anzeige
    injectEventStructuredData(upcoming);

    const hiddenCount = upcoming.length - ICS_VISIBLE_EVENTS;
    if (hiddenCount > 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ics-toggle';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = hiddenCount === 1
        ? '1 weiteren Termin anzeigen'
        : `${hiddenCount} weitere Termine anzeigen`;

      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        list.querySelectorAll('.ics-hidden').forEach(li => {
          li.classList.toggle('ics-revealed', !expanded);
        });
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = !expanded
          ? 'Weniger anzeigen'
          : (hiddenCount === 1 ? '1 weiteren Termin anzeigen' : `${hiddenCount} weitere Termine anzeigen`);
      });

      content.appendChild(btn);
    }

    moreEl.hidden = false;
    moreEl.textContent = upcoming.length === 1
      ? '1 kommender Termin'
      : `${upcoming.length} kommende Termine`;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Erzeugt aus den geladenen Kalenderterminen schema.org-Auszeichnungen (JSON-LD),
  // damit Suchmaschinen wie Google die Termine als Veranstaltungen erkennen können.
  function injectEventStructuredData(events) {
    const existing = document.getElementById('ics-structured-data');
    if (existing) existing.remove();
    if (!events.length) return;

    // Interne Organisationstermine sind für die Öffentlichkeit nicht relevant
    const publicEvents = events.filter(ev => {
      const s = (ev.summary || '').toLowerCase();
      return !s.includes('vorstandssitzung') && !s.startsWith('tp:');
    });
    if (!publicEvents.length) return;

    const toISO = (d) => {
      const pad = n => String(n).padStart(2, '0');
      const off = -d.getTimezoneOffset();
      const sign = off >= 0 ? '+' : '-';
      const oh = pad(Math.floor(Math.abs(off) / 60));
      const om = pad(Math.abs(off) % 60);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T` +
             `${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
    };

    const data = publicEvents.map(ev => {
      const item = {
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        "name": ev.summary || 'Termin',
        "startDate": toISO(ev.dtstart.date),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "organizer": { "@id": "https://mv-bietzen.de/#verein" },
        "performer": { "@id": "https://mv-bietzen.de/#verein" },
        "location": {
          "@type": "Place",
          "name": ev.location || 'Bietzen',
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Merzig-Bietzen",
            "postalCode": "66663",
            "addressCountry": "DE"
          }
        }
      };
      if (ev.dtend) item.endDate = toISO(ev.dtend.date);
      if (ev.description) item.description = ev.description;
      if (ev.url) item.url = ev.url;
      return item;
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'ics-structured-data';
    script.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(script);
  }

  function setICSStatus(state, text) {
    const statusEl = document.getElementById('icsStatus');
    const textEl = document.getElementById('icsStatusText');
    statusEl.classList.toggle('is-error', state === 'error');
    textEl.textContent = text;
  }

  // Der Kalender wird über den Netlify-Proxy /api/ics geladen (siehe netlify.toml).
  // Dadurch ruft der Browser nur die eigene Domain auf und das CORS-Problem entfällt.
  const NETLIFY_PROXY_PATH = '/api/ics';

  // Nur als Notfall-Absicherung, falls die Seite einmal ohne Netlify-Proxy läuft
  // (z.B. lokal geöffnet): öffentliche CORS-Proxy-Dienste.
  const ICS_PROXY_FALLBACKS = [
    (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    (url) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(url),
  ];

  async function fetchICSText() {
    const attempts = [NETLIFY_PROXY_PATH, ICS_URL, ...ICS_PROXY_FALLBACKS.map(build => build(ICS_URL))];
    let lastError;
    for (const url of attempts) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Antwort enthält keinen gültigen ICS-Kalender');
        return text;
      } catch (err) {
        lastError = err;
        console.warn('ICS-Abruf fehlgeschlagen für', url, err);
      }
    }
    throw lastError;
  }

  async function loadICSCalendar() {
    try {
      setICSStatus('loading', 'Aktualisiert…');
      const text = await fetchICSText();
      const events = parseICS(text);
      renderICSEvents(events);
      const now = new Date();
      setICSStatus('ok', 'Aktualisiert um ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr');
    } catch (err) {
      console.error('ICS-Kalender konnte nicht geladen werden:', err);
      const content = document.getElementById('icsContent');
      content.innerHTML = `
        <div class="ics-error-msg">
          <strong>Kalender konnte nicht geladen werden.</strong>
          Das kann an einer fehlenden CORS-Freigabe der Kalenderquelle liegen oder an fehlender Internetverbindung.
          Der statische Programm-Überblick oben bleibt in jedem Fall sichtbar.
        </div>`;
      document.getElementById('icsMore').hidden = true;
      setICSStatus('error', 'Konnte nicht aktualisiert werden');
    }
  }

  loadICSCalendar();
  setInterval(loadICSCalendar, ICS_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadICSCalendar();
  });

  /* =========================================================
     KALENDER ABONNIEREN
     webcal:// öffnet direkt die Kalender-App (iOS, Android, Outlook,
     Thunderbird). Läuft die Seite nicht unter der echten Domain,
     wird der Konzertmeister-Feed direkt verwendet.
     ========================================================= */
  const subscribeBtn = document.getElementById('icsSubscribeBtn');
  const copyBtn = document.getElementById('icsCopyBtn');

  if (subscribeBtn && copyBtn) {
    const onOwnDomain = location.hostname.endsWith('mv-bietzen.de');
    const httpsFeed = onOwnDomain
      ? location.origin + '/api/ics'
      : ICS_URL;
    const webcalFeed = httpsFeed.replace(/^https?:/, 'webcal:');

    subscribeBtn.href = webcalFeed;

    copyBtn.addEventListener('click', async () => {
      const feedback = document.createElement('span');
      feedback.className = 'ics-copy-feedback';
      try {
        await navigator.clipboard.writeText(httpsFeed);
        feedback.textContent = 'Link kopiert';
      } catch {
        // Ältere Browser oder fehlende Berechtigung: Link zum Markieren anzeigen
        window.prompt('Kalender-Link zum Kopieren:', httpsFeed);
        return;
      }
      const actions = copyBtn.parentElement;
      actions.querySelectorAll('.ics-copy-feedback').forEach(el => el.remove());
      actions.appendChild(feedback);
      setTimeout(() => feedback.remove(), 2500);
    });
  }

  /* =========================================================
     BEITRITTSFORMULAR
     Blendet die Zusatzfelder nur ein, wenn sie zutreffen:
     Familienangaben bei Familienmitgliedschaft, Angaben zum
     Erziehungsberechtigten bei Minderjaehrigen.
     ========================================================= */
  (function initBeitritt() {
    const form = document.getElementById('beitrittForm');
    if (!form) return;

    const feldFamilie = document.getElementById('feldFamilie');
    const feldMinder = document.getElementById('feldMinderjaehrig');
    const geburt = document.getElementById('b-geburt');

    form.querySelectorAll('input[name="mitgliedschaft"]').forEach(radio => {
      radio.addEventListener('change', () => {
        feldFamilie.hidden = !document.getElementById('t-familie').checked;
      });
    });

    function pruefeAlter() {
      if (!geburt.value) { feldMinder.hidden = true; return; }
      const geb = new Date(geburt.value);
      if (isNaN(geb)) { feldMinder.hidden = true; return; }
      const heute = new Date();
      let alter = heute.getFullYear() - geb.getFullYear();
      const m = heute.getMonth() - geb.getMonth();
      if (m < 0 || (m === 0 && heute.getDate() < geb.getDate())) alter--;
      feldMinder.hidden = alter >= 18;
    }
    geburt.addEventListener('change', pruefeAlter);
    geburt.addEventListener('blur', pruefeAlter);
  })();

  /* =========================================================
     KARTE (Anfahrt)
     Wird erst auf Klick geladen, damit ohne Zustimmung keine
     Verbindung zu OpenStreetMap aufgebaut wird.
     ========================================================= */
  const mapLoadBtn = document.getElementById('mapLoadBtn');
  const mapConsent = document.getElementById('mapConsent');

  if (mapLoadBtn && mapConsent) {
    mapLoadBtn.addEventListener('click', () => {
      const lat = 49.4133142, lon = 6.658644;
      const d = 0.006;
      const bbox = [lon - d, lat - d / 2, lon + d, lat + d / 2].join('%2C');

      const wrapper = document.createElement('div');
      wrapper.className = 'map-frame';

      const frame = document.createElement('iframe');
      frame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox +
                  '&layer=mapnik&marker=' + lat + '%2C' + lon;
      frame.title = 'Karte: Probelokal Menninger Straße 69, Merzig-Bietzen';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer';
      wrapper.appendChild(frame);

      const hint = document.createElement('p');
      hint.className = 'map-hint';
      hint.innerHTML = 'Kartendaten: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende';

      mapConsent.replaceWith(wrapper);
      wrapper.after(hint);
    });
  }

  /* =========================================================
     ORTE-BAND
     Ab 900px stehen alle vier Orte ruhig nebeneinander.
     Darunter laesst sich das Band wie auf dem Smartphone wischen:
     natives Scrollen mit Einrasten, ergaenzt um einen sanften
     Auto-Vorlauf, der beim Anfassen pausiert.
     ========================================================= */
  const ORTE_INTERVAL_MS = 3500;   // Wartezeit zwischen zwei Schritten
  const ORTE_RESUME_MS   = 6000;   // Pause nach eigener Wischbewegung

  const marqueeTrack = document.querySelector('#orteMarquee .marquee-track');
  const marqueeBox = document.getElementById('orteMarquee');

  if (marqueeTrack && marqueeBox) {
    const originalItems = Array.from(marqueeTrack.children).map(el => el.cloneNode(true));
    const origCount = originalItems.filter(el => el.classList.contains('marquee-item')).length;
    const wideScreen = window.matchMedia('(min-width: 900px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let timer = null;
    let resumeTimer = null;
    let scrollEndTimer = null;
    let index = 0;
    let swipeable = false;
    let programmatic = false;

    const items = () => marqueeTrack.querySelectorAll('.marquee-item');

    function scrollToIndex(i, smooth) {
      const list = items();
      if (!list[i]) return;
      const item = list[i];
      const target = item.offsetLeft - (marqueeBox.clientWidth - item.offsetWidth) / 2;
      programmatic = true;
      marqueeBox.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
      setTimeout(() => { programmatic = false; }, smooth ? 700 : 60);
    }

    // Ermittelt, welcher Ort gerade am naechsten zur Mitte liegt
    function nearestIndex() {
      const mid = marqueeBox.scrollLeft + marqueeBox.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      items().forEach((el, i) => {
        const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      return best;
    }

    function stepForward() {
      index++;
      scrollToIndex(index, true);
      // Nach dem letzten Original unbemerkt in die naechste Kopie zurueck
      if (index >= origCount * 2) {
        setTimeout(() => {
          index -= origCount;
          scrollToIndex(index, false);
        }, 750);
      }
    }

    function startAuto() {
      if (timer || !swipeable) return;
      timer = setInterval(stepForward, ORTE_INTERVAL_MS);
    }
    function stopAuto() {
      clearInterval(timer);
      timer = null;
    }
    function pauseThenResume() {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, ORTE_RESUME_MS);
    }

    function buildMarquee() {
      const needsSwipe = !wideScreen.matches && !reducedMotion.matches;
      stopAuto();
      clearTimeout(resumeTimer);

      marqueeTrack.innerHTML = '';
      originalItems.forEach(el => marqueeTrack.appendChild(el.cloneNode(true)));

      if (needsSwipe) {
        // Kopien vor und nach den Originalen, damit der Umlauf in beide
        // Richtungen nahtlos wirkt (auch rueckwaerts von Bietzen zu Saarland)
        const makeCopy = el => {
          const copy = el.cloneNode(true);
          copy.setAttribute('aria-hidden', 'true');
          if (copy.tagName === 'A') copy.setAttribute('tabindex', '-1');
          return copy;
        };
        originalItems.slice().reverse().forEach(el => marqueeTrack.insertBefore(makeCopy(el), marqueeTrack.firstChild));
        originalItems.forEach(el => marqueeTrack.appendChild(makeCopy(el)));
        swipeable = true;
        index = origCount;
        requestAnimationFrame(() => scrollToIndex(index, false));
        startAuto();
      } else {
        swipeable = false;
        marqueeBox.scrollLeft = 0;
      }
    }

    // Eigenes Wischen: Auto-Vorlauf pausieren und Position uebernehmen
    marqueeBox.addEventListener('scroll', () => {
      if (!swipeable || programmatic) return;
      pauseThenResume();
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        index = nearestIndex();
        // Beim Wischen in eine der Randkopien unbemerkt in die Mitte zurueck,
        // damit in beide Richtungen weitergewischt werden kann
        if (index >= origCount * 2) {
          index -= origCount;
          scrollToIndex(index, false);
        } else if (index < origCount) {
          index += origCount;
          scrollToIndex(index, false);
        }
      }, 140);
    }, { passive: true });

    ['pointerdown', 'touchstart'].forEach(ev =>
      marqueeBox.addEventListener(ev, stopAuto, { passive: true }));
    marqueeBox.addEventListener('mouseenter', stopAuto);
    marqueeBox.addEventListener('mouseleave', () => { if (swipeable) startAuto(); });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') startAuto();
      else stopAuto();
    });

    buildMarquee();
    wideScreen.addEventListener('change', buildMarquee);
    reducedMotion.addEventListener('change', buildMarquee);
    window.addEventListener('resize', () => { if (swipeable) scrollToIndex(index, false); });
  }

  /* =========================================================
     KONTAKTFORMULAR
     Baut eine mailto-Nachricht und öffnet das E-Mail-Programm.
     Kein echtes Formular-Submit -> keine Browser-Sicherheitswarnung.
     ========================================================= */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameEl = document.getElementById('name');
      const emailEl = document.getElementById('email');
      const messageEl = document.getElementById('message');
      const hintEl = document.getElementById('formHint');

      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const message = messageEl.value.trim();

      if (!name || !email || !message) {
        hintEl.textContent = 'Bitte füllen Sie alle Felder aus.';
        (!name ? nameEl : !email ? emailEl : messageEl).focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        hintEl.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
        emailEl.focus();
        return;
      }

      const subject = 'Nachricht über die Website von ' + name;
      const body = message + '\n\n---\nName: ' + name + '\nE-Mail: ' + email;

      window.location.href = 'mailto:info@mv-bietzen.de'
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);

      hintEl.textContent = 'Ihr E-Mail-Programm wurde geöffnet. Bitte dort noch absenden.';
    });
  }

  /* =========================================================
     LEGAL MODALS (Impressum / Datenschutz)
     ========================================================= */
  let lastFocusedEl = null;

  function openModal(name) {
    const overlay = document.getElementById('modal-' + name);
    if (!overlay) return;
    document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id.replace('modal-', '')));
    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(name) {
    const overlay = document.getElementById('modal-' + name);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 250);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  document.querySelectorAll('[data-modal-open]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(trigger.getAttribute('data-modal-open'));
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(trigger.getAttribute('data-modal-open'));
      }
    });
  });

  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id.replace('modal-', ''));
    });
  });

  document.querySelectorAll('[data-modal-switch]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const overlay = link.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id.replace('modal-', ''));
      setTimeout(() => openModal(link.getAttribute('data-modal-switch')), 260);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id.replace('modal-', ''));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-overlay.open');
      if (open) closeModal(open.id.replace('modal-', ''));
    }
  });
