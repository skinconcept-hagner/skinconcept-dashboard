// Cloud Functions für Skinconcept Dashboard.
// Aktuell: sendMail — versendet eine Mail (z.B. Gutschein + Rechnung)
// via SMTP über das hinterlegte Gmail-App-Passwort.
//
// Aufruf vom Frontend:
//   const fn = firebase.app().functions('europe-west1').httpsCallable('sendMail');
//   await fn({ to, subject, body, attachments: [{filename, base64}] });
//
// Setup einmalig:
//   firebase functions:secrets:set SMTP_USER
//   firebase functions:secrets:set SMTP_PASS

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

exports.sendMail = onCall(
  {
    region: "europe-west1",
    secrets: [SMTP_USER, SMTP_PASS],
    // Nur Aufrufe von der eigenen Domain (und lokaler Dev) erlauben.
    // Wenn das Dashboard später Firebase Auth bekommt, zusätzlich oben in der Funktion
    // `if (!request.auth) throw new HttpsError("unauthenticated", ...)` einbauen.
    cors: [
      "https://skinconcept-hagner.web.app",
      "https://skinconcept-hagner.firebaseapp.com",
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
  },
  async (request) => {
    const { to, subject, body, attachments } = request.data || {};

    if (!to || !subject || !body) {
      throw new HttpsError("invalid-argument", "to, subject und body sind Pflichtfelder");
    }

    // Empfänger-Limit + Format-Validierung (verhindert Mass-Mailing-Missbrauch)
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0 || recipients.length > 5) {
      throw new HttpsError("invalid-argument", "Maximal 5 Empfänger pro Mail.");
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (typeof r !== "string" || !emailRe.test(r)) {
        throw new HttpsError("invalid-argument", `Ungültige Empfänger-Adresse: ${r}`);
      }
    }

    // Anhänge: max 10 MB Gesamtgröße (base64 ist ~33 % größer als binär)
    if (Array.isArray(attachments)) {
      const totalBase64Bytes = attachments
        .filter((a) => a && typeof a.base64 === "string")
        .reduce((sum, a) => sum + a.base64.length, 0);
      if (totalBase64Bytes > 14_000_000) {
        throw new HttpsError("invalid-argument", "Anhänge dürfen insgesamt max. 10 MB groß sein.");
      }
    }

    const user = SMTP_USER.value();
    const pass = SMTP_PASS.value();
    if (!user || !pass) {
      throw new HttpsError(
        "failed-precondition",
        "SMTP-Credentials nicht gesetzt. firebase functions:secrets:set SMTP_USER / SMTP_PASS"
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });

    const mailAttachments = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && a.filename && a.base64)
          .map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.base64, "base64"),
            contentType: a.contentType || "application/pdf",
          }))
      : undefined;

    try {
      const info = await transporter.sendMail({
        from: `"Skinconcept Hagner" <${user}>`,
        to,
        subject,
        text: body,
        attachments: mailAttachments,
      });
      return { ok: true, messageId: info.messageId, sentAt: Date.now() };
    } catch (e) {
      throw new HttpsError("internal", e.message || "Mail-Versand fehlgeschlagen");
    }
  }
);
