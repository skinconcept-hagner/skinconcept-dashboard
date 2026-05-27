// ============================================
// HAUTANALYSE-MODUL — KI-Bericht-Generator
// 1-2 Sylton-Connect-Screenshots → Claude erkennt die 5 Modi selbst → PDF im Editorial-Stil → WhatsApp-Versand
// ============================================

// Storage-Cleanup: Wenn alte Berichte fette base64-Bilder gespeichert haben (Bug v23 und älter),
// schmeiß die raus damit localStorage nicht voll bleibt. Läuft einmal beim Laden.
(function cleanupOversizedSkinReports() {
  try {
    if (typeof loadKartei !== 'function' || typeof saveKartei !== 'function') return;
    const data = loadKartei();
    let changed = 0;
    for (const id in data) {
      const kd = data[id];
      if (!kd || !Array.isArray(kd.skinReports)) continue;
      for (const report of kd.skinReports) {
        if (report.screenshots || report.images) {
          delete report.screenshots;
          delete report.images;
          changed++;
        }
      }
    }
    if (changed > 0) {
      saveKartei(data);
      console.log('Storage-Cleanup: ' + changed + ' alte Hautanalyse-Berichte von schweren Bildern befreit (Storage entlastet).');
    }
  } catch (e) {
    console.warn('Storage-Cleanup Fehler:', e);
  }
})();

const OFFICE_API = 'https://skinconcept-office.vercel.app';
const SKIN_MODES = [
  { id: 'daylight',     label: 'Daylight',     short: 'Tageslicht' },
  { id: 'texture',      label: 'Texture',      short: 'Hautstruktur' },
  { id: 'pigmentation', label: 'Pigmentation', short: 'Pigmentierung' },
  { id: 'firmness',     label: 'Firmness',     short: 'Hautfestigkeit' },
  { id: 'redness',      label: 'Redness',      short: 'Rötungen' },
];
const MAX_SCREENSHOTS = 4; // i.d.R. reichen 1-2, mehr akzeptieren wir auch

// Zwischenspeicher: Array von Screenshots (jeder hat base64, dataUrl, mediaType)
let skinScreenshots = [];

function openSkinAnalysisModal() {
  if (!selectedClient) { toast('Kein Kunde ausgewählt', 'warn'); return; }
  skinScreenshots = [];
  renderSkinModal();
  openModal('skinAnalysisModal');
}

