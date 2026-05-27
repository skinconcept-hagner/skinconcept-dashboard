/**
 * SKINCONCEPT — Treatwell → Firestore Sync (Stealth-Variante)
 *
 * Liest automatisch Termine/Kunden aus dem Treatwell-Backend
 * (connect.treatwell.de) und schreibt sie in Firestore
 * (Projekt skinconcept-tool, Collection client_visits).
 *
 * Login einmalig manuell, danach persistenter Browser-Context
 * mit Stealth-Plugin (umgeht Bot-Detection von Treatwell).
 *
 * Aufruf interaktiv:    node treatwell-sync.mjs
 * Aufruf headless/auto: node treatwell-sync.mjs --auto
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

chromium.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.treatwell-profile');
const LOG_DIR = path.join(__dirname, 'sync-logs');
const SCREENSHOT_DIR = path.join(__dirname, 'sync-screenshots');

const AUTO_MODE = process.argv.includes('--auto');

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdGdgPnS3Cw3Rpiubx6_s61FyfiTQxfFc',
  projectId: 'skinconcept-tool'
};

const SKIP_NAMES = ['laufkundschaft', 'treatwell support', 'test', 'barverkauf', ''];

const TREATWELL_BASE = 'https://connect.treatwell.de';
const KASSENBUCH_CANDIDATES = [
  '/calendar',
  '/agenda',
  '/reports',
  '/cashbook',
  '/transactions',
  '/pos/transactions',
  '/clients'
];

function log(...args) {
  console.log(...args);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
    const today = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(
      path.join(LOG_DIR, `sync-${today}.log`),
      `[${new Date().toISOString()}] ${args.join(' ')}\n`
    );
  } catch {}
}

async function ensureDirs() {
  for (const d of [PROFILE_DIR, LOG_DIR, SCREENSHOT_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

async function screenshot(page, name) {
  try {
    const file = path.join(SCREENSHOT_DIR, `${Date.now()}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    log(`   Screenshot: ${path.basename(file)}`);
  } catch (e) {
    log('   Screenshot fehlgeschlagen:', e.message);
  }
}

async function waitForLogin(page) {
  log('\nWarte auf erfolgreichen Login (max. 5 Min)...');
  log('Bitte logge dich im Browser-Fenster bei Treatwell ein.\n');
  const deadline = Date.now() + 5 * 60 * 1000;
  let lastUrl = '';
  let tick = 0;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url !== lastUrl) {
      log(`URL-Wechsel: ${url}`);
      lastUrl = url;
      await screenshot(page, `login-url-change-${tick}`);
    }
    if (
      url.includes(TREATWELL_BASE) &&
      !url.includes('/login') &&
      !url.includes('/auth') &&
      !url.includes('/sign')
    ) {
      log('Login erkannt – aktuelle URL:', url);
      await screenshot(page, 'login-success');
      await page.waitForTimeout(2000);
      return true;
    }
    // Periodischer Screenshot alle 5 Ticks (~10s)
    if (tick % 5 === 0) {
      await screenshot(page, `login-watch-${tick}`);
    }
    tick++;
    await page.waitForTimeout(2000);
  }
  return false;
}

async function waitForCloudflare(page) {
  // Cloudflare Turnstile / "Verifiziere..." Widget — wir warten geduldig
  log('Prüfe auf Cloudflare-Verifikation...');
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const html = await page.content().catch(() => '');
    const lower = html.toLowerCase();
    const stillVerifying =
      lower.includes('verifiziere') ||
      lower.includes('verifying') ||
      (lower.includes('cloudflare') && lower.includes('challenge'));
    if (!stillVerifying) {
      log('Cloudflare durchgewunken.');
      return true;
    }
    await page.waitForTimeout(1500);
  }
  log('Cloudflare-Verifikation hat 30s+ gedauert — Screenshot zur Diagnose.');
  await screenshot(page, 'cloudflare-stuck');
  return false;
}

async function detectHardBlock(page) {
  // Echter Block (kein Cloudflare-Loading) — abgrenzbar an konkreten Strings
  const html = await page.content().catch(() => '');
  const lower = html.toLowerCase();
  const hardHints = [
    'access denied',
    'attention required',
    'sorry, you have been blocked',
    'unusual activity detected',
    'sie wurden blockiert',
    'ihre ip wurde gesperrt'
  ];
  const found = hardHints.find(h => lower.includes(h));
  if (found) {
    log(`HARTER Block erkannt: "${found}"`);
    await screenshot(page, 'hard-block');
    return true;
  }
  return false;
}

async function exploreAndDump(page) {
  log('\nErkundungs-Modus: dumpe aktuellen DOM und Links...');
  await screenshot(page, 'after-login');

  const info = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().slice(0, 50), href: a.href }))
      .filter(l => l.text && l.href.includes('treatwell'))
      .slice(0, 50);

    const navItems = Array.from(document.querySelectorAll('nav a, [role="navigation"] a, [class*="menu"] a, [class*="nav"] a'))
      .map(a => ({ text: a.textContent.trim().slice(0, 40), href: a.href }))
      .filter(l => l.text)
      .slice(0, 30);

    return { url: location.href, title: document.title, links, navItems };
  });

  log('Seite:', info.title, '@', info.url);
  log('\nNavigations-Punkte:');
  info.navItems.forEach(n => log(`   "${n.text}" -> ${n.href}`));

  const dumpFile = path.join(LOG_DIR, `dom-dump-${Date.now()}.json`);
  fs.writeFileSync(dumpFile, JSON.stringify(info, null, 2));
  log(`\nFull DOM-Dump: ${dumpFile}`);
  return info;
}

async function main() {
  log('\n=== Skinconcept Treatwell-Sync ===');
  log(`Mode: ${AUTO_MODE ? 'auto (headless)' : 'interaktiv'}`);
  log(`Profil: ${PROFILE_DIR}\n`);

  await ensureDirs();

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: AUTO_MODE,
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=ChromeWhatsNewUI,SyncSignInDialog'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = context.pages()[0] || (await context.newPage());

  log('Öffne Treatwell Connect...');
  await page.bringToFront().catch(() => {});
  await page.goto(TREATWELL_BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => {
    log('Navigation Warnung:', e.message);
  });
  await page.bringToFront().catch(() => {});

  await page.waitForTimeout(3000);
  await waitForCloudflare(page);

  if (await detectHardBlock(page)) {
    log('\nABBRUCH: Treatwell hat den Zugang hart blockiert.');
    log('Screenshot wurde gespeichert. Skript beendet sich, ohne Daten zu schreiben.');
    if (!AUTO_MODE) {
      log('Browser bleibt offen für Diagnose. Schließe das Fenster manuell.');
      await new Promise(() => {});
    } else {
      await context.close();
      process.exit(2);
    }
  }

  const currentUrl = page.url();
  const isLoginPage =
    currentUrl.includes('/login') ||
    currentUrl.includes('/auth') ||
    currentUrl.includes('/sign');

  if (isLoginPage) {
    if (AUTO_MODE) {
      log('\nABBRUCH: Login-Seite erschienen, aber im Auto-Modus kein User-Login möglich.');
      log('Bitte einmalig `node treatwell-sync.mjs` (ohne --auto) ausführen, damit die Session erneuert wird.');
      await context.close();
      process.exit(3);
    }
    const ok = await waitForLogin(page);
    if (!ok) {
      log('\nABBRUCH: Login innerhalb von 5 Min nicht erkannt.');
      await context.close();
      process.exit(4);
    }
  } else {
    log('Session aktiv, kein Login nötig.');
  }

  await page.waitForTimeout(2000);
  const info = await exploreAndDump(page);

  log('\n=== Phase 2 (Daten-Extraktion) folgt im nächsten Schritt ===');
  log('Erkennung der Termin-Seite und Selektoren wird live abgestimmt.');

  if (!AUTO_MODE) {
    log('\nBrowser bleibt offen, damit Tamara durch die UI klicken kann.');
    log('Sobald die richtige Seite (Kalender/Tagesliste) angezeigt ist, melde dich im Chat.');
    await new Promise(() => {});
  }

  await context.close();
}

main().catch(err => {
  log('\nFehler:', err.stack || err.message);
  process.exit(1);
});
