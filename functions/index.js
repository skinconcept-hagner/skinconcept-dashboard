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
    cors: true,
  },
  async (request) => {
    const { to, subject, body, attachments } = request.data || {};

    if (!to || !subject || !body) {
      throw new HttpsError("invalid-argument", "to, subject und body sind Pflichtfelder");
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