function renderSkinModal() {
  const c = selectedClient;
  const fn = (c.fn || (c.name || '').split(/\s+/)[0] || 'Kundin').trim();
  const fullName = (c.fn && c.ln) ? `${c.fn} ${c.ln}`.trim() : (c.name || 'Kundin');
  const anam = getAnamnese(c) || {};
  const anamSummary = summarizeAnamnese(anam);
  const count = skinScreenshots.length;
  const canGenerate = count >= 1;

  document.getElementById('skinAnalysisModalContent').innerHTML = `
    <button class="modal-close" onclick="closeModal('skinAnalysisModal')">&times;</button>
    <h2 style="margin-bottom:6px">Hautanalyse für ${esc(fn)}</h2>
    <p style="color:var(--muted);font-size:13px;margin-bottom:24px">
      Lade 1-2 Screenshots aus Sylton Connect hoch — auf denen alle 5 Lichtmodi (Daylight, Texture, Pigmentation, Firmness, Redness) sichtbar sind. Die KI erkennt die einzelnen Aufnahmen anhand der Labels und schreibt den Editorial-Bericht.
    </p>

    <div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Schritt 1 · Sylton-Screenshots hochladen (${count}/${MAX_SCREENSHOTS})</div>
      <div class="sa-screenshot-grid">
        ${skinScreenshots.map((s, i) => `
          <div class="sa-screenshot-slot filled">
            <img src="${s.dataUrl}" class="sa-screenshot-preview" alt="Screenshot ${i+1}">
            <button class="sa-upload-remove" onclick="removeSkinScreenshot(${i})" title="Entfernen">&times;</button>
            <div class="sa-upload-label">
              <div class="sa-upload-label-en">Screenshot ${i+1}</div>
            </div>
          </div>
        `).join('')}
        ${count < MAX_SCREENSHOTS ? `
          <div class="sa-screenshot-slot empty" onclick="document.getElementById('sa-input').click()">
            <input type="file" accept="image/*" id="sa-input" style="display:none" multiple onchange="handleSkinScreenshots(this.files)">
            <div class="sa-upload-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              <div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">Screenshot hinzufügen<br><span style="font-size:9px">oder per Drag-and-Drop</span></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Schritt 2 · Anamnese-Daten (werden automatisch verwendet)</div>
      <details>
        <summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
          ${anamSummary.summary} · klicken zum Anzeigen
        </summary>
        <pre style="margin-top:10px;padding:14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text2);white-space:pre-wrap;font-family:inherit;line-height:1.5;max-height:200px;overflow-y:auto">${esc(anamSummary.formatted)}</pre>
      </details>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-gold" id="saGenerateBtn" onclick="generateSkinReport()" ${canGenerate?'':'disabled'} style="padding:14px 18px;font-size:14px;justify-content:center;${canGenerate?'':'opacity:.4;cursor:not-allowed'}">
        ${canGenerate ? 'Bericht generieren (~30-60 Sek)' : 'Mindestens 1 Screenshot hochladen'}
      </button>
      <div id="saStatus" style="font-size:12px;color:var(--muted);text-align:center;min-height:18px"></div>
    </div>
  `;

  // Drag-and-drop auf den ganzen Modal-Inhalt
  setupDragDrop();
}

function setupDragDrop() {
  const modal = document.getElementById('skinAnalysisModalContent');
  if (!modal || modal._dndBound) return;
  modal._dndBound = true;
  ['dragenter','dragover'].forEach(ev => modal.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); modal.style.outline = '2px dashed var(--gold)'; }));
  ['dragleave','drop'].forEach(ev => modal.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); modal.style.outline = ''; }));
  modal.addEventListener('drop', e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) handleSkinScreenshots(files);
  });
}

function summarizeAnamnese(a) {
  let fieldsFound = 0;
  const lines = [];
  const fields = [
    ['Hauttyp', a.hauttyp],
    ['Allergien', a.allergien],
    ['Hautprobleme seit', a.hautprobleme_seit],
    ['Sachlagen', a.sachlagen?.join?.(', ')],
    ['Sachlagen-Details', a.sachlagen_details],
    ['Hormonstatus', a.hormonstatus?.join?.(', ')],
    ['Medikamente', a.medikamente_checks?.join?.(', ')],
    ['Weitere Medikamente', a.medikamente_weitere],
    ['Vorbehandlungen', a.vorbehandlungen_aesthetisch?.join?.(', ')],
    ['Pflegeroutine', a.haeusliche_pflege?.join?.(', ')],
    ['Pflege-Produkte', a.pflege_details],
    ['Hautprobleme', a.hautproblem?.join?.(', ')],
    ['Hautziel', a.besuchsgrund],
    ['Lebensumstände', a.lebensumstaende?.join?.(', ')],
  ];
  for (const [label, value] of fields) {
    if (value && String(value).trim()) {
      lines.push(`${label}: ${value}`);
      fieldsFound++;
    }
  }
  return {
    summary: fieldsFound > 0 ? `${fieldsFound} Anamnese-Felder verfügbar` : 'Keine Anamnese vorhanden — Claude arbeitet nur mit den Bildern',
    formatted: lines.join('\n') || '(keine Daten)',
  };
}

function getAnamnese(c) {
  if (typeof window.getAnamnese === 'function' && window.getAnamnese !== getAnamnese) {
    return window.getAnamnese(c);
  }
  if (typeof anamneseCache === 'undefined') return null;
  const fn = (c.fn||'').trim().toLowerCase();
  const ln = (c.ln||'').trim().toLowerCase();
  const k1 = (fn+' '+ln).trim();
  const k2 = (ln+' '+fn).trim();
  return anamneseCache[k1] || anamneseCache[k2] || null;
}

// File → base64 mit Resize + Komprimierung
// Vercel hat 4.5 MB Request-Body-Limit — wir bleiben sicher unter 1 MB pro Bild (base64)
// 1600px @ JPEG 0.78 reicht für Claude um Labels (DAYLIGHT etc.) zu lesen
async function fileToResizedBase64(file, maxDim = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let base64 = dataUrl.split(',')[1];
        // Fallback: wenn immer noch zu groß (>1.5 MB base64), weiter komprimieren
        if (base64.length > 1_500_000 && quality > 0.5) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          base64 = dataUrl.split(',')[1];
        }
        if (base64.length > 1_500_000) {
          // Notfall: kleiner skalieren
          const smaller = document.createElement('canvas');
          smaller.width = Math.round(w * 0.7);
          smaller.height = Math.round(h * 0.7);
          smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
          dataUrl = smaller.toDataURL('image/jpeg', 0.7);
          base64 = dataUrl.split(',')[1];
        }
        console.log(`Bild komprimiert: ${w}x${h}, ${Math.round(base64.length/1024)}KB base64`);
        resolve({ base64, dataUrl, mediaType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleSkinScreenshots(files) {
  if (!files || files.length === 0) return;
  for (const file of Array.from(files)) {
    if (skinScreenshots.length >= MAX_SCREENSHOTS) break;
    if (!file.type.startsWith('image/')) continue;
    try {
      const result = await fileToResizedBase64(file);
      skinScreenshots.push(result);
    } catch (e) {
      console.warn('Screenshot konnte nicht geladen werden:', e);
    }
  }
  renderSkinModal();
}

function removeSkinScreenshot(idx) {
  skinScreenshots.splice(idx, 1);
  renderSkinModal();
}

// ── HINTERGRUND-JOB-SYSTEM ──
// Pro Kunden-Bericht ein Job. Tamara kann währenddessen weiterarbeiten.
const skinJobs = new Map(); // jobId -> { jobId, clientId, clientName, status, startedAt, phaseIdx, intervalId, report, costEur, error }

function ensureJobContainer() {
  let box = document.getElementById('saJobs');
  if (!box) {
    box = document.createElement('div');
    box.id = 'saJobs';
    box.className = 'sa-jobs';
    document.body.appendChild(box);
  }
  return box;
}

function renderJobWidget(jobId) {
  const job = skinJobs.get(jobId);
  if (!job) return;
  const box = ensureJobContainer();
  let el = document.getElementById('saJob-' + jobId);
  if (!el) {
    el = document.createElement('div');
    el.id = 'saJob-' + jobId;
    el.className = 'sa-job';
    box.appendChild(el);
  }
  el.className = 'sa-job' + (job.status === 'done' ? ' done' : job.status === 'error' ? ' error' : '');

  if (job.status === 'pending') {
    const phases = [
      'Lade Screenshots zur KI hoch …',
      'Identifiziere die 5 Lichtmodi …',
      'Analysiere Tageslicht & Struktur …',
      'Bewerte Pigment, Festigkeit, Rötung …',
      'Verbinde mit Anamnese-Daten …',
      'Formuliere persönlichen Bericht …',
      'Letzte Feinheiten …',
    ];
    const phase = phases[Math.min(job.phaseIdx || 0, phases.length - 1)];
    const sec = Math.floor((Date.now() - job.startedAt) / 1000);
    el.innerHTML = `
      <div class="sa-job-head">
        <div class="sa-job-title">Hautanalyse für ${esc(job.clientName)}</div>
      </div>
      <div class="sa-job-status"><span class="sa-job-spinner"></span> ${esc(phase)} <span style="margin-left:auto;color:var(--muted);font-size:10px">${sec}s</span></div>
    `;
  } else if (job.status === 'done') {
    el.innerHTML = `
      <div class="sa-job-head">
        <div class="sa-job-title">Bericht für ${esc(job.clientName)} fertig</div>
        <button class="sa-job-close" onclick="dismissSkinJob('${jobId}')" aria-label="Schließen">&times;</button>
      </div>
      <div class="sa-job-status">${job.costEur ? job.costEur + ' € Kosten · jetzt herunterladen' : 'jetzt herunterladen'}</div>
      <div class="sa-job-actions">
        <button class="btn btn-gold btn-sm" onclick="openSkinJobReport('${jobId}')">PDF herunterladen</button>
        <button class="btn btn-dark btn-sm" onclick="openSkinJobInKartei('${jobId}')">Zur Kartei</button>
      </div>
    `;
  } else if (job.status === 'error') {
    el.innerHTML = `
      <div class="sa-job-head">
        <div class="sa-job-title">Fehler bei ${esc(job.clientName)}</div>
        <button class="sa-job-close" onclick="dismissSkinJob('${jobId}')" aria-label="Schließen">&times;</button>
      </div>
      <div class="sa-job-status" style="color:var(--red)">${esc(job.error || 'Unbekannter Fehler')}</div>
    `;
  }
}

function dismissSkinJob(jobId) {
  const job = skinJobs.get(jobId);
  if (job && job.intervalId) clearInterval(job.intervalId);
  skinJobs.delete(jobId);
  const el = document.getElementById('saJob-' + jobId);
  if (el) el.remove();
}

function openSkinJobReport(jobId) {
  const job = skinJobs.get(jobId);
  if (!job || !job.clientId) return;
  // job.entry hat noch die in-memory Screenshots — bevorzugt verwenden
  let entry = job.entry;
  if (!entry) {
    const kd = (typeof loadKartei === 'function') ? (loadKartei()[job.clientId] || {}) : {};
    const reports = kd.skinReports || [];
    entry = reports.find(r => r.report && r.report.date_iso === job.report.date_iso);
    if (!entry) { toast('Bericht nicht gefunden','warn'); return; }
  }
  try {
    const blob = buildSkinReportPdf(entry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fnSafe = (entry.report.customer_full_name || 'Kunde').replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '_');
    a.download = `${fnSafe}_Hautanalyse_${entry.report.date_iso}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // Drive-Ordner auch hier öffnen
    const driveUrl = getDriveFolderUrl();
    if (driveUrl) setTimeout(() => window.open(driveUrl, '_blank'), 600);
    toast('PDF heruntergeladen');
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('PDF-Fehler:', e);
    alert('PDF konnte nicht erstellt werden:\n\n' + msg);
  }
}

