/**
 * SKINCONCEPT — Google Kalender → Kundenliste Abgleich
 *
 * Liest Termine aus dem Google Kalender (bis Dez 2025)
 * und vergleicht mit der Kundenkartei.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '.google-session.json');
const OUTPUT_FILE = path.join(__dirname, 'kalender-kunden.json');

async function main() {
  console.log('\n📅 Skinconcept — Google Kalender Auslesen\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined
  });
  const page = await context.newPage();

  // Google Kalender öffnen
  console.log('📱 Öffne Google Kalender...');
  await page.goto('https://calendar.google.com', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  // Login prüfen
  const url = page.url();
  if (url.includes('accounts.google.com') || url.includes('signin')) {
    console.log('\n🔑 Bitte im Browser bei Google einloggen...');
    console.log('   (Das Fenster bleibt offen bis du eingeloggt bist)\n');
    try {
      await page.waitForURL('**/calendar/**', { timeout: 180000 });
      console.log('✅ Login erfolgreich!\n');
    } catch {
      console.log('⚠️  Warte weiter auf Login...');
      await page.waitForURL('**/calendar/**', { timeout: 120000 }).catch(() => {});
    }
  }

  // Session speichern
  await context.storageState({ path: SESSION_FILE });
  console.log('💾 Session gespeichert\n');

  // Auf Listenansicht wechseln (einfacher auszulesen)
  // Erst zur Monatsansicht wechseln
  await page.waitForTimeout(3000);

  // Alle Kundennamen sammeln
  const allCustomers = new Set();
  const customerDates = {};

  // Monate durchgehen: Dez 2025 → zurück bis Jun 2025
  const months = [
    { year: 2025, month: 12, label: 'Dezember 2025' },
    { year: 2025, month: 11, label: 'November 2025' },
    { year: 2025, month: 10, label: 'Oktober 2025' },
    { year: 2025, month: 9, label: 'September 2025' },
    { year: 2025, month: 8, label: 'August 2025' },
    { year: 2025, month: 7, label: 'Juli 2025' },
    { year: 2025, month: 6, label: 'Juni 2025' },
  ];

  for (const m of months) {
    // Navigiere zum Monat via URL
    const dateStr = `${m.year}/${m.month}/1`;
    console.log(`📆 Lade ${m.label}...`);
    await page.goto(`https://calendar.google.com/calendar/r/month/${dateStr}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Alle Termine auf der Seite auslesen
    const events = await page.evaluate(() => {
      const results = [];
      // Google Calendar zeigt Events als Elemente mit data-eventid oder in Chips
      const eventEls = document.querySelectorAll('[data-eventid], [data-eventchip], .KF4T6b, .FAxxKc, .WBi6oc');
      eventEls.forEach(el => {
        const text = el.textContent.trim();
        if (text) results.push(text);
      });

      // Auch aria-labels auslesen (enthalten oft den vollständigen Termintext)
      document.querySelectorAll('[aria-label]').forEach(el => {
        const label = el.getAttribute('aria-label') || '';
        if (label.length > 5 && !label.includes('Navigat') && !label.includes('Kalender')) {
          results.push(label);
        }
      });

      return [...new Set(results)];
    });

    console.log(`   ${events.length} Einträge gefunden`);

    // Kundennamen extrahieren (typisch: "10:00 Kundenname" oder "Kundenname - Behandlung")
    events.forEach(ev => {
      // Typische Muster:
      // "10:00 - 11:00 Sabrina Gabriel"
      // "Sabrina Gabriel, HydroCare"
      // "14:00 Anna-Lena Kessler"
      let name = ev
        .replace(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g, '') // Zeitbereich entfernen
        .replace(/\d{1,2}:\d{2}/g, '')  // Einzelne Zeit entfernen
        .replace(/^\s*[-–,]\s*/, '')     // Führende Trennzeichen
        .replace(/,.*$/, '')             // Alles nach Komma entfernen (Behandlungsart)
        .replace(/[-–].*behandlung.*$/i, '') // "- Behandlung" entfernen
        .replace(/[-–]\s*(Hydrocare|Skincheck|Micro|Facial|Peeling|Waxing|Augenbrauen|Wimpern|Beratung|Neukundenbehandlung).*$/i, '')
        .trim();

      // Nur Namen mit mind. 2 Wörtern oder mind. 5 Buchstaben
      if (name.length >= 5 && !name.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)/i)) {
        allCustomers.add(name);
        if (!customerDates[name]) customerDates[name] = [];
        customerDates[name].push(m.label);
      }
    });
  }

  console.log(`\n📋 ${allCustomers.size} Kunden im Kalender gefunden (Jun-Dez 2025)\n`);

  // Jetzt mit Kartei-Daten vergleichen
  // Lade Trello-Kundendaten
  const trelloFile = path.join(__dirname, 'trello_all_kunden.js');
  const trelloCode = fs.readFileSync(trelloFile, 'utf8');
  // Parse alleKunden
  const alleKundenMatch = trelloCode.match(/alleKunden\s*=\s*(\[[\s\S]*\])/);
  let alleKunden = [];
  if (alleKundenMatch) {
    try { alleKunden = eval(alleKundenMatch[1]); } catch {}
  }

  const normalize = s => s.toLowerCase().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss').replace(/-/g, ' ').trim();

  // Erstelle Set aller bekannten Kunden
  const knownNames = new Set();
  alleKunden.forEach(raw => {
    let name = (raw.name || '').trim();
    let fn = '', ln = '';
    if (name.includes(',')) { const p = name.split(','); ln = p[0].trim(); fn = p.slice(1).join(',').trim(); }
    else { const p = name.split(' '); fn = p[0] || ''; ln = p.slice(1).join(' ') || ''; }
    knownNames.add(normalize(fn + ' ' + ln));
    knownNames.add(normalize(ln + ' ' + fn));
    knownNames.add(normalize(name));
  });

  // Vergleich
  const notInKartei = [];
  const inKartei = [];

  allCustomers.forEach(name => {
    const n = normalize(name);
    // Auch Teile prüfen
    const parts = name.split(' ');
    const reversed = parts.length >= 2 ? normalize(parts.slice(1).join(' ') + ' ' + parts[0]) : n;

    if (knownNames.has(n) || knownNames.has(reversed)) {
      inKartei.push(name);
    } else {
      notInKartei.push({ name, lastSeen: customerDates[name] || [] });
    }
  });

  console.log('✅ In Kartei gefunden:', inKartei.length);
  console.log('❌ NICHT in Kartei:', notInKartei.length);

  if (notInKartei.length > 0) {
    console.log('\n--- Kunden die FEHLEN ---\n');
    notInKartei.forEach(c => {
      console.log('  ❌ ' + c.name + ' (zuletzt: ' + c.lastSeen.join(', ') + ')');
    });
  }

  // Ergebnisse speichern
  const output = {
    timestamp: new Date().toISOString(),
    totalCalendar: allCustomers.size,
    inKartei: inKartei.length,
    missing: notInKartei,
    allCalendarNames: [...allCustomers].sort()
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log('\n💾 Ergebnisse gespeichert in: kalender-kunden.json');

  // Session speichern
  await context.storageState({ path: SESSION_FILE });

  console.log('\n🎉 Fertig! Browser wird in 10 Sekunden geschlossen.\n');
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(err => {
  console.error('\n❌ Fehler:', err.message);
  process.exit(1);
});
