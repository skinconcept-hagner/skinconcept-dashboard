/**
 * Debug: Google Kalender HTML-Struktur untersuchen
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '.google-session.json');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined
  });
  const page = await context.newPage();

  console.log('Öffne Google Kalender Dezember 2025...');
  await page.goto('https://calendar.google.com/calendar/r/month/2025/12/1', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  // Warte bis Kalender geladen
  await page.waitForTimeout(5000);

  // Screenshot
  await page.screenshot({ path: path.join(__dirname, 'kalender-debug.png'), fullPage: true });
  console.log('Screenshot gespeichert: kalender-debug.png');

  // HTML der Kalender-Grid-Zellen auslesen
  const debug = await page.evaluate(() => {
    const info = { eventTexts: [], chipTexts: [], ariaLabels: [], allClasses: new Set() };

    // Alle Elemente mit Event-bezogenen Klassen oder Attributen
    document.querySelectorAll('[data-eventid]').forEach(el => {
      info.eventTexts.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 100), classes: el.className });
    });

    // Event chips (Google Calendar spezifisch)
    document.querySelectorAll('[data-eventchip]').forEach(el => {
      info.chipTexts.push(el.textContent.trim().substring(0, 100));
    });

    // Alle Elemente in den Kalender-Zellen
    const gridCells = document.querySelectorAll('[role="gridcell"], [data-datekey], .KKjvXb, .KF4T6b');
    gridCells.forEach(cell => {
      const events = cell.querySelectorAll('*');
      events.forEach(el => {
        if (el.className) info.allClasses.add(String(el.className).split(' ')[0]);
      });
    });

    // Versuche Event-Container zu finden
    const containers = document.querySelectorAll('.NlL62b, .FAxxKc, .WBi6oc, .oKALsd, .gVNoLb');
    containers.forEach(el => {
      info.eventTexts.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 100), classes: el.className.substring(0, 50) });
    });

    // Suche nach jeglichen Elementen die Uhrzeiten enthalten (typisch für Termine)
    const allElements = document.querySelectorAll('*');
    const timePattern = /\d{1,2}:\d{2}/;
    let timeElements = 0;
    allElements.forEach(el => {
      if (el.children.length === 0 && el.textContent.match(timePattern)) {
        timeElements++;
        if (timeElements <= 20) {
          info.eventTexts.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 150), classes: (el.className || '').substring(0, 50), parent: (el.parentElement?.className || '').substring(0, 50) });
        }
      }
    });

    info.allClasses = [...info.allClasses].slice(0, 30);
    return info;
  });

  console.log('\n=== EVENT TEXTS ===');
  debug.eventTexts.slice(0, 20).forEach(e => console.log(`  [${e.tag}] ${e.text} | class: ${e.classes} | parent: ${e.parent || ''}`));

  console.log('\n=== CHIP TEXTS ===');
  debug.chipTexts.slice(0, 20).forEach(t => console.log('  ', t));

  console.log('\n=== CSS CLASSES ===');
  debug.allClasses.forEach(c => console.log('  ', c));

  console.log('\nBrowser bleibt 30 Sek offen...');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(err => { console.error('Fehler:', err.message); process.exit(1); });