function openSkinJobInKartei(jobId) {
  const job = skinJobs.get(jobId);
  if (!job || !job.clientId) return;
  // selectedClient wechseln zur Kunden-Kartei
  if (typeof clients !== 'undefined') {
    const c = clients.find(x => x.id === job.clientId);
    if (c) {
      selectedClient = c;
      currentKTab = 'hautanalyse';
      renderKartei(c);
      document.body.classList.add('client-open');
    }
  }
}

async function notifySkinJobDone(job) {
  // Browser-Notification (wenn Permission da)
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification('Skinconcept — Hautanalyse fertig', {
          body: `Bericht für ${job.clientName} ist bereit zum Download.`,
          icon: '/icon.svg',
          tag: 'sa-' + job.jobId,
        });
      } catch (e) {}
    }
  }
  // Toast (auch wenn Tab aktiv)
  toast(`Bericht für ${job.clientName} fertig (${job.costEur} €) — siehe rechts unten`);
}

async function generateSkinReport() {
  if (!selectedClient) return;
  if (skinScreenshots.length === 0) {
    toast('Bitte mindestens 1 Screenshot hochladen','warn'); return;
  }

  // Browser-Notification Permission einmalig erfragen
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  const c = selectedClient;
  const clientId = c.id;
  const fn = (c.fn || (c.name || '').split(/\s+/)[0] || 'Kundin').trim();
  const fullName = (c.fn && c.ln) ? `${c.fn} ${c.ln}`.trim() : (c.name || 'Kundin');
  const anam = getAnamnese(c) || {};

  // Job anlegen + Modal schließen
  const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const job = {
    jobId,
    clientId,
    clientName: fullName,
    status: 'pending',
    startedAt: Date.now(),
    phaseIdx: 0,
  };

  // Bilder + Anamnese im Job speichern (für späteren Save in Kartei)
  job.payload = {
    customer_first_name: fn,
    customer_full_name: fullName,
    anamnese: anam,
    images: skinScreenshots.map((s, i) => ({
      mode: 'screenshot_' + (i+1),
      base64: s.base64,
      media_type: s.mediaType,
    })),
    model: 'claude-haiku-4-5',
  };
  job.screenshots = skinScreenshots.map(s => ({ dataUrl: s.dataUrl }));

  skinJobs.set(jobId, job);
  renderJobWidget(jobId);

  // Phasen-Timer (visuelles Fortschritts-Feedback)
  job.intervalId = setInterval(() => {
    const j = skinJobs.get(jobId);
    if (!j || j.status !== 'pending') return;
    j.phaseIdx = Math.min((j.phaseIdx || 0) + 1, 6);
    renderJobWidget(jobId);
  }, 8000);

  // Sekundentimer (für die Uhrzeit-Anzeige)
  const tickId = setInterval(() => {
    const j = skinJobs.get(jobId);
    if (!j || j.status !== 'pending') { clearInterval(tickId); return; }
    renderJobWidget(jobId);
  }, 1000);

  // Modal schließen + Tamara kann weiterarbeiten
  closeModal('skinAnalysisModal');
  skinScreenshots = [];
  toast('Bericht startet im Hintergrund — du kannst weiterarbeiten');

  // Fetch im Hintergrund
  try {
    const res = await fetch(OFFICE_API + '/api/skinanalysis/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job.payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // Bericht in Kartei speichern (auch wenn Tamara aktuell einen anderen Kunden anschaut)
    // WICHTIG: KEINE base64-Bilder im Storage speichern — würde nach 2-3 Berichten den
    // Firebase Node (4 MB) + localStorage (5 MB) sprengen → Saves würden still fehlschlagen.
    // Stattdessen: nur Bericht-Text speichern. Cover-Bilder werden frisch beim PDF-Build
    // direkt aus dem Job-Cache verwendet (wenn vorhanden) — bei späterem Re-Download
    // wird das PDF ohne Cover-Bilder gerendert (Text-only Cover).
    const entry = {
      date_iso: data.report.date_iso,
      model: 'haiku-4-5',
      cost_eur: data.usage.cost_eur,
      report: data.report,
    };

    // 1. Direkt in Firebase Cloud speichern (unabhängig von localStorage)
    try {
      if (typeof FB_KARTEI_REF !== 'undefined') {
        var fbReports = [];
        try {
          var snap = await FB_KARTEI_REF.child(clientId).child('skinReports').once('value');
          fbReports = snap.val() || [];
          if (!Array.isArray(fbReports)) fbReports = Object.values(fbReports);
        } catch(e) {}
        fbReports.unshift(entry);
        await FB_KARTEI_REF.child(clientId).child('skinReports').set(fbReports);
        await FB_KARTEI_REF.child(clientId).child('_modified').set(new Date().toISOString());
        console.log('[Hautanalyse] Firebase-Save OK für', clientId);
      }
    } catch (fbErr) {
      console.error('[Hautanalyse] Firebase-Save Fehler:', fbErr);
    }

    // 2. Auch lokal speichern (best-effort, kann fehlschlagen bei vollem Storage)
    try {
      if (typeof loadKartei === 'function' && typeof saveClientKartei === 'function') {
        var kdLoaded = loadKartei();
        var kd = kdLoaded[clientId] || {};
        if (!kd.skinReports) kd.skinReports = [];
        kd.skinReports.unshift(entry);
        saveClientKartei(clientId, kd);
      }
    } catch (saveErr) {
      console.warn('[Hautanalyse] Lokaler Save fehlgeschlagen (Cloud-Save war erfolgreich):', saveErr.message);
    }

    // Job behält die Screenshots für SOFORTIGEN PDF-Download (nicht im Storage)
    job.entry = entry;
    job.entry.screenshots = job.screenshots; // nur in-memory, nicht persistent

    job.status = 'done';
    job.report = data.report;
    job.costEur = data.usage.cost_eur;
    clearInterval(job.intervalId);
    renderJobWidget(jobId);
    notifySkinJobDone(job);

    // Sidebar / aktuelle Kartei-Ansicht aktualisieren (wenn relevant)
    if (selectedClient && selectedClient.id === clientId) {
      renderKartei(selectedClient);
    }
  } catch (e) {
    job.status = 'error';
    job.error = e.message || String(e);
    clearInterval(job.intervalId);
    renderJobWidget(jobId);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Skinconcept — Hautanalyse-Fehler', { body: `${job.clientName}: ${job.error}`, icon: '/icon.svg' }); } catch(_) {}
    }
  }
}

