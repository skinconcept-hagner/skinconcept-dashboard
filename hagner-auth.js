// ════════════════════════════════════════════════════════════════
// hagner-auth.js — Studio-Login fuer die RTDB-App (skinconcept-hagner)
// ════════════════════════════════════════════════════════════════
// Gegenstueck zu shared.js (das den Studio-Login fuer skinconcept-TOOL
// macht). Diese Datei meldet das Dashboard beim Projekt skinconcept-HAGNER
// an — damit die gehaerteten RTDB-Regeln (CRM-Tresor = nur Studio-E-Mail,
// R2 in database.rules.STAGE.json) greifen koennen.
//
// Bei geschützten Kartei-Seiten wird die Anmeldung mit `{ required: true }`
// aufgerufen. Dann werden keine RTDB-Daten geladen, bevor die Anmeldung steht.
//
// VORAUSSETZUNG zum Aktivieren (Konsole, einmalig durch Tamara):
//   1. skinconcept-hagner → Authentication → Get Started
//   2. Sign-in method → E-Mail/Passwort aktivieren
//   3. Users → Nutzer skinconcept.hagner@gmail.com anlegen (+ Passwort)
// Danach meldet man sich EINMAL pro Geraet an (LOCAL-Persistenz merkt es).
//
// VERWENDUNG (im spaeteren, getesteten Wiring-Pass):
//   await scEnsureHagnerAuth();   // vor den ersten Vault-/Kartei-Reads
// ════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var STUDIO_EMAIL = 'skinconcept.hagner@gmail.com';
  var HAGNER_PROJECT = 'skinconcept-hagner';
  var HAGNER_DB = 'https://skinconcept-hagner-default-rtdb.europe-west1.firebasedatabase.app';
  var authSdkPromise = null;
  var hagnerAuthPromise = null;
  var verifiedStudioUid = null;

  if (!global.scRequestStudioPasswordReset) {
    global.scRequestStudioPasswordReset = function (system) {
      return fetch('https://skinconcept-office.vercel.app/api/auth/studio-password-reset', {
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

  // Findet die bereits initialisierte -hagner-App (egal wie sie heisst),
  // sonst legt sie eine an. Jede Dashboard-Seite initialisiert -hagner selbst;
  // wir greifen nur darauf zu.
  function hagnerApp() {
    try {
      var apps = firebase.apps || [];
      for (var i = 0; i < apps.length; i++) {
        var o = apps[i].options || {};
        if (o.projectId === HAGNER_PROJECT || o.databaseURL === HAGNER_DB) return apps[i];
      }
    } catch (e) {}
    try {
      return firebase.initializeApp({
        apiKey: 'AIzaSyDyxq-F6EcmM9lxMihK_QI3eDxC7zNUnNs',
        authDomain: 'skinconcept-hagner.firebaseapp.com',
        databaseURL: HAGNER_DB,
        projectId: HAGNER_PROJECT
      }, 'hagner-auth');
    } catch (e) { return null; }
  }

  // Auth-SDK sicherstellen (manche Seiten laden es nicht).
  function loadAuthSdk() {
    if (global.firebase && firebase.auth) return Promise.resolve();
    if (authSdkPromise) return authSdkPromise;
    authSdkPromise = new Promise(function (resolve, reject) {
      if (global.firebase && firebase.auth) { resolve(); return; }
      var ver = (global.firebase && firebase.SDK_VERSION) || '9.23.0';
      var compat = ver.charAt(0) >= '9' ? '-compat' : '';
      var s = document.createElement('script');
      s.src = 'https://www.gstatic.com/firebasejs/' + ver + '/firebase-auth' + compat + '.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('auth-sdk')); };
      document.head.appendChild(s);
    });
    return authSdkPromise.then(function (value) {
      return value;
    }, function (error) {
      authSdkPromise = null;
      throw error;
    });
  }

  function hagnerStudioReady() {
    try {
      var app = hagnerApp();
      var u = app && app.auth && app.auth().currentUser;
      return !!(u && (u.email === STUDIO_EMAIL || u.uid === verifiedStudioUid));
    } catch (e) { return false; }
  }

  function hasStudioAccess(user) {
    if (!user) return Promise.resolve(false);
    if (user.email === STUDIO_EMAIL) {
      verifiedStudioUid = user.uid;
      return Promise.resolve(true);
    }
    if (!user.getIdTokenResult) return Promise.resolve(false);
    return user.getIdTokenResult().then(function (result) {
      var allowed = !!(result && result.claims && result.claims.studio === true);
      if (allowed) verifiedStudioUid = user.uid;
      return allowed;
    }).catch(function () { return false; });
  }

  // Stellt eine Studio-Anmeldung auf -hagner sicher. Bei `required: true`
  // gibt es keinen unsicheren "Später"-Pfad.
  function scEnsureHagnerAuth(options) {
    var required = !!(options && options.required);
    if (hagnerStudioReady()) return Promise.resolve(true);
    if (hagnerAuthPromise) return hagnerAuthPromise;

    hagnerAuthPromise = loadAuthSdk().then(function () {
      var app = hagnerApp();
      if (!app) return false;
      try { app.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
      return new Promise(function (resolve) {
        var settled = false;
        var loginShown = false;
        var unsub = app.auth().onAuthStateChanged(function (u) {
          if (settled) return;
          hasStudioAccess(u).then(function (allowed) {
            if (settled) return;
            if (allowed) {
              settled = true;
              try { unsub(); } catch (e) {}
              resolve(true);
              return;
            }
            if (!loginShown) {
              loginShown = true;
              showHagnerLogin(app, function (value) {
                settled = true;
                try { unsub(); } catch (e) {}
                resolve(value);
              }, required);
            }
          });
        });
      });
    }).catch(function () { return false; });
    hagnerAuthPromise = hagnerAuthPromise.then(function (value) {
      hagnerAuthPromise = null;
      return value;
    }, function (error) {
      hagnerAuthPromise = null;
      throw error;
    });
    return hagnerAuthPromise;
  }
  global.scEnsureHagnerAuth = scEnsureHagnerAuth;
  global.scHagnerReady = hagnerStudioReady;

  function showHagnerLogin(app, resolve, required) {
    if (document.getElementById('scHagnerLoginOverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'scHagnerLoginOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:linear-gradient(135deg,rgba(74,55,40,.55),rgba(44,36,32,.6));display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:36px 30px;text-align:center;box-shadow:0 24px 70px rgba(20,16,12,.35)">'
      + '<div style="font-size:26px;color:#4A3728;letter-spacing:1.2px;font-weight:600">Skinconcept</div>'
      + '<div style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#9E9894;margin-top:6px;font-weight:600">Kartei-Anmeldung</div>'
      + '<p style="color:#9E9894;font-size:12.5px;margin:18px 0 16px;line-height:1.5">Einmalig pro Ger&auml;t &middot; dein Studio-Passwort.<br>Sch&uuml;tzt die Kundenkartei (CRM-Tresor).</p>'
      + '<input id="scHagnerPw" type="password" autocomplete="current-password" placeholder="Passwort" style="width:100%;padding:13px;border:1.5px solid rgba(107,83,68,.18);border-radius:12px;font-size:15px;text-align:center;box-sizing:border-box;font-family:inherit">'
      + '<div id="scHagnerErr" style="color:#C0544F;font-size:12px;margin-top:9px;display:none">Passwort falsch</div>'
      + '<div id="scHagnerMsg" style="color:#2e7d32;font-size:12px;margin-top:9px;display:none;line-height:1.5"></div>'
      + '<button id="scHagnerBtn" style="width:100%;margin-top:15px;background:#4A3728;color:#fff;border:none;padding:14px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer">Anmelden</button>'
      + '<button id="scHagnerReset" style="width:100%;margin-top:11px;background:none;border:0;color:#9E9894;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit">Passwort vergessen?</button>'
      + (required ? '' : '<button id="scHagnerLater" style="width:100%;margin-top:5px;background:none;border:0;color:#B8B2AD;font-size:12px;cursor:pointer;font-family:inherit">Sp&auml;ter</button>')
      + '</div>';
    document.body.appendChild(ov);
    var pw = ov.querySelector('#scHagnerPw'), err = ov.querySelector('#scHagnerErr'), msg = ov.querySelector('#scHagnerMsg'),
        btn = ov.querySelector('#scHagnerBtn'), resetBtn = ov.querySelector('#scHagnerReset');
    try { pw.focus(); } catch (e) {}
    function done(val) { ov.remove(); resolve(val); }
    function doLogin() {
      var p = pw.value; if (!p) return;
      err.style.display = 'none'; btn.disabled = true; btn.textContent = 'Anmelden…';
      app.auth().signInWithEmailAndPassword(STUDIO_EMAIL, p)
        .then(function () { done(true); })
        .catch(function (e) {
          err.textContent = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') ? 'Passwort falsch' : 'Anmeldung fehlgeschlagen';
          err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Anmelden';
        });
    }
    btn.addEventListener('click', doLogin);
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    resetBtn.addEventListener('click', function () {
      err.style.display = 'none'; msg.style.display = 'none'; resetBtn.disabled = true; resetBtn.textContent = 'Sende Link…';
      global.scRequestStudioPasswordReset('kartei')
        .then(function (result) {
          msg.innerHTML = result.sent === false
            ? 'Eine Reset-Mail wurde bereits vor Kurzem gesendet. Bitte den <b>Posteingang</b> pr&uuml;fen.'
            : 'Neue Reset-Mail von <b>Skinconcept Hagner</b> gesendet. Bitte den <b>Posteingang</b> pr&uuml;fen.';
          msg.style.display = 'block'; resetBtn.style.display = 'none';
        })
        .catch(function (e) { err.textContent = 'Konnte Reset-Mail nicht senden: ' + ((e && e.message) || ''); err.style.display = 'block'; resetBtn.disabled = false; resetBtn.textContent = 'Passwort vergessen?'; });
    });
    var laterBtn = ov.querySelector('#scHagnerLater');
    if (laterBtn) laterBtn.addEventListener('click', function () { done(false); });
  }
})(window);
