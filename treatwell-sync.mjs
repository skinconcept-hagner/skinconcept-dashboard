/**
 * SKINCONCEPT — Treatwell Kassenbuch → Nachsorge Sync
 *
 * Liest automatisch die Kunden aus dem Treatwell-Kassenbuch
 * und trägt sie in Firebase (Nachsorge) ein.
 *
 * Aufruf: node treatwell-sync.mjs
 *
 * Beim ersten Mal: Login im Browser-Fenster
 * Danach: Session wird gespeichert, läuft automatisch
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '.treatwell-session.json');

// Firebase config (skinconcept-tool — gleiche DB wie Nachsorge-Seite)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAdGdgPnS3Cw3Rpiubx6_s61FyfiTQxfFc",
  projectId: "skinconcept-tool"
};

const SKIP_NAMES = ['laufkundschaft', 'treatwell support', 'test', 'barverkauf', ''];

async function main() {
  console.log('\n🔄 Skinconcept — Treatwell Kassenbuch Sync\n');

  // Browser starten (sichtbar, damit Login möglich ist)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined
  });
  const page = await context.newPage();

  // Treatwell Partner-Login öffnen
  console.log('📱 Öffne Treatwell...');
  await page.goto('https://connect.shore.com/merchant/calendar', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  // Prüfen ob Login nötig ist
  const url = page.url();
  if (url.includes('login') || url.includes('auth') || url.includes('sign')) {
    console.log('\n🔑 Bitte im Browser bei Treatwell einloggen...');
    console.log('   (Das Fenster bleibt offen bis du eingeloggt bist)\n');

    // Warte bis der User eingeloggt ist (max 3 Minuten)
    try {
      await page.waitForURL('**/merchant/**', { timeout: 180000 });
      console.log('✅ Login erfolgreich!\n');
    } catch {
      // Versuche alternative URL-Patterns
      await page.waitForURL('**/calendar**', { timeout: 30000 }).catch(() => {});
    }
  }

  // Session speichern für nächstes Mal
  await context.storageState({ path: SESSION_FILE });
  console.log('💾 Session gespeichert (nächstes Mal kein Login nötig)\n');

  // Zum Kassenbuch navigieren
  console.log('📖 Navigiere zum Kassenbuch...');

  // Versuche verschiedene Kassenbuch-URLs
  const kassenbuchUrls = [
    'https://connect.shore.com/merchant/pos/transactions',
    'https://connect.shore.com/merchant/pos',
    'https://connect.shore.com/merchant/cash-register'
  ];

  let found = false;
  for (const kbUrl of kassenbuchUrls) {
    try {
      await page.goto(kbUrl, { waitUntil: 'networkidle', timeout: 15000 });
      found = true;
      break;
    } catch { continue; }
  }

  if (!found) {
    console.log('\n⚠️  Kassenbuch-Seite nicht gefunden.');
    console.log('   Bitte navigiere manuell zum Kassenbuch im Browser-Fenster.');
    console.log('   Drücke dann Enter in diesem Terminal...\n');
    await waitForEnter();
  }

  // Warte bis die Tabelle geladen ist
  await page.waitForTimeout(3000);

  // Screenshot für Debug
  await page.screenshot({ path: path.join(__dirname, 'treatwell-kassenbuch.png') });
  console.log('📸 Screenshot gespeichert: treatwell-kassenbuch.png\n');

  // Kunden aus der Seite extrahieren
  console.log('🔍 Lese Kunden aus dem Kassenbuch...\n');

  const entries = await page.evaluate(() => {
    const results = [];

    // Datum finden (verschiedene Selektoren probieren)
    let dateStr = '';
    const dateInputs = document.querySelectorAll('input[type="date"], input[type="text"]');
    dateInputs.forEach(input => {
      const val = input.value;
      if (val && val.match(/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/)) {
        dateStr = val;
      }
    });
    // Auch aus Buttons/Spans/Divs suchen
    if (!dateStr) {
      document.querySelectorAll('button, span, div, h2, h3').forEach(el => {
        const text = el.textContent.trim();
        const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) dateStr = m[0];
      });
    }

    // Tabelle finden und Zeilen auslesen
    const rows = document.querySelectorAll('tr, [class*="transaction"], [class*="row"], [class*="list-item"]');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, [class*="cell"], [class*="column"]');
      if (cells.length >= 4) {
        // Kunde ist typischerweise die letzte oder eine der letzten Spalten
        const texts = Array.from(cells).map(c => c.textContent.trim());
        // Finde die Spalte mit einem Namen (mind. 2 Wörter, keine Nummer)
        let name = '';
        for (let i = texts.length - 1; i >= 0; i--) {
          const t = texts[i];
          if (t && !t.match(/^\d/) && !t.match(/^VERKAUF|STORNO/i) && !t.match(/^\d{2}:\d{2}/) && t.includes(' ') || (t && t.length > 3 && !t.match(/[\d€,\.\/]/))) {
            name = t;
            break;
          }
        }
        if (name) results.push({ name, dateStr });
      }
    });

    return { entries: results, date: dateStr, url: window.location.href };
  });

  console.log('📅 Datum:', entries.date || 'nicht erkannt');
  console.log('👥 Gefundene Einträge:', entries.entries.length);

  // Datum normalisieren
  let syncDate = '';
  if (entries.date) {
    const m = entries.date.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) syncDate = m[3] + '-' + m[2] + '-' + m[1];
    else if (entries.date.match(/\d{4}-\d{2}-\d{2}/)) syncDate = entries.date;
  }
  if (!syncDate) {
    syncDate = new Date().toISOString().slice(0, 10);
    console.log('⚠️  Datum nicht erkannt, verwende heute:', syncDate);
  }

  // Kunden filtern
  const customers = entries.entries
    .map(e => e.name.trim())
    .filter(n => n && !SKIP_NAMES.includes(n.toLowerCase()));

  // Duplikate entfernen
  const unique = [...new Set(customers)];

  if (unique.length === 0) {
    console.log('\n❌ Keine Kunden gefunden. Bitte prüfe ob das Kassenbuch geöffnet ist.');
    console.log('   Aktuelle Seite:', entries.url);
    console.log('\n   Navigiere manuell zum Kassenbuch und starte das Script erneut.\n');
    await browser.close();
    return;
  }

  console.log('\n📋 Kunden für Nachsorge (' + syncDate + '):\n');
  unique.forEach((name, i) => console.log('   ' + (i + 1) + '. ' + name));

  // In Firebase speichern via Browser
  console.log('\n☁️  Speichere in Firebase...\n');

  const saved = await page.evaluate(async ({ customers, date, config }) => {
    // Firebase SDK laden
    if (!window._firebaseLoaded) {
      await new Promise((resolve) => {
        const s1 = document.createElement('script');
        s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
        s1.onload = () => {
          const s2 = document.createElement('script');
          s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
          s2.onload = () => { window._firebaseLoaded = true; resolve(); };
          document.head.appendChild(s2);
        };
        document.head.appendChild(s1);
      });
    }

    // Firebase initialisieren
    let app;
    try { app = firebase.app('sync'); } catch {
      app = firebase.initializeApp(config, 'sync');
    }
    const db = app.firestore();

    // Prüfen welche Kunden schon eingetragen sind
    const existing = await db.collection('client_visits')
      .where('date', '==', date)
      .get();

    const existingNames = new Set();
    existing.forEach(doc => existingNames.add(doc.data().name));

    let count = 0;
    for (const name of customers) {
      if (existingNames.has(name)) {
        continue; // Bereits eingetragen
      }
      await db.collection('client_visits').add({
        name: name,
        date: date,
        treatment: 'Behandlung',
        therapist: 'Tamara',
        phone: '',
        notes: '',
        contacted: false,
        source: 'treatwell-sync',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      count++;
    }

    return { saved: count, skipped: customers.length - count };
  }, { customers: unique, date: syncDate, config: FIREBASE_CONFIG });

  console.log('✅ ' + saved.saved + ' Kunden in Nachsorge eingetragen');
  if (saved.skipped > 0) console.log('⏭️  ' + saved.skipped + ' bereits vorhanden (übersprungen)');

  // Session nochmal speichern
  await context.storageState({ path: SESSION_FILE });

  console.log('\n🎉 Fertig! Die Kunden erscheinen jetzt in der Kundenkartei-Nachsorge.');
  console.log('   Öffne: https://skinconcept-hagner.github.io/skinconcept-dashboard/kundenkartei.html\n');

  // Browser schließen nach 5 Sekunden
  await page.waitForTimeout(5000);
  await browser.close();
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
}

main().catch(err => {
  console.error('\n❌ Fehler:', err.message);
  process.exit(1);
});
