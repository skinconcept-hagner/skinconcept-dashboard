# Security-Foundation — Auth & Rollen (Stand 2026-07-04)

Ziel (aus deiner Vorgabe, Option 1): Echte Firebase-Anmeldung mit getrennten
Rollen einbauen — **ohne** Live-Kasse, Kalender oder Kundenkartei zu
unterbrechen. Parallel testen, danach die Regeln **schrittweise** scharf
stellen. Dieser Schritt legt die Grundlage. Es wurde **noch keine Live-Regel
umgestellt** — alles ist non-breaking.

---

## 1. Welche Dateien geändert wurden

| Datei | Änderung | Wirkung |
|---|---|---|
| `Dashboard/Skinconcept-Dashboard/auth-gate.js` | Rollen (`admin`/`staff`) an die PIN-Nutzer gehängt; neue Helfer `window.scRole()`, `window.scIsAdmin()`; Rolle in `sc:login`-Event | Non-breaking. `scCurrentUser()` bleibt unverändert. Rolle jetzt überall abrufbar. |
| `Dashboard/Skinconcept-Dashboard/shared.js` | Echte Studio-Firebase-Anmeldung: lädt das Auth-SDK dynamisch nach, `scEnsureStudioAuth()`, gepflegtes Login-Modal und eine gemeinsame laufende Auth-Promise | Verhindert doppelte Login-Modals und den früheren Race-Condition-Start vor abgeschlossener Auth. Deckt in **einem** Ort alle 11 internen Seiten (index, kasse, kalender, rechnungen, gutscheine, aufgaben, preislisten, crm, kunden, import-kunden, hautapp). |
| 11 interne HTML-Seiten | Alle Firebase-Initialisierungen warten nun auf `scEnsureStudioAuth()` | `kunden.html`, `import-kunden.html` und `hautapp.html` verlangen die Studio-Anmeldung, weil deren Live-Rules bereits Daten schützen. Die übrigen Seiten bleiben bis Stage A mit „Später" non-breaking. |
| `firebase/firebase-skinconcept-tool/firestore.rules.STAGE-A` | **Vorbereitete** (nicht deployte) Rules — nächster Härtungsschritt | Ändert live noch nichts. Reviewfähig für Codex. |
| `firebase/firebase-skinconcept-tool/storage.rules` | Bereits früher gehärtet (Studio/Owner statt offen) | Deploy blockiert: Storage auf `skinconcept-tool` **nicht aktiviert** → Leck ist theoretisch. |

Nicht geändert (bewusst): alle Live-`firestore.rules`, `database.rules.json`
(RTDB), sämtliche Seiten-Logik von Kasse/Kalender/Kartei.

---

## 2. Welche Rollen angelegt wurden

Auf UI-Ebene (in `auth-gate.js`), abgeleitet aus dem bestehenden PIN-Login:

| Nutzer | Rolle | Gedacht für |
|---|---|---|
| Tamara | `admin` | Inhaberin — Vollzugriff, Inhaber-Funktionen |
| Elena | `staff` | Angestellte — studio-relevante Daten, keine Inhaber-Funktionen |
| Kundin | (App) | Firebase-Auth in der HautApp, sieht nur eigene `app_*`-Daten (bereits durch Live-Rules `ownsData()`/`isOwnerId()` geschützt) |

**Firebase-Ebene:** aktuell teilen sich Tamara & Elena EIN Studio-Konto
(`skinconcept.hagner@gmail.com`). Die Rollen-Trennung greift derzeit nur im UI.
Für eine harte Trennung auf Rule-Ebene braucht Elena ein **eigenes**
Firebase-Konto (siehe Punkt 4 — das ist eine Aufgabe für dich, ich kann keine
Konten anlegen/Passwörter setzen).

---

## 3. Welche Firebase-Regeln angepasst wurden

**Live deployt: keine** (bewusst, um nichts zu unterbrechen).

**Vorbereitet in `firestore.rules.STAGE-A`** — von `if true` auf `isStudio()`:
`studio_tasks`, `vouchers`, `invoices`, `counters`, `transactions`, `products`,
`client_visits` (read). `treatments` wird öffentlich **lesbar**, aber nur
Studio darf schreiben (das ist die öffentliche Preisliste für buchen.html).

---

## 4. Was noch NICHT scharf geschaltet wurde (und warum)

