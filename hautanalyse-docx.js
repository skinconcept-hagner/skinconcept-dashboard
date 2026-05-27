// ============================================
// DOCX-Generator — Editorial Premium (Diana-PDF-Stil)
// Schlankes Layout: klare Sections, viel Whitespace, edle Typo.
// Drive-kompatibel: Datei in Google Drive ziehen → wird automatisch zum Google Doc.
// ============================================

function buildSkinReportDocx(entry) {
  if (!window.docx) throw new Error('docx-Library nicht geladen — bitte Seite neu laden');
  if (!entry || !entry.report) throw new Error('Bericht-Daten fehlen');

  const D = window.docx;
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
    HeightRule, VerticalAlign, PageBreak,
  } = D;

  const r = entry.report;
  const fullName = r.customer_full_name || r.customer_first_name || 'Kundin';
  const firstName = r.customer_first_name || 'Kundin';
  const dateStr = formatGermanDate(r.date_iso || new Date().toISOString().slice(0, 10));

  // Farben
  const CREAM_CARD = 'F5EFE3';   // Diana-Card Hintergrund
  const GOLD = 'A8855B';         // Edler Gold-Ton
  const INK = '2B2520';
  const INK_SOFT = '4A443D';
  const INK_MUTED = '8C857A';
  const BORDER = 'E8E0CF';

  const SERIF = 'Cambria';       // Serif für Display-Elemente
  const SANS = 'Calibri';

  // Größen in half-points
  const SZ = {
    micro: 16,   // 8pt
    small: 18,   // 9pt
    body: 22,    // 11pt
    lead: 24,    // 12pt
    h4: 28,
    h3: 36,
    h2: 44,
    h1: 64,      // Section-Nummer
    display: 80, // Cover-Titel
  };

  const screenshots = entry.screenshots || (entry.images || []).map(im => ({ dataUrl: im.dataUrl }));

  const children = [];

  // ==================== COVER ====================
  children.push(emptyParagraph(800));

  children.push(centered('SKINCONCEPT HAGNER', { bold: true, color: GOLD, size: SZ.micro, characterSpacing: 200 }));

  children.push(emptyParagraph(800));

  children.push(centered('Persönliche', { font: SERIF, size: SZ.display, color: INK }));
  children.push(centered('Hautanalyse', { font: SERIF, bold: true, size: SZ.display, color: INK }, { spaceBefore: 100 }));

  children.push(emptyParagraph(400));

  children.push(centered('für', { italics: true, color: INK_MUTED, size: SZ.lead }));
  children.push(centered(fullName, { font: SERIF, bold: true, size: 52, color: INK }, { spaceBefore: 100 }));

  children.push(emptyParagraph(600));

  // Cover-Bilder (max 2)
  for (const shot of screenshots.slice(0, 2)) {
    if (!shot || !shot.dataUrl) continue;
    try {
      const base64 = shot.dataUrl.split(',')[1];
      const bytes = base64ToUint8(base64);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new ImageRun({ data: bytes, transformation: { width: 480, height: 270 } })],
      }));
    } catch (e) { console.warn('Cover-Bild Fehler:', e); }
  }

  children.push(emptyParagraph(400));

  // Quote-Box mit Linien
  if (r.cover_intro) {
    children.push(goldDivider());
    children.push(centered(r.cover_intro, { italics: true, color: INK_SOFT, size: SZ.lead }, { spaceBefore: 200, spaceAfter: 200, line: 360 }));
    children.push(goldDivider());
  }

  children.push(emptyParagraph(600));
  children.push(centered(`Erstellt am ${dateStr}  ·  Observ 320 Hautanalyse`, { color: INK_MUTED, size: SZ.small }));

  // ==================== SECTION 01 — DEINE HAUTANALYSE ====================
  pushSection(children, '01', 'Deine Hautanalyse');

  // Wichtiger Hinweis Card oben
  children.push(infoCard(
    'WICHTIGER HINWEIS',
    'Diese Hautanalyse ist eine kosmetische Einschätzung auf Basis der Observ-320-Aufnahmen und deiner Angaben im Anamnesebogen. Sie ersetzt keine ärztliche oder dermatologische Diagnose. Bei gesundheitlichen Fragen, der Einnahme von Nahrungsergänzungsmitteln oder unklaren Hautveränderungen wende dich bitte an deine Ärztin oder deinen Arzt.',
  ));

  if (r.analysis_intro) {
    children.push(paragraph(r.analysis_intro));
  }

  // Mode-Sections — jede mit Modus-Caps + Serif Title + Body
  for (const sec of (r.mode_sections || [])) {
    if (!sec || (!sec.title && !sec.paragraphs)) continue;
    children.push(emptyParagraph(400));
    children.push(new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: String(sec.mode || '').toUpperCase(), bold: true, color: GOLD, size: SZ.micro, characterSpacing: 80 })],
    }));
    children.push(new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: sec.title || '', font: SERIF, bold: true, color: INK, size: SZ.h3 })],
    }));
    for (const para of (Array.isArray(sec.paragraphs) ? sec.paragraphs : [])) {
      children.push(paragraph(para));
    }
  }

  if (r.analysis_summary) {
    children.push(emptyParagraph(400));
    children.push(centered(r.analysis_summary, { italics: true, color: INK_SOFT, size: SZ.lead }, { line: 360 }));
  }

  // ==================== SECTION 02 — DEIN HAUTPROFIL ====================
  pushSection(children, '02', 'Dein Hautprofil');
  children.push(paragraph('Aus der Bildanalyse und deinem Anamnesebogen ergibt sich ein klares Bild deines aktuellen Hauttyps und der Themen, an denen wir gemeinsam arbeiten.'));
  children.push(emptyParagraph(200));

  // HAUTTYP
  if ((r.hauttyp || []).length) {
    children.push(subhead('Hauttyp'));
    for (const item of r.hauttyp) children.push(bullet(item));
  }
  // HAUPTTHEMEN
  if ((r.hauptthemen || []).length) {
    children.push(emptyParagraph(300));
    children.push(subhead('Deine Hauptthemen'));
    for (const item of r.hauptthemen) children.push(bullet(item));
  }
  // ANAMNESE FINDINGS
  if ((r.anamnese_findings || []).length) {
    children.push(emptyParagraph(300));
    children.push(subhead('Das sagt deine Anamnese'));
    for (const item of r.anamnese_findings) children.push(bullet(item));
  }
  // HAUTZIEL
  if (r.hautziel_quote || r.hautziel_response) {
    children.push(emptyParagraph(400));
    children.push(subhead('Dein Hautziel'));
    if (r.hautziel_quote) {
      children.push(new Paragraph({
        spacing: { before: 100, after: 100, line: 360 },
        children: [new TextRun({ text: `„${r.hautziel_quote}"`, italics: true, color: INK_SOFT, size: SZ.lead })],
      }));
    }
    if (r.hautziel_response) children.push(paragraph(r.hautziel_response));
  }

  // ==================== SECTION 03 — MÖGLICHE INNERE ZUSAMMENHÄNGE ====================
  if ((r.inner_connections || []).length) {
    pushSection(children, '03', 'Mögliche innere Zusammenhänge');
    children.push(paragraph('Hier sind mögliche innere Faktoren, die deine Hautsituation beeinflussen könnten. Es sind keine Diagnosen — sondern Anregungen, was im Hintergrund mitspielen kann.'));
    for (const c of r.inner_connections) {
      if (!c) continue;
      children.push(emptyParagraph(300));
      if (c.title) children.push(subhead(c.title));
      if (c.body) children.push(paragraph(c.body));
    }
  }

  // ==================== SECTION 04 — NÄHRSTOFFE ====================
  if ((r.nutrients || []).length) {
    pushSection(children, '04', 'Nährstoff-Empfehlungen');
    if (r.nutrient_intro) children.push(paragraph(r.nutrient_intro));
    for (const c of r.nutrients) {
      if (!c) continue;
      children.push(emptyParagraph(300));
      if (c.title) children.push(subhead(c.title));
      if (c.body) children.push(paragraph(c.body));
    }
    if (r.blood_values_hint) {
      children.push(emptyParagraph(400));
      children.push(infoCard('Sinnvolle Blutwerte zur Abklärung', r.blood_values_hint));
    }
  }

  // ==================== SECTION 05 — LIFESTYLE & ERNÄHRUNG ====================
  if ((r.lifestyle_cards || []).length) {
    pushSection(children, '05', 'Lifestyle & Ernährung');
    if (r.lifestyle_intro) children.push(paragraph(r.lifestyle_intro));
    for (const c of r.lifestyle_cards) {
      if (!c) continue;
      children.push(emptyParagraph(300));
      if (c.title) children.push(subhead(c.title));
      if (c.body) children.push(paragraph(c.body));
    }
  }

  // ==================== SECTION 06 — WIRKSTOFFE ====================
  if ((r.active_ingredients || []).length) {
    pushSection(children, '06', 'Wirkstoff-Empfehlungen');
    if (r.actives_intro) children.push(paragraph(r.actives_intro));
    for (const c of r.active_ingredients) {
      if (!c) continue;
      children.push(emptyParagraph(300));
      if (c.title) children.push(subhead(c.title));
      if (c.body) children.push(paragraph(c.body));
    }
  }

  // ==================== SECTION 07 — BEHANDLUNGEN ====================
  if ((r.treatments || []).length) {
    pushSection(children, '07', 'Deine Behandlungsempfehlung');
    if (r.treatment_intro) children.push(paragraph(r.treatment_intro));
    children.push(emptyParagraph(200));

    const headerRow = new TableRow({
      tableHeader: true,
      children: ['BEHANDLUNG', 'ZIEL', 'PREIS', 'PRIORITÄT'].map(label => new TableCell({
        shading: { type: ShadingType.SOLID, color: CREAM_CARD },
        margins: { top: 150, bottom: 150, left: 150, right: 150 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: INK_MUTED, size: SZ.micro, characterSpacing: 40 })] })],
      })),
    });
    const rows = [headerRow];
    for (const t of r.treatments) {
      rows.push(new TableRow({
        children: [
          treatCell(String(t.name || ''), { bold: true, color: INK }),
          treatCell(String(t.goal || ''), { color: INK_SOFT }),
          treatCell(String(t.price || ''), { color: INK_SOFT }),
          treatCell(String(t.priority || ''), { color: INK, bold: true }),
        ],
      }));
    }
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2700, 4500, 1400, 1400],
      borders: {
        top: { color: BORDER, size: 4, style: BorderStyle.SINGLE },
        bottom: { color: BORDER, size: 4, style: BorderStyle.SINGLE },
        left: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        right: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        insideHorizontal: { color: BORDER, size: 4, style: BorderStyle.SINGLE },
        insideVertical: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
      },
      rows,
    }));

    if (r.treatment_note) {
      children.push(emptyParagraph(300));
      children.push(new Paragraph({
        spacing: { before: 100, after: 200, line: 360 },
        children: [new TextRun({ text: r.treatment_note, italics: true, color: INK_SOFT, size: SZ.lead })],
      }));
    }
  }

  // ==================== ABSCHLUSS ====================
  if (r.closing_quote) {
    children.push(emptyParagraph(800));
    children.push(centered('Vielen Dank für dein Vertrauen', { font: SERIF, bold: true, size: SZ.h2, color: INK }));
    children.push(emptyParagraph(200));
    children.push(centered(r.closing_quote, { italics: true, color: INK_SOFT, size: SZ.lead }, { line: 360 }));
    children.push(emptyParagraph(300));
    children.push(centered('Tamara Hagner', { bold: true, color: GOLD, size: 30 }));
    children.push(centered('Skinconcept Hagner  ·  skinconcept-hagner.de  ·  @tamara.hagner', { color: INK_MUTED, size: SZ.small }, { spaceBefore: 60 }));
  }

  // ============ HELPERS ============
  function emptyParagraph(spaceAfter) {
    return new Paragraph({ spacing: { before: 0, after: spaceAfter || 100 }, children: [new TextRun({ text: '' })] });
  }
  function centered(text, runOpts, opts = {}) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: opts.spaceBefore || 0, after: opts.spaceAfter || 0, line: opts.line || 280 },
      children: [new TextRun({ text, ...runOpts })],
    });
  }
  function goldDivider() {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      border: { bottom: { color: GOLD, space: 1, style: BorderStyle.SINGLE, size: 4 } },
      children: [new TextRun({ text: '' })],
    });
  }
  function pushSection(arr, num, title) {
    arr.push(new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 600, after: 100 },
      children: [new TextRun({ text: num, font: SERIF, bold: true, color: GOLD, size: SZ.h1 })],
    }));
    arr.push(new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: title, font: SERIF, bold: true, color: INK, size: SZ.h2 })],
    }));
    arr.push(new Paragraph({
      spacing: { before: 0, after: 400 },
      border: { bottom: { color: GOLD, space: 1, style: BorderStyle.SINGLE, size: 4 } },
      children: [new TextRun({ text: '' })],
    }));
  }
  function paragraph(text) {
    return new Paragraph({
      spacing: { before: 100, after: 100, line: 340 },
      children: [new TextRun({ text: String(text || ''), color: INK_SOFT, size: SZ.body })],
    });
  }
  function subhead(text) {
    return new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: String(text || '').toUpperCase(), bold: true, color: INK_MUTED, size: SZ.micro, characterSpacing: 80 })],
    });
  }
  function bullet(text) {
    return new Paragraph({
      spacing: { before: 60, after: 60, line: 320 },
      indent: { left: 360, hanging: 200 },
      children: [
        new TextRun({ text: '•   ', color: GOLD, bold: true, size: SZ.body }),
        new TextRun({ text: String(text || ''), color: INK_SOFT, size: SZ.body }),
      ],
    });
  }
  function infoCard(title, body) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        bottom: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        left: { color: GOLD, size: 24, style: BorderStyle.SINGLE },
        right: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        insideHorizontal: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
        insideVertical: { color: 'FFFFFF', size: 0, style: BorderStyle.NONE },
      },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: CREAM_CARD },
          margins: { top: 250, bottom: 250, left: 250, right: 250 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 100 },
              children: [new TextRun({ text: String(title || '').toUpperCase(), bold: true, color: INK_MUTED, size: SZ.micro, characterSpacing: 60 })],
            }),
            new Paragraph({
              spacing: { before: 0, after: 0, line: 320 },
              children: [new TextRun({ text: String(body || ''), color: INK_SOFT, size: SZ.body })],
            }),
          ],
        })],
      })],
    });
  }
  function treatCell(text, opts) {
    return new TableCell({
      margins: { top: 150, bottom: 150, left: 150, right: 150 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun({ text, color: opts.color, bold: opts.bold || false, size: SZ.body })] })],
    });
  }

  const doc = new Document({
    creator: 'Skinconcept Hagner',
    title: `Hautanalyse für ${fullName}`,
    description: 'Persönliche Hautanalyse — Editorial',
    styles: {
      default: {
        document: { run: { font: SANS, size: SZ.body } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1400, right: 1400, bottom: 1400, left: 1400 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