// Drive-Ordner für Hautanalyse-PDFs — fest hinterlegt (Tamaras Ordner)
// Nach jedem PDF-Download öffnet sich automatisch dieser Ordner-Tab,
// damit die PDF nur noch reingezogen werden muss.
// localStorage-Override möglich (für individuelle Anpassung pro Gerät).
const DEFAULT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1aJ-8QTv5i7kaIyH3Qw8VC4YA0IVVk4hT';
const DRIVE_FOLDER_KEY = 'sc_hautanalyse_drive_folder';

function getDriveFolderUrl() {
  try {
    const custom = localStorage.getItem(DRIVE_FOLDER_KEY);
    return custom && custom.includes('drive.google.com') ? custom : DEFAULT_DRIVE_FOLDER;
  } catch (e) {
    return DEFAULT_DRIVE_FOLDER;
  }
}
function setDriveFolderUrl(url) {
  try { localStorage.setItem(DRIVE_FOLDER_KEY, url || ''); } catch (e) {}
}

function promptDriveFolderSetup() {
  const current = getDriveFolderUrl();
  const msg = current
    ? `Aktueller Drive-Ordner:\n${current}\n\nNeue URL eingeben (oder leer lassen zum Beibehalten):`
    : 'Drive-Ordner-URL einfügen.\n\nSo bekommst du sie:\n1. Drive öffnen → Ordner "Skinconcept Hautanalysen" anlegen\n2. Ordner öffnen\n3. URL aus Browser kopieren (sieht aus wie https://drive.google.com/drive/folders/XYZ123)\n4. Hier einfügen';
  const input = prompt(msg, current);
  if (input === null) return current; // Cancel
  if (input.trim() === '') return current; // Behalten
  if (!input.includes('drive.google.com')) {
    alert('Das sieht nicht wie eine Drive-URL aus. Bitte die komplette URL kopieren (beginnt mit https://drive.google.com/drive/folders/...).');
    return current;
  }
  setDriveFolderUrl(input.trim());
  toast('Drive-Ordner gespeichert — wird ab jetzt nach jedem PDF-Download automatisch geöffnet');
  return input.trim();
}

