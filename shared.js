// ============================================
// Skinconcept DASHBOARD — Shared Module
// ============================================

// ============ FIREBASE ============
firebase.initializeApp({
    apiKey: "AIzaSyAdGdgPnS3Cw3Rpiubx6_s61FyfiTQxfFc",
    authDomain: "skinconcept-tool.firebaseapp.com",
    projectId: "skinconcept-tool",
    storageBucket: "skinconcept-tool.firebasestorage.app",
    messagingSenderId: "188823880943",
    appId: "1:188823880943:web:ae87750be002cbe491071a"
});
const db = firebase.firestore();

// ============ STUDIO-FIREBASE-ANMELDUNG (Security-Foundation) ============
// Baut eine ECHTE Firebase-Anmeldung auf dem Studio-Konto auf, damit die
// Firestore-Rules schrittweise von "if true" auf "nur Studio" umgestellt
// werden koennen. Solange die Rules noch offen sind, ist das unkritisch:
// klickt man "Spaeter", funktioniert alles weiter (nichts wird blockiert).
// Einmal pro Geraet — Firebase merkt sich die Anmeldung (LOCAL-Persistenz).
const STUDIO_EMAIL = 'skinconcept.hagner@gmail.com';
const STUDIO_RESET_API = 'https://skinconcept-office.vercel.app/api/auth/studio-password-reset';
let scAuthSdkPromise = null;
let scStudioAuthPromise = null;

// Passwort-Mails laufen ueber den verifizierten Skinconcept-SMTP-Versand.
// Der Server akzeptiert nur die feste Studio-Adresse und die beiden bekannten
// Systeme; eine frei eingebbare Empfaenger-Adresse gibt es bewusst nicht.
if (!window.scRequestStudioPasswordReset) {
  window.scRequestStudioPasswordReset = function (system) {
    return fetch(STUDIO_RESET_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: system })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'Passwort-Mail konnte nicht versendet werden');
        return data;
      });
    });
  };
}

// Das Auth-SDK ist auf den Seiten (noch) nicht eingebunden — dynamisch laden.
function scLoadAuthSdk() {
  if (firebase.auth) return Promise.resolve();
  if (scAuthSdkPromise) return scAuthSdkPromise;

  scAuthSdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('auth-sdk'));
    document.head.appendChild(s);
  });
  return scAuthSdkPromise.then(
    value => value,
    error => { scAuthSdkPromise = null; throw error; }
  );
}

function scStudioReady() {
  try {
    const u = firebase.auth && firebase.auth().currentUser;
    return !!(u && u.email === STUDIO_EMAIL);
  } catch (e) { return false; }
}

