/**
 * Push April-Besuche aus Kassenbuch-Screenshots in Firebase Nachsorge
 */
import { chromium } from 'playwright';

const VISITS = [
  // 01.04.2026
  {name:'Sarah Conen', date:'2026-04-01'},
  {name:'Orsanna Dreweling', date:'2026-04-01'},
  {name:'Birgit Blescus', date:'2026-04-01'},
  {name:'Olga Resch', date:'2026-04-01'},
  {name:'Elena Stoll', date:'2026-04-01'},
  {name:'Lisa Joy Pisharek', date:'2026-04-01'},
  {name:'Steffi Mettler-tezlaff', date:'2026-04-01'},
  // 13.04.2026
  {name:'Sabrina Gabriel', date:'2026-04-13'},
  {name:'Katrin Schneider', date:'2026-04-13'},
  {name:'Anna-Lena Kessler', date:'2026-04-13'},
  {name:'Danica Faber', date:'2026-04-13'},
  {name:'Verena Ludwig', date:'2026-04-13'},
  {name:'Julia Kaiser', date:'2026-04-13'},
];

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAdGdgPnS3Cw3Rpiubx6_s61FyfiTQxfFc",
  authDomain: "skinconcept-tool.firebaseapp.com",
  projectId: "skinconcept-tool",
  storageBucket: "skinconcept-tool.firebasestorage.app",
  messagingSenderId: "188823880943",
  appId: "1:188823880943:web:ae87750be002cbe491071a"
};

async function main() {
  console.log('Starte Browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');

  console.log('Lade Firebase...');
  const result = await page.evaluate(async ({ visits, config }) => {
    // Firebase SDK laden
    await new Promise(resolve => {
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
        s2.onload = resolve;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });

    const app = firebase.initializeApp(config);
    const db = app.firestore();

    // Prüfen was schon existiert
    const existing = await db.collection('client_visits')
      .where('date', '>=', '2026-04-01')
      .get();
    const existingSet = new Set();
    existing.forEach(doc => {
      const d = doc.data();
      existingSet.add(d.name + '|' + d.date);
    });

    let saved = 0, skipped = 0;
    for (const v of visits) {
      const key = v.name + '|' + v.date;
      if (existingSet.has(key)) { skipped++; continue; }
      await db.collection('client_visits').add({
        name: v.name,
        date: v.date,
        treatment: 'Behandlung',
        therapist: 'Tamara',
        phone: '',
        notes: '',
        contacted: false,
        source: 'kassenbuch-april',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      saved++;
    }
    return { saved, skipped };
  }, { visits: VISITS, config: FIREBASE_CONFIG });

  console.log('✅ ' + result.saved + ' Besuche eingetragen');
  if (result.skipped > 0) console.log('⏭️  ' + result.skipped + ' bereits vorhanden');
  console.log('\nFertig! Öffne die Kundenkartei um die Nachsorge zu sehen.');
  await browser.close();
}

main().catch(err => { console.error('Fehler:', err.message); process.exit(1); });