function downloadSkinReport(idx) {
  if (!selectedClient) return;
  const kd = getClientKartei(selectedClient.id);
  const entry = (kd.skinReports || [])[idx];
  if (!entry) { toast('Bericht nicht gefunden','warn'); return; }
  try {
    const blob = buildSkinReportPdf(entry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fnSafe = (entry.report.customer_full_name || 'Kunde').replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '_');
    a.download = `${fnSafe}_Hautanalyse_${entry.date_iso}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Drive-Ordner automatisch öffnen (falls eingerichtet)
    const driveUrl = getDriveFolderUrl();
    if (driveUrl) {
      setTimeout(() => {
        window.open(driveUrl, '_blank');
        toast('PDF heruntergeladen — Drive-Ordner geöffnet, PDF reinziehen');
      }, 600);
    }
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('PDF-Fehler:', e);
    toast('PDF-Fehler: ' + msg.slice(0, 100), 'warn');
    alert('PDF konnte nicht erstellt werden:\n\n' + msg + '\n\nDie Details stehen in der Browser-Konsole (⌘+Option+I → Console).');
  }
}

async function downloadSkinReportDocx(idx) {
  if (!selectedClient) return;
  const kd = getClientKartei(selectedClient.id);
  const entry = (kd.skinReports || [])[idx];
  if (!entry) { toast('Bericht nicht gefunden','warn'); return; }
  if (!window.docx) {
    toast('Word-Library noch nicht geladen — bitte 2 Sek warten und nochmal klicken','warn');
    return;
  }
  try {
    toast('Erstelle Word-Dokument …');
    const blob = await buildSkinReportDocx(entry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fnSafe = (entry.report.customer_full_name || 'Kunde').replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '_');
    a.download = `${fnSafe}_Hautanalyse_${entry.date_iso}.docx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Word-Datei heruntergeladen — kannst du jetzt in Word, Pages oder Google Docs bearbeiten');
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('DOCX-Fehler:', e);
    alert('Word-Datei konnte nicht erstellt werden:\n\n' + msg);
  }
}

