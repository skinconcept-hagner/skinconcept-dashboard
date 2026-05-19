// ============================================
// SKINCONCEPT - Login-Gate (Client-seitig)
// ============================================
// Verlangt Login bevor irgendwas gerendert wird.
// PIN wird client-seitig geprueft (SHA-256).
// Session bleibt 30 Tage im localStorage.
// ============================================

(function () {
  const SESSION_KEY = 'skinconcept_session_v1';
  const SESSION_DAYS = 30;

  // PINs (direkter Vergleich - Client-Side-Security ist eh nur Obscurity)
  const USERS = [
    { id: 'tamara', label: 'Tamara', pin: '1403' },
    { id: 'elena',  label: 'Elena',  pin: '2503' }
  ];

  // Inhalt sofort verstecken
  document.documentElement.style.visibility = 'hidden';

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.user || !s.expires) return null;
      if (Date.now() > s.expires) return null;
      return s;
    } catch (e) { return null; }
  }

  function writeSession(userId) {
    const s = { user: userId, expires: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function injectStyles() {
    if (document.getElementById('sc-auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'sc-auth-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
      #sc-auth-overlay{position:fixed;inset:0;z-index:2147483647;background:linear-gradient(135deg,#F6F4F1 0%,#EDE9E4 100%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;visibility:visible !important}
      #sc-auth-overlay *{box-sizing:border-box}
      .sc-auth-card{max-width:400px;width:100%;background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(74,55,40,.15),0 4px 16px rgba(74,55,40,.08);padding:44px 32px;text-align:center}
      .sc-auth-brand{font-family:'Playfair Display',Georgia,serif;font-size:30px;color:#4A3728;letter-spacing:1.5px;margin-bottom:6px;font-weight:600}
      .sc-auth-sub{color:#9E9894;font-size:11px;margin-bottom:32px;letter-spacing:1.5px;text-transform:uppercase;font-weight:500}
      .sc-auth-userrow{display:flex;gap:10px;margin-bottom:22px}
      .sc-auth-userbtn{flex:1;padding:16px 8px;border:2px solid rgba(107,83,68,.14);background:#FDFCFB;border-radius:14px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#2C2420;transition:all .2s;min-height:60px;-webkit-tap-highlight-color:transparent}
      .sc-auth-userbtn:hover{border-color:#C4A265;background:rgba(196,162,101,.08)}
      .sc-auth-userbtn.active{border-color:#C4A265;background:rgba(196,162,101,.18);color:#4A3728}
      .sc-auth-pinrow{display:flex;gap:10px;justify-content:center;margin-bottom:18px}
      .sc-auth-pin{width:58px;height:66px;border:2px solid rgba(107,83,68,.14);border-radius:14px;text-align:center;font-size:28px;font-weight:600;color:#2C2420;background:#FDFCFB;font-family:inherit;-webkit-appearance:none;appearance:none}
      .sc-auth-pin:focus{outline:none;border-color:#C4A265;background:#fff;box-shadow:0 0 0 3px rgba(196,162,101,.15)}
      .sc-auth-pin.error{border-color:#C0544F;background:#FDF0EF;animation:scShake .35s}
      @keyframes scShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
      .sc-auth-msg{min-height:20px;color:#C0544F;font-size:13px;margin-bottom:14px;font-weight:500}
      .sc-auth-msg.info{color:#4A7FB5}
      .sc-auth-submit{width:100%;background:#4A3728;color:#fff;border:none;padding:15px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;min-height:54px;transition:all .2s;letter-spacing:.3px}
      .sc-auth-submit:hover{background:#6B5344}
      .sc-auth-submit:disabled{opacity:.5;cursor:not-allowed}
      .sc-auth-hint{margin-top:18px;font-size:11px;color:#9E9894;letter-spacing:.3px}
      .sc-auth-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:scSpin .7s linear infinite;vertical-align:middle;margin-right:8px}
      @keyframes scSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function buildLoginUI() {
    injectStyles();
    let overlay = document.getElementById('sc-auth-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'sc-auth-overlay';
    overlay.innerHTML =
      '<div class="sc-auth-card">' +
        '<div class="sc-auth-brand">SKINCONCEPT</div>' +
        '<div class="sc-auth-sub">Studio Hub</div>' +
        '<div class="sc-auth-userrow">' +
          USERS.map(u => '<button type="button" class="sc-auth-userbtn" data-user="' + u.id + '">' + u.label + '</button>').join('') +
        '</div>' +
        '<div class="sc-auth-pinrow">' +
          '<input type="tel" maxlength="1" class="sc-auth-pin" inputmode="numeric" autocomplete="off" data-i="0">' +
          '<input type="tel" maxlength="1" class="sc-auth-pin" inputmode="numeric" autocomplete="off" data-i="1">' +
          '<input type="tel" maxlength="1" class="sc-auth-pin" inputmode="numeric" autocomplete="off" data-i="2">' +
          '<input type="tel" maxlength="1" class="sc-auth-pin" inputmode="numeric" autocomplete="off" data-i="3">' +
        '</div>' +
        '<div class="sc-auth-msg" id="sc-auth-msg"></div>' +
        '<button type="button" class="sc-auth-submit" id="sc-auth-submit">Anmelden</button>' +
        '<div class="sc-auth-hint">4-stelliger PIN &middot; 30 Tage eingeloggt</div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function showLogin() {
    const overlay = buildLoginUI();
    let selectedUser = null;
    const userBtns = overlay.querySelectorAll('.sc-auth-userbtn');
    const pinInputs = overlay.querySelectorAll('.sc-auth-pin');
    const submitBtn = overlay.querySelector('#sc-auth-submit');
    const msg = overlay.querySelector('#sc-auth-msg');

    userBtns.forEach(b => b.addEventListener('click', () => {
      userBtns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedUser = b.dataset.user;
      pinInputs[0].focus();
    }));

    pinInputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
        if (inp.value && i < 3) pinInputs[i + 1].focus();
        if (inp.value && i === 3) tryLogin();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) pinInputs[i - 1].focus();
        if (e.key === 'Enter') tryLogin();
      });
    });

    submitBtn.addEventListener('click', tryLogin);
    setTimeout(() => userBtns[0].focus(), 50);

    function setMsg(text, type) {
      msg.textContent = text || '';
      msg.className = 'sc-auth-msg' + (type ? ' ' + type : '');
    }

    function tryLogin() {
      setMsg('');
      pinInputs.forEach(p => p.classList.remove('error'));
      if (!selectedUser) { setMsg('Bitte Nutzer waehlen'); return; }
      const pin = Array.from(pinInputs).map(p => p.value).join('');
      if (pin.length !== 4) { setMsg('PIN unvollstaendig'); return; }

      const userObj = USERS.find(u => u.id === selectedUser);
      if (userObj && pin === userObj.pin) {
        writeSession(userObj.id);
        revealPage(userObj.id);
        return;
      }

      setMsg('Falscher PIN');
      pinInputs.forEach(p => { p.classList.add('error'); p.value = ''; });
      pinInputs[0].focus();
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById('sc-auth-overlay');
    if (overlay) overlay.remove();
  }

  function revealPage(userId) {
    removeOverlay();
    document.documentElement.style.visibility = '';
    window.scCurrentUser = function () { return userId; };
    window.scLogout = function () {
      clearSession();
      location.reload();
    };
    try { window.dispatchEvent(new CustomEvent('sc:login', { detail: { user: userId } })); } catch (e) {}
  }

  function init() {
    const session = readSession();
    if (session) {
      if (document.body) revealPage(session.user);
      else document.addEventListener('DOMContentLoaded', () => revealPage(session.user));
      return;
    }
    if (document.body) showLogin();
    else document.addEventListener('DOMContentLoaded', showLogin);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