// Stellt sicher, dass eine Studio-Anmeldung besteht. Gibt true/false zurueck.
// Blockiert NICHTS: bei "Spaeter" oder Fehler wird false geliefert und die
// Seite laeuft (dank offener Rules) normal weiter.
function scEnsureStudioAuth(options) {
  const required = !!(options && options.required);
  if (scStudioReady()) return Promise.resolve(true);
  if (scStudioAuthPromise) return scStudioAuthPromise;

  scStudioAuthPromise = scLoadAuthSdk().then(() => {
    try { firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    return new Promise((resolve) => {
      if (scStudioReady()) { resolve(true); return; }
      let settled = false;
      const unsub = firebase.auth().onAuthStateChanged((u) => {
        if (settled) return; settled = true; unsub();
        if (u && u.email === STUDIO_EMAIL) resolve(true);
        else scShowStudioLogin(resolve, required);
      });
    });
  }).catch(() => false);

  // Auto-Anstoss und Seiten-Init muessen dieselbe laufende Anmeldung teilen.
  // Ohne diese Sperre konnte der zweite Aufruf wegen des bereits sichtbaren
  // Modals sofort false liefern und geschuetzte Abfragen zu frueh starten.
  scStudioAuthPromise = scStudioAuthPromise.then(
    value => { scStudioAuthPromise = null; return value; },
    error => { scStudioAuthPromise = null; throw error; }
  );
  return scStudioAuthPromise;
}
window.scEnsureStudioAuth = scEnsureStudioAuth;
window.scStudioReady = scStudioReady;

function scShowStudioLogin(resolve, required) {
  if (document.getElementById('scStudioLoginOverlay')) { resolve(false); return; }
  const ov = document.createElement('div');
  ov.id = 'scStudioLoginOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:linear-gradient(135deg,rgba(74,55,40,.55),rgba(44,36,32,.6));display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:36px 30px;text-align:center;box-shadow:0 24px 70px rgba(20,16,12,.35)">'
    + '<div style="font-size:26px;color:#4A3728;letter-spacing:1.2px;font-weight:600">Skinconcept</div>'
    + '<div style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#9E9894;margin-top:6px;font-weight:600">Studio-Anmeldung</div>'
    + '<p style="color:#9E9894;font-size:12.5px;margin:18px 0 16px;line-height:1.5">Einmalig pro Ger&auml;t &middot; dein Studio-Passwort.<br>' + (required ? 'Anmeldung erforderlich, um diese Daten zu laden.' : 'Sch&uuml;tzt Kundinnen- und Studio-Daten.') + '</p>'
    + '<input id="scStudioPw" type="password" autocomplete="current-password" placeholder="Passwort" style="width:100%;padding:13px;border:1.5px solid rgba(107,83,68,.18);border-radius:12px;font-size:15px;text-align:center;box-sizing:border-box;font-family:inherit">'
    + '<div id="scStudioErr" style="color:#C0544F;font-size:12px;margin-top:9px;display:none">Passwort falsch</div>'
    + '<div id="scStudioMsg" style="color:#2e7d32;font-size:12px;margin-top:9px;display:none;line-height:1.5"></div>'
    + '<button id="scStudioBtn" style="width:100%;margin-top:15px;background:#4A3728;color:#fff;border:none;padding:14px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">Anmelden</button>'
    + '<button id="scStudioReset" style="width:100%;margin-top:11px;background:none;border:0;color:#9E9894;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit">Passwort vergessen?</button>'
    + '<button id="scStudioLater" style="width:100%;margin-top:5px;background:none;border:0;color:#B8B2AD;font-size:12px;cursor:pointer;font-family:inherit">Sp&auml;ter</button>'
    + '</div>';
  document.body.appendChild(ov);
  const pw = ov.querySelector('#scStudioPw'), err = ov.querySelector('#scStudioErr'), msg = ov.querySelector('#scStudioMsg'),
        btn = ov.querySelector('#scStudioBtn'), resetBtn = ov.querySelector('#scStudioReset');
  try { pw.focus(); } catch (e) {}
  function close(val) { ov.remove(); resolve(val); }
  function doLogin() {
    const p = pw.value; if (!p) return;
    err.style.display = 'none'; btn.disabled = true; btn.textContent = 'Anmelden…';
    firebase.auth().signInWithEmailAndPassword(STUDIO_EMAIL, p)
      .then(() => close(true))
      .catch((e) => {
        err.textContent = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') ? 'Passwort falsch' : 'Anmeldung fehlgeschlagen';
        err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Anmelden';
      });
  }
  btn.addEventListener('click', doLogin);
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  resetBtn.addEventListener('click', () => {
    err.style.display = 'none'; msg.style.display = 'none'; resetBtn.disabled = true; resetBtn.textContent = 'Sende Link…';
    window.scRequestStudioPasswordReset('office')
      .then((result) => {
        msg.innerHTML = result.sent === false
          ? 'Eine Reset-Mail wurde bereits vor Kurzem gesendet. Bitte den <b>Posteingang</b> pr&uuml;fen.'
          : 'Neue Reset-Mail von <b>Skinconcept Hagner</b> gesendet. Bitte den <b>Posteingang</b> pr&uuml;fen und danach hier anmelden.';
        msg.style.display = 'block'; resetBtn.style.display = 'none';
      })
      .catch((e) => { err.textContent = 'Konnte Reset-Mail nicht senden: ' + ((e && e.message) || ''); err.style.display = 'block'; resetBtn.disabled = false; resetBtn.textContent = 'Passwort vergessen?'; });
  });
  const laterBtn = ov.querySelector('#scStudioLater');
  if (required) laterBtn.remove();
  else laterBtn.addEventListener('click', () => close(false));
}

// Jede interne Seite startet die Anmeldung in ihrem eigenen Init und wartet
// dort darauf. So beginnen Firebase-Abfragen garantiert nicht vor der Auth.

// ============ NAVIGATION ============
// Premium SVG-Icons (Lucide-style, stroke 1.5) — keine Emojis im UI.
const ICON_SVG = {
    home:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    office:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
    tasks:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    kartei:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>',
    crm:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    voucher:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>',
    invoice:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    chart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    cart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
    coins:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M18.09 10.37A6 6 0 1 1 10.34 18"></path><path d="M7 6h1v4"></path><path d="m16.71 13.88.7.71-2.82 2.82"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    tag:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
    phone:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
};

const NAV_ITEMS = [
    { href: 'index.html',           icon: 'home',    label: 'Übersicht' },
    { href: 'https://skinconcept-office.vercel.app', icon: 'office', label: 'Office', external: true },
    { href: 'aufgaben.html',        icon: 'tasks',   label: 'Aufgaben' },
    { href: 'kundenkartei.html',    icon: 'kartei',  label: 'Kundenkartei' },
    { href: 'crm.html',             icon: 'crm',     label: 'CRM' },
    { href: 'gutscheine.html',      icon: 'voucher', label: 'Gutscheine' },
    { href: 'https://skinconcept-office.vercel.app/rechnungen', icon: 'invoice', label: 'Rechnungen', external: true },
    { href: 'preislisten.html',     icon: 'tag',     label: 'Preisliste' },
    { href: 'hautapp.html',         icon: 'phone',   label: 'HautApp' },
    { href: 'https://skinconcept-ai-command-center.vercel.app', icon: 'chart', label: 'AI Team', external: true },
];

function initNavigation() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    sidebar.innerHTML = `
        <div class="sidebar-brand">
            <h1>Skinconcept</h1>
            <span>Studio</span>
        </div>
        <nav class="sidebar-nav">
            ${NAV_ITEMS.map(item => `
                <a href="${item.href}" ${item.external ? 'target="_blank" rel="noopener"' : ''} class="sidebar-link ${currentPage === item.href ? 'active' : ''}${item.external ? ' sidebar-link-external' : ''}">
                    <span class="icon">${ICON_SVG[item.icon] || ''}</span>
                    <span class="label">${item.label}</span>
                    ${item.external ? `<span class="ext-arrow">${ICON_SVG.external}</span>` : ''}
                </a>
            `).join('')}
        </nav>
        <div class="sidebar-footer">Skinconcept Hagner · Morbach</div>
    `;

    // Mobile menu
    const toggle = document.querySelector('.menu-toggle');
    const overlay = document.querySelector('.sidebar-overlay');
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = '') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ UTILITY FUNCTIONS ============
function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getMonthName(monthIndex) {
    const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    return months[monthIndex];
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get start of current week (Monday)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});
