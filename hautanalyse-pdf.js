// ============================================
// PDF-Generator für Hautanalyse-Berichte
// Editorial-Premium-Stil (orientiert an Aesop / Augustinus Bader)
// Nutzt jsPDF (bereits im Dashboard geladen via jspdf.min.js)
// ============================================

function buildSkinReportPdf(entry) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF nicht geladen — bitte Seite neu laden (⌘+Shift+R)');
  }
  if (!entry || !entry.report) {
    throw new Error('Bericht-Daten fehlen');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Defensive Defaults — wenn Claude einzelne Felder weglässt, crashed das PDF nicht
  const r = entry.report;
  const report = {
    customer_first_name: r.customer_first_name || 'Kundin',
    customer_full_name: r.customer_full_name || r.customer_first_name || 'Kundin',
    date_iso: r.date_iso || new Date().toISOString().slice(0, 10),
    cover_intro: r.cover_intro || '',
    analysis_intro: r.analysis_intro || '',
    mode_sections: Array.isArray(r.mode_sections) ? r.mode_sections : [],
    analysis_summary: r.analysis_summary || '',
    hauttyp: Array.isArray(r.hauttyp) ? r.hauttyp : [],
    hauptthemen: Array.isArray(r.hauptthemen) ? r.hauptthemen : [],
    anamnese_findings: Array.isArray(r.anamnese_findings) ? r.anamnese_findings : [],
    hautziel_quote: r.hautziel_quote || '',
    hautziel_response: r.hautziel_response || '',
    inner_connections: Array.isArray(r.inner_connections) ? r.inner_connections.filter(c => c && c.title) : [],
    nutrient_intro: r.nutrient_intro || '',
    nutrients: Array.isArray(r.nutrients) ? r.nutrients.filter(c => c && c.title) : [],
    blood_values_hint: r.blood_values_hint || '',
    lifestyle_intro: r.lifestyle_intro || '',
    lifestyle_cards: Array.isArray(r.lifestyle_cards) ? r.lifestyle_cards.filter(c => c && c.title) : [],
    actives_intro: r.actives_intro || '',
    active_ingredients: Array.isArray(r.active_ingredients) ? r.active_ingredients.filter(c => c && c.title) : [],
    treatment_intro: r.treatment_intro || '',
    treatments: Array.isArray(r.treatments) ? r.treatments.filter(t => t && t.name) : [],
    treatment_note: r.treatment_note || '',
    closing_quote: r.closing_quote || `Liebe ${r.customer_first_name || 'Kundin'}, vielen Dank für dein Vertrauen.`,
  };

  const screenshots = entry.screenshots || (entry.images || []).map(im => ({ dataUrl: im.dataUrl }));
  const firstName = report.customer_first_name;
  const fullName = report.customer_full_name;
  const dateStr = formatGermanDate(report.date_iso);

  // === Layout-Konstanten ===
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - 2 * MARGIN;

  const CREAM = [248, 244, 236];     // #F8F4EC Background
  const CREAM_LIGHT = [252, 250, 246];
  const INK = [42, 37, 32];          // #2A2520
  const INK_SOFT = [76, 70, 62];     // #4C463E
  const INK_MUTED = [140, 133, 122]; // #8C857A
  const GOLD = [184, 151, 99];       // #B89763
  const BORDER = [232, 226, 213];

  // === Hilfsfunktionen ===
  function fillBg(color) {
    doc.setFillColor(...color);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  function setSerif(weight) {
    doc.setFont('times', weight || 'normal'); // jsPDF Built-in Serif
  }
  function setSans(weight) {
    doc.setFont('helvetica', weight || 'normal');
  }
  function setColor(c) { doc.setTextColor(...c); }

  // Footer auf jeder Seite
  function drawFooter(pageNum) {
    setSans('normal');
    doc.setFontSize(8);
    setColor(INK_MUTED);
    doc.text('skinconcept-hagner.de', PAGE_W / 2, PAGE_H - 12, { align: 'center' });
    if (pageNum > 1) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, PAGE_H - 18, PAGE_W - MARGIN, PAGE_H - 18);
    }
  }

  // Header auf Pages >1
  function drawHeader() {
    setSerif('italic');
    doc.setFontSize(9);
    setColor(INK_MUTED);
    doc.text(`Skinconcept Hagner  ·  Hautanalyse für ${fullName}`, PAGE_W - MARGIN, 14, { align: 'right' });
  }

  // Wraps Text in Spalte, gibt neue Y-Position zurück. Defensiv gegen null/undefined.
  function drawWrappedText(text, x, y, width, lineHeight, opts = {}) {
    const t = (text == null) ? '' : String(text);
    if (!t) return y;
    try {
      const lines = doc.splitTextToSize(t, width);
      lines.forEach((line, i) => {
        doc.text(line, opts.align === 'center' ? x + width / 2 : x, y + i * lineHeight, opts);
      });
      return y + lines.length * lineHeight;
    } catch (e) {
      console.warn('drawWrappedText Fehler:', e, 'text=', t);
      return y;
    }
  }

  // Card mit Cream-Background + linker Gold-Border
  function drawCard(x, y, w, h, title, body, opts = {}) {
    doc.setFillColor(...CREAM_LIGHT);
    doc.rect(x, y, w, h, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(x, y, x, y + h);

    const t = title ? String(title).toUpperCase() : '';
    if (t) {
      setSans('bold');
      doc.setFontSize(8.5);
      setColor(INK_MUTED);
      try { doc.text(t, x + 6, y + 6); } catch (e) {}
    }
    if (body) {
      setSans('normal');
      doc.setFontSize(9);
      setColor(INK_SOFT);
      drawWrappedText(String(body), x + 6, y + 11, w - 12, 4);
    }
  }

  // Berechnet Card-Höhe basierend auf Body-Text. Defensiv gegen null/undefined.
  function cardHeight(body, w) {
    setSans('normal');
    doc.setFontSize(9);
    const t = (body == null) ? '' : String(body);
    try {
      const lines = doc.splitTextToSize(t, w - 12);
      return Math.max(20, 11 + lines.length * 4 + 4);
    } catch (e) {
      return 20;
    }
  }

  function newPage(pageNum) {
    doc.addPage();
    fillBg(CREAM);
    drawHeader();
    drawFooter(pageNum);
  }

  // ==============================================================
  // PAGE 1 — COVER
  // ==============================================================
  fillBg(CREAM);

  let y = 50;
  setSans('bold');
  doc.setFontSize(10);
  setColor(GOLD);
  doc.text('Skinconcept Hagner', PAGE_W / 2, y, { align: 'center' });
  y += 22;

  setSerif('normal');
  doc.setFontSize(40);
  setColor(INK);
  doc.text('Persönliche', PAGE_W / 2, y, { align: 'center' });
  y += 14;
  setSerif('bold');
  doc.text('Hautanalyse', PAGE_W / 2, y, { align: 'center' });
  y += 16;

  setSerif('italic');
  doc.setFontSize(11);
  setColor(INK_MUTED);
  doc.text('für', PAGE_W / 2, y, { align: 'center' });
  y += 7;
  setSerif('bold');
  doc.setFontSize(18);
  setColor(INK);
  doc.text(fullName, PAGE_W / 2, y, { align: 'center' });
  y += 14;

  // 1-2 Sylton-Connect-Screenshots — proportional in passender Größe einbetten
  const shotCount = Math.min(screenshots.length, 2);
  if (shotCount > 0) {
    const maxW = PAGE_W - 2 * MARGIN - 20;
    const slotW = shotCount === 1 ? maxW : (maxW - 4) / 2;
    const slotH = 65;
    const totalW = slotW * shotCount + (shotCount - 1) * 4;
    let xCursor = (PAGE_W - totalW) / 2;
    for (let i = 0; i < shotCount; i++) {
      const shot = screenshots[i];
      if (!shot || !shot.dataUrl) continue;
      try {
        // Hintergrund (Fallback bei Bildladefehler)
        doc.setFillColor(...BORDER);
        doc.rect(xCursor, y, slotW, slotH, 'F');
        doc.addImage(shot.dataUrl, 'JPEG', xCursor, y, slotW, slotH, undefined, 'FAST');
      } catch (e) {
        console.warn('Screenshot konnte nicht eingefügt werden:', e);
      }
      xCursor += slotW + 4;
    }
    y += slotH + 14;
  } else {
    y += 14;
  }

  // Intro-Quote
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 30, y, PAGE_W - MARGIN - 30, y);
  y += 8;
  setSerif('italic');
  doc.setFontSize(11);
  setColor(INK_SOFT);
  y = drawWrappedText(report.cover_intro || '', MARGIN + 25, y, PAGE_W - 2 * MARGIN - 50, 5.5, { align: 'center' });
  y += 4;
  doc.line(MARGIN + 30, y, PAGE_W - MARGIN - 30, y);

  // Footer Cover
  setSans('normal');
  doc.setFontSize(9);
  setColor(INK_MUTED);
  doc.text(`Erstellt am ${dateStr}  ·  Observ 320 Hautanalyse`, PAGE_W / 2, PAGE_H - 22, { align: 'center' });

  // ==============================================================
  // PAGE 2-4 — 01 Deine Hautanalyse (5 Modi)
  // ==============================================================
  let pageNum = 2;
  newPage(pageNum);
  y = 28;

  // WICHTIGER HINWEIS
  doc.setFillColor(...CREAM_LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, 36, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, MARGIN, y + 36);
  setSans('bold');
  doc.setFontSize(8.5);
  setColor(INK_MUTED);
  doc.text('WICHTIGER HINWEIS', MARGIN + 6, y + 6);
  setSans('normal');
  doc.setFontSize(8.5);
  setColor(INK_SOFT);
  drawWrappedText(
    'Diese Hautanalyse ist eine kosmetische Einschätzung auf Basis der Observ-320-Aufnahmen und deiner Angaben im Anamnesebogen. Sie ersetzt keine ärztliche oder dermatologische Diagnose. Die genannten Zusammenhänge sind als Orientierung und mögliche Erklärungsansätze zu verstehen. Bei gesundheitlichen Fragen, der Einnahme von Nahrungsergänzungsmitteln oder unklaren Hautveränderungen wende dich bitte an deine Ärztin oder deinen Arzt.',
    MARGIN + 6, y + 11, CONTENT_W - 12, 3.5,
  );
  y += 48;

  // Section 01 Header
  setSerif('bold');
  doc.setFontSize(32);
  setColor(GOLD);
  doc.text('01', MARGIN, y);
  setSerif('bold');
  doc.setFontSize(22);
  setColor(INK);
  doc.text('Deine Hautanalyse', MARGIN, y + 10);
  y += 16;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  setSans('normal');
  doc.setFontSize(10);
  setColor(INK_SOFT);
  y = drawWrappedText(report.analysis_intro || '', MARGIN, y, CONTENT_W, 4.8);
  y += 10;

  // Mode-Sections — Cards-Layout (defensiv gegen unvollständige Daten)
  // Bilder werden in der neuen 2-Screenshot-Welt nur auf Cover gezeigt, nicht pro Modus.
  const sections = report.mode_sections || [];
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s] || {};
    if (!sec.title && !sec.paragraphs) continue;

    // Höhe abschätzen
    const paragraphs = Array.isArray(sec.paragraphs) ? sec.paragraphs.filter(Boolean).map(String) : [];
    const bodyText = paragraphs.join('\n\n') || ' ';
    setSans('normal');
    doc.setFontSize(9.5);
    let bodyLines = [];
    try { bodyLines = doc.splitTextToSize(bodyText, CONTENT_W - 12); } catch (e) {}
    const blockH = Math.max(34, 18 + bodyLines.length * 4 + 8);

    if (y + blockH > PAGE_H - 30) {
      pageNum++;
      newPage(pageNum);
      y = 28;
    }

    // Volle Breite Card mit Title + Mode-Label oben
    doc.setFillColor(...CREAM_LIGHT);
    doc.rect(MARGIN, y, CONTENT_W, blockH, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN, y + blockH);

    setSans('bold');
    doc.setFontSize(8);
    setColor(GOLD);
    try { doc.text((sec.mode || '').toUpperCase(), MARGIN + 6, y + 6); } catch (e) {}

    setSerif('bold');
    doc.setFontSize(15);
    setColor(INK);
    try { doc.text(sec.title || '', MARGIN + 6, y + 13); } catch (e) {}

    setSans('normal');
    doc.setFontSize(9.5);
    setColor(INK_SOFT);
    let bodyY = y + 19;
    for (const para of paragraphs) {
      bodyY = drawWrappedText(para, MARGIN + 6, bodyY, CONTENT_W - 12, 4.2);
      bodyY += 3;
    }

    y += blockH + 14;
  }

  // Summary unter Sektionen
  if (report.analysis_summary) {
    if (y + 30 > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
    setSerif('italic');
    doc.setFontSize(11);
    setColor(INK_SOFT);
    y = drawWrappedText(report.analysis_summary, MARGIN + 10, y, CONTENT_W - 20, 5.5, { align: 'center' });
    y += 8;
  }

  // ==============================================================
  // PAGE — 02 Dein Hautprofil
  // ==============================================================
  pageNum++;
  newPage(pageNum);
  y = 28;

  setSerif('bold');
  doc.setFontSize(32);
  setColor(GOLD);
  doc.text('02', MARGIN, y);
  setSerif('bold');
  doc.setFontSize(22);
  setColor(INK);
  doc.text('Dein Hautprofil', MARGIN, y + 10);
  y += 16;
  doc.setDrawColor(...GOLD);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  setSans('normal');
  doc.setFontSize(10);
  setColor(INK_SOFT);
  y = drawWrappedText(
    `Aus der Bildanalyse und deinem Anamnesebogen ergibt sich ein klares Bild deines aktuellen Hauttyps und der Themen, an denen wir gemeinsam arbeiten.`,
    MARGIN, y, CONTENT_W, 4.8,
  );
  y += 10;

  // 2-Spalten: HAUTTYP / HAUPTTHEMEN
  const colW = (CONTENT_W - 8) / 2;
  const hauttypH = 14 + (report.hauttyp || []).length * 6 + 6;
  const themenH = 14 + (report.hauptthemen || []).length * 6 + 6;
  const dualH = Math.max(hauttypH, themenH);

  // HAUTTYP card
  doc.setFillColor(...CREAM_LIGHT);
  doc.rect(MARGIN, y, colW, dualH, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN, y + dualH);
  setSans('bold');
  doc.setFontSize(8.5);
  setColor(INK_MUTED);
  doc.text('HAUTTYP', MARGIN + 6, y + 6);
  setSans('normal');
  doc.setFontSize(9.5);
  setColor(INK_SOFT);
  (report.hauttyp || []).forEach((item, i) => {
    doc.setFillColor(...GOLD);
    doc.circle(MARGIN + 7, y + 11 + i * 6, 0.7, 'F');
    setColor(INK_SOFT); doc.text(String(item || ''), MARGIN + 11, y + 12 + i * 6);
  });

  // HAUPTTHEMEN card
  const tX = MARGIN + colW + 8;
  doc.setFillColor(...CREAM_LIGHT);
  doc.rect(tX, y, colW, dualH, 'F');
  doc.line(tX, y, tX, y + dualH);
  setSans('bold');
  doc.setFontSize(8.5);
  setColor(INK_MUTED);
  doc.text('DEINE HAUPTTHEMEN', tX + 6, y + 6);
  (report.hauptthemen || []).forEach((item, i) => {
    doc.setFillColor(...GOLD);
    doc.circle(tX + 7, y + 11 + i * 6, 0.7, 'F');
    setColor(INK_SOFT); doc.text(String(item || ''), tX + 11, y + 12 + i * 6);
  });

  y += dualH + 12;

  // ANAMNESE-FINDINGS
  const anamH = 12 + (report.anamnese_findings || []).reduce((sum, f) => {
    return sum + Math.max(1, doc.splitTextToSize(f, CONTENT_W - 16).length) * 4 + 3;
  }, 0) + 4;

  if (y + anamH > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }

  doc.setFillColor(...CREAM_LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, anamH, 'F');
  doc.line(MARGIN, y, MARGIN, y + anamH);
  setSans('bold');
  doc.setFontSize(8.5);
  setColor(INK_MUTED);
  doc.text('DAS SAGT DEINE ANAMNESE', MARGIN + 6, y + 6);
  let ay = y + 12;
  setSans('normal');
  doc.setFontSize(9);
  for (const finding of (report.anamnese_findings || [])) {
    doc.setFillColor(...GOLD);
    doc.circle(MARGIN + 7, ay - 1, 0.7, 'F');
    setColor(INK_SOFT);
    ay = drawWrappedText(String(finding || ''), MARGIN + 11, ay, CONTENT_W - 17, 4) + 3;
  }
  y += anamH + 12;

  // HAUTZIEL
  if (report.hautziel_quote || report.hautziel_response) {
    if (y + 24 > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
    doc.setFillColor(...CREAM_LIGHT);
    const qH = 28;
    doc.rect(MARGIN, y, CONTENT_W, qH, 'F');
    doc.line(MARGIN, y, MARGIN, y + qH);
    setSans('bold');
    doc.setFontSize(8.5);
    setColor(INK_MUTED);
    doc.text('DEIN HAUTZIEL', MARGIN + 6, y + 6);
    setSerif('italic');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    let qy = drawWrappedText(`„${report.hautziel_quote}"`, MARGIN + 6, y + 12, CONTENT_W - 12, 4.5);
    if (report.hautziel_response) {
      qy += 2;
      setSans('normal');
      doc.setFontSize(9);
      drawWrappedText(report.hautziel_response, MARGIN + 6, qy, CONTENT_W - 12, 4);
    }
    y += qH + 10;
  }

  // ==============================================================
  // PAGE — 03 Mögliche innere Zusammenhänge
  // ==============================================================
  if ((report.inner_connections || []).length > 0) {
    pageNum++;
    newPage(pageNum);
    y = 28;
    drawSectionHeader('03', 'Mögliche Zusammenhänge', y);
    y += 24;
    setSans('normal');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    y = drawWrappedText(
      `Hier sind mögliche innere Faktoren, die deine Hautsituation beeinflussen könnten. Es sind keine Diagnosen — sondern Anregungen, was im Hintergrund mitspielen kann.`,
      MARGIN, y, CONTENT_W, 4.8,
    );
    y += 10;

    // 2-Spalten Cards
    for (let i = 0; i < (report.inner_connections || []).length; i += 2) {
      const c1 = report.inner_connections[i];
      const c2 = report.inner_connections[i + 1];
      const h1 = cardHeight(c1.body, colW);
      const h2 = c2 ? cardHeight(c2.body, colW) : 0;
      const h = Math.max(h1, h2);

      if (y + h > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }

      drawCard(MARGIN, y, colW, h, c1.title, c1.body);
      if (c2) drawCard(tX, y, colW, h, c2.title, c2.body);
      y += h + 8;
    }
  }

  // ==============================================================
  // PAGE — 04 Nährstoff-Empfehlungen
  // ==============================================================
  if ((report.nutrients || []).length > 0) {
    pageNum++;
    newPage(pageNum);
    y = 28;
    drawSectionHeader('04', 'Nährstoff-Empfehlungen', y);
    y += 24;
    setSans('normal');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    y = drawWrappedText(report.nutrient_intro || '', MARGIN, y, CONTENT_W, 4.8);
    y += 10;
    for (let i = 0; i < report.nutrients.length; i += 2) {
      const c1 = report.nutrients[i];
      const c2 = report.nutrients[i + 1];
      const h = Math.max(cardHeight(c1.body, colW), c2 ? cardHeight(c2.body, colW) : 0);
      if (y + h > PAGE_H - 50) { pageNum++; newPage(pageNum); y = 28; }
      drawCard(MARGIN, y, colW, h, c1.title, c1.body);
      if (c2) drawCard(tX, y, colW, h, c2.title, c2.body);
      y += h + 8;
    }
    if (report.blood_values_hint) {
      if (y + 24 > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
      drawCard(MARGIN, y, CONTENT_W, cardHeight(report.blood_values_hint, CONTENT_W), 'SINNVOLLE BLUTWERTE ZUR ABKLÄRUNG', report.blood_values_hint);
      y += cardHeight(report.blood_values_hint, CONTENT_W) + 8;
    }
  }

  // ==============================================================
  // PAGE — 05 Lifestyle & Ernährung
  // ==============================================================
  if ((report.lifestyle_cards || []).length > 0) {
    pageNum++;
    newPage(pageNum);
    y = 28;
    drawSectionHeader('05', 'Lifestyle & Ernährung', y);
    y += 24;
    setSans('normal');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    y = drawWrappedText(report.lifestyle_intro || '', MARGIN, y, CONTENT_W, 4.8);
    y += 10;
    for (let i = 0; i < report.lifestyle_cards.length; i += 2) {
      const c1 = report.lifestyle_cards[i];
      const c2 = report.lifestyle_cards[i + 1];
      const h = Math.max(cardHeight(c1.body, colW), c2 ? cardHeight(c2.body, colW) : 0);
      if (y + h > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
      drawCard(MARGIN, y, colW, h, c1.title, c1.body);
      if (c2) drawCard(tX, y, colW, h, c2.title, c2.body);
      y += h + 8;
    }
  }

  // ==============================================================
  // PAGE — 06 Wirkstoff-Empfehlungen
  // ==============================================================
  if ((report.active_ingredients || []).length > 0) {
    pageNum++;
    newPage(pageNum);
    y = 28;
    drawSectionHeader('06', 'Wirkstoff-Empfehlungen', y);
    y += 24;
    setSans('normal');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    y = drawWrappedText(report.actives_intro || '', MARGIN, y, CONTENT_W, 4.8);
    y += 10;
    for (let i = 0; i < report.active_ingredients.length; i += 2) {
      const c1 = report.active_ingredients[i];
      const c2 = report.active_ingredients[i + 1];
      const h = Math.max(cardHeight(c1.body, colW), c2 ? cardHeight(c2.body, colW) : 0);
      if (y + h > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
      drawCard(MARGIN, y, colW, h, c1.title, c1.body);
      if (c2) drawCard(tX, y, colW, h, c2.title, c2.body);
      y += h + 8;
    }
  }

  // ==============================================================
  // PAGE — 07 Behandlungsempfehlung
  // ==============================================================
  if ((report.treatments || []).length > 0) {
    pageNum++;
    newPage(pageNum);
    y = 28;
    drawSectionHeader('07', 'Deine Behandlungsempfehlung', y);
    y += 24;
    setSans('normal');
    doc.setFontSize(10);
    setColor(INK_SOFT);
    y = drawWrappedText(report.treatment_intro || '', MARGIN, y, CONTENT_W, 4.8);
    y += 10;

    // Table — Spaltenbreiten neu kalibriert + Spaltentrenner + Text-Wrap auch für Name
    // CONTENT_W = 170mm — Aufteilung: Name 58, Ziel 70, Preis 22, Prio 20 = 170mm
    const colW = { name: 58, goal: 70, price: 22, prio: 20 };
    const colX = {
      name: MARGIN + 4,
      goal: MARGIN + colW.name + 4,
      price: MARGIN + colW.name + colW.goal + 4,
      prio: MARGIN + colW.name + colW.goal + colW.price + 4,
    };
    const colInnerW = {
      name: colW.name - 6,
      goal: colW.goal - 6,
      price: colW.price - 4,
      prio: colW.prio - 4,
    };

    // Table Header
    doc.setFillColor(...CREAM_LIGHT);
    doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
    setSans('bold');
    doc.setFontSize(8.5);
    setColor(INK_MUTED);
    doc.text('BEHANDLUNG', colX.name, y + 6.5);
    doc.text('ZIEL', colX.goal, y + 6.5);
    doc.text('PREIS', colX.price, y + 6.5);
    doc.text('PRIORITÄT', colX.prio, y + 6.5);
    y += 10;

    // Rows mit Text-Wrap für Name + Goal
    setSans('normal');
    doc.setFontSize(9);
    for (const t of report.treatments) {
      const nameStr = String(t.name || '');
      const goalStr = String(t.goal || '');
      let nameLines = [];
      let goalLines = [];
      setSans('bold');
      try { nameLines = doc.splitTextToSize(nameStr, colInnerW.name); } catch (e) { nameLines = [nameStr]; }
      setSans('normal');
      try { goalLines = doc.splitTextToSize(goalStr, colInnerW.goal); } catch (e) { goalLines = [goalStr]; }
      const lineCount = Math.max(nameLines.length, goalLines.length, 1);
      const rowH = Math.max(10, lineCount * 4 + 4);

      if (y + rowH > PAGE_H - 50) {
        pageNum++; newPage(pageNum); y = 28;
        // Header auf neuer Seite wiederholen
        doc.setFillColor(...CREAM_LIGHT);
        doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
        setSans('bold'); doc.setFontSize(8.5); setColor(INK_MUTED);
        doc.text('BEHANDLUNG', colX.name, y + 6.5);
        doc.text('ZIEL', colX.goal, y + 6.5);
        doc.text('PREIS', colX.price, y + 6.5);
        doc.text('PRIORITÄT', colX.prio, y + 6.5);
        y += 10;
      }

      // Bottom-Border
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);

      // Name (wrapped, bold)
      setSans('bold'); setColor(INK); doc.setFontSize(9);
      nameLines.forEach((l, i) => doc.text(l, colX.name, y + 5 + i * 4));

      // Goal (wrapped, regular)
      setSans('normal'); setColor(INK_SOFT);
      goalLines.forEach((l, i) => doc.text(l, colX.goal, y + 5 + i * 4));

      // Preis + Priorität (einzeilig)
      doc.text(String(t.price || ''), colX.price, y + 5);
      setColor(INK);
      doc.text(String(t.priority || ''), colX.prio, y + 5);
      setColor(INK_SOFT);

      y += rowH;
    }
    y += 8;

    if (report.treatment_note) {
      if (y + 20 > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
      doc.setFillColor(...CREAM_LIGHT);
      const nh = cardHeight(report.treatment_note, CONTENT_W);
      doc.rect(MARGIN, y, CONTENT_W, nh, 'F');
      doc.setDrawColor(...GOLD);
      doc.line(MARGIN, y, MARGIN, y + nh);
      setSerif('italic');
      doc.setFontSize(9.5);
      setColor(INK_SOFT);
      drawWrappedText(report.treatment_note, MARGIN + 6, y + 6, CONTENT_W - 12, 4);
      y += nh + 14;
    }
  }

  // Closing
  if (report.closing_quote) {
    if (y + 50 > PAGE_H - 30) { pageNum++; newPage(pageNum); y = 28; }
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.setFillColor(...GOLD);
    doc.circle(PAGE_W / 2, y + 4, 1.2, 'F');
    y += 10;
    setSerif('bold');
    doc.setFontSize(16);
    setColor(INK);
    doc.text('Vielen Dank für dein Vertrauen', PAGE_W / 2, y + 6, { align: 'center' });
    y += 12;
    setSerif('italic');
    doc.setFontSize(11);
    setColor(INK_SOFT);
    y = drawWrappedText(report.closing_quote, MARGIN + 10, y, CONTENT_W - 20, 5, { align: 'center' });
    y += 6;
    setSerif('bold');
    doc.setFontSize(13);
    setColor(GOLD);
    doc.text('Tamara Hagner', PAGE_W / 2, y, { align: 'center' });
    y += 6;
    setSans('normal');
    doc.setFontSize(8);
    setColor(INK_MUTED);
    doc.text('Skinconcept Hagner  ·  skinconcept-hagner.de  ·  @tamara.hagner', PAGE_W / 2, y, { align: 'center' });
  }

  function drawSectionHeader(num, title, y0) {
    setSerif('bold');
    doc.setFontSize(32);
    setColor(GOLD);
    doc.text(num, MARGIN, y0);
    setSerif('bold');
    doc.setFontSize(22);
    setColor(INK);
    doc.text(title, MARGIN, y0 + 10);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y0 + 16, PAGE_W - MARGIN, y0 + 16);
  }

  return doc.output('blob');
}

function formatGermanDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return `${parseInt(d, 10)}. ${monate[parseInt(m, 10) - 1] || ''} ${y}`;
}