1. **Kein Firestore-Rule-Flip deployt.** Das Await-Wiring ist inzwischen auf
   allen 11 `shared.js`-Seiten eingebaut. Vor dem Rule-Flip müssen die von
   Stage A betroffenen Seiten noch von optionaler auf verpflichtende Anmeldung
   umgestellt werden, damit „Später" nach dem Härtungsschritt keine leeren
   Bereiche erzeugen kann.
2. **`appointments` bleibt offen (Stage B).** Öffentliche Buchung (`buchen.html`)
   und Absage per Token (`termin.html`) nutzen Client-List-Queries ohne Login.
   Sichere Regeln erfordern einen Server-Umbau (Vercel-Function mit Admin-SDK
   statt öffentlicher Query).
3. **RTDB (`skinconcept-hagner`) unangetastet.** `anamnese`, `anamneseboegen`,
   `heimtherapie-vereinbarungen` und der CRM-Pfad `v_d98f…` sind weiter
   `.read/.write: true`. Grund: Das Dashboard nutzt die RTDB **ohne**
   Firebase-Login (nur PIN), und die HautApp schreibt `anamneseboegen`
   unauthentifiziert. Härtung braucht denselben Auth-Unterbau wie Firestore —
   erst danach flippen.
4. **Storage-Rules** sind gehärtet, aber nicht deploybar, bis du in der
   Firebase-Konsole Storage aktivierst („Get Started"). Leck ist theoretisch
   (Storage nicht provisioniert).
5. **Elena-Konto / Rollen-Trennung auf Rule-Ebene**: braucht ein zweites
   Firebase-Konto + E-Mail-Allowlist in den Rules. Konto-Anlage = dein Schritt.
6. **Office-API-Routen** (receipts/extract, skinanalysis/generate,
   treatwell-import/extract, gmail/*, drive/organize) ohne Caller-Auth — separates
   KRITISCH-Todo, hier noch nicht angefasst.
7. **ref-Linking** (HautApp `index.html:399/406`) noch clientseitig, unvalidiert.

---

## 5. Was du danach mit Codex prüfen lassen solltest

1. **Non-breaking-Check der Foundation:** Auf iPad + PC jede interne Seite öffnen
   (index, kasse, kalender, rechnungen, gutscheine, aufgaben, preislisten, crm,
   kunden). Erwartung: alles lädt normal; einmalig erscheint das Studio-Login;
   nach „Später" läuft trotzdem alles. Nach einmaligem Anmelden bleibt man
   angemeldet (LOCAL-Persistenz).
2. **Rollen-Ausgabe:** In der Konsole `scRole()` und `scIsAdmin()` prüfen —
   bei Tamara `admin`, bei Elena `staff`.
3. **STAGE-A-Rules gegenlesen** (`firestore.rules.STAGE-A`): Stimmt die
   Zuordnung intern↔`isStudio()` vs. öffentlich (treatments read, appointments)?
   Gibt es interne Seiten, die eine der gehärteten Collections OHNE
   Studio-Login lesen?
4. **Await-Wiring gegenprüfen:** Nach „Später" müssen die noch offenen
   Bereiche weiter laden; nach echter Studio-Anmeldung dürfen keine ersten
   Reads mit `permission-denied` in der Konsole auftauchen.
5. **appointments/Stage B:** Sollen buchen.html/termin.html auf eine
   Vercel-Function umgestellt werden (Admin-SDK), damit die öffentlichen
   Queries verschwinden?
6. **RTDB-Auth:** Braucht das Dashboard eine echte Firebase-Anmeldung auch
   für `skinconcept-hagner`, oder ziehen wir CRM/Anamnese perspektivisch nach
   Firestore um?

---

## Deploy-Reihenfolge (wenn freigegeben)

1. Foundation deployen (ändert keine Rules):
   `firebase deploy --only hosting:studio --project skinconcept-hagner`
   (aus `Dashboard/Skinconcept-Dashboard/`)
2. Auf allen Geräten einmal Studio-Login durchführen, 1–2 Tage parallel testen.
3. Stage-A-Seiten auf verpflichtende Anmeldung umstellen, erneut testen.
4. Erst dann STAGE-A-Rules aktivieren:
   `cp firestore.rules.STAGE-A firestore.rules && firebase deploy --only firestore:rules --project skinconcept-tool`
5. Stage B (appointments) + RTDB separat.
