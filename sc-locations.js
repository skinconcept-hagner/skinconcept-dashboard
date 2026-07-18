// ════════════════════════════════════════════════════════════════
// sc-locations.js — Standort-Registry (Multi-Standort-Vorbereitung)
// ════════════════════════════════════════════════════════════════
// Umsetzung von ADR-1 (SKINCONCEPT-ARCHITECTURE.md): jedes fachliche
// Dokument bekommt langfristig ein `locationId`. Dieses Modul stellt die
// Standort-Registry und die Helfer bereit, um Schreibpfade zu stempeln.
//
// NON-BREAKING: Heute liest/erzwingt nichts dieses Modul. Es ist reine
// Vorbereitung. Der Moment, in dem Kundendaten/Umsaetze/Termine mit
// locationId gestempelt werden, ist eine spaetere, kontrollierte Umstellung.
//
// Verwendung spaeter (Beispiel):
//   scStampLocation(payload);   // fuegt locationId hinzu, falls nicht gesetzt
//   fbDb.ref('...').push(payload);
// ════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var LOCATIONS = {
    morbach:   { id: 'morbach',   label: 'Morbach',   active: true,  timezone: 'Europe/Berlin' },
    andernach: { id: 'andernach', label: 'Andernach', active: false, timezone: 'Europe/Berlin' } // reserviert, ADR-1
  };
  var DEFAULT_LOCATION = 'morbach';

  // Aufloesung (Prioritaet): ?standort=... > gespeicherte Wahl > Default.
  function scLocationId() {
    try {
      var q = new URLSearchParams(global.location.search).get('standort');
      if (q && LOCATIONS[q]) return q;
      var s = global.localStorage.getItem('sc:locationId');
      if (s && LOCATIONS[s]) return s;
    } catch (e) {}
    return DEFAULT_LOCATION;
  }

  // Setzt die aktive Standortwahl (fuer spaeteres Standort-Umschalten im UI).
  function scSetLocation(id) {
    if (!LOCATIONS[id]) return false;
    try { global.localStorage.setItem('sc:locationId', id); } catch (e) {}
    return true;
  }

  // Stempelt ein Payload-Objekt mit locationId, ohne bestehende Werte zu ueberschreiben.
  function scStampLocation(obj) {
    try { if (obj && typeof obj === 'object' && !obj.locationId) obj.locationId = scLocationId(); } catch (e) {}
    return obj;
  }

  global.SC_LOCATIONS       = LOCATIONS;
  global.SC_DEFAULT_LOCATION = DEFAULT_LOCATION;
  global.scLocationId       = scLocationId;
  global.scSetLocation      = scSetLocation;
  global.scStampLocation    = scStampLocation;
})(window);