function sendSkinReportWhatsApp(idx) {
  if (!selectedClient) return;
  const c = selectedClient;
  const kd = getClientKartei(c.id);
  const entry = (kd.skinReports || [])[idx];
  if (!entry) { toast('Bericht nicht gefunden','warn'); return; }
  const fn = entry.report.customer_first_name || 'liebe Kundin';
  const phone = c.ph || '';
  if (!phone) { toast('Kein Telefon hinterlegt — bitte PDF herunterladen und manuell verschicken','warn'); downloadSkinReport(idx); return; }
  downloadSkinReport(idx);
  setTimeout(() => {
    const msg = `Liebe ${fn},\n\nhier ist dein persönlicher Hautanalyse-Bericht aus unserer Sitzung. Lies ihn in Ruhe durch — ich freue mich auf deine Rückmeldung und sehe dich gerne wieder im Studio.\n\nHerzlich, Tamara`;
    const waUrl = getWaUrl(phone, msg);
    window.open(waUrl, '_blank');
    toast('PDF heruntergeladen + WhatsApp geöffnet — bitte PDF in den Chat ziehen');
  }, 400);
}

function deleteSkinReport(idx) {
  if (!selectedClient) return;
  if (!confirm('Diesen Hautanalyse-Bericht endgültig löschen?')) return;
  const kd = getClientKartei(selectedClient.id);
  if (!kd.skinReports || !kd.skinReports[idx]) return;
  kd.skinReports.splice(idx, 1);
  saveClientKartei(selectedClient.id, kd);
  renderKartei(selectedClient);
  toast('Bericht gelöscht');
}
