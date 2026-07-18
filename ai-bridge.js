// Skinconcept Dashboard -> AI Command Center
//
// Die Browser-Seite sendet ausschliesslich ein Firebase-ID-Token. Es werden
// keine Server-Secrets im Dashboard hinterlegt. Die Gegenstelle validiert das
// Token und verarbeitet jede eventId idempotent.
(function () {
  'use strict';

  const URL_KEY = 'sc_ai_command_center_url';
  const QUEUE_KEY = 'sc_ai_event_queue_v1';
  const MAX_QUEUE_SIZE = 50;
  const PRODUCTION_BASE_URL = 'https://skinconcept-ai-command-center.vercel.app';

  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function getBaseUrl() {
    const configured = normalizeBaseUrl(window.SC_AI_COMMAND_CENTER_URL);
    if (configured) return configured;

    try {
      const stored = normalizeBaseUrl(localStorage.getItem(URL_KEY));
      if (stored) return stored;
    } catch (e) {}

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    return PRODUCTION_BASE_URL;
  }

  function getQueue() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function setQueue(queue) {
    try {
      sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
    } catch (e) {}
  }

  function queueEvent(event) {
    const queue = getQueue();
    if (!queue.some(function (item) { return item && item.eventId === event.eventId; })) {
      queue.push(event);
      setQueue(queue);
    }
  }

  function getStudioAuth() {
    try {
      if (typeof nsAuth !== 'undefined' && nsAuth && nsAuth.currentUser) return nsAuth;
    } catch (e) {}
    try {
      if (window.firebase && typeof firebase.auth === 'function') return firebase.auth();
    } catch (e) {}
    return null;
  }

  async function postEvent(event) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) throw new Error('AI Command Center URL ist noch nicht konfiguriert.');

    const auth = getStudioAuth();
    const user = auth && auth.currentUser;
    if (!user || typeof user.getIdToken !== 'function') {
      throw new Error('Studio-Anmeldung fuer AI-Synchronisierung fehlt.');
    }

    const token = await user.getIdToken();
    const response = await fetch(baseUrl + '/api/integrations/studio/events', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    let body = null;
    try { body = await response.json(); } catch (e) {}
    if (!response.ok) {
      throw new Error(body && body.error ? body.error : 'AI-Synchronisierung fehlgeschlagen (' + response.status + ').');
    }
    return body || { ok: true };
  }

  window.scSetAiCommandCenterUrl = function (url) {
    const normalized = normalizeBaseUrl(url);
    if (!/^https?:\/\//i.test(normalized)) throw new Error('Ungueltige Command-Center-URL.');
    localStorage.setItem(URL_KEY, normalized);
    return normalized;
  };

  window.scGetAiCommandCenterUrl = getBaseUrl;

  window.scSendAiEvent = async function (event) {
    if (!event || !event.eventId || !event.eventType) {
      throw new Error('AI-Event benoetigt eventId und eventType.');
    }

    try {
      const result = await postEvent(event);
      await window.scFlushAiEvents();
      return result;
    } catch (error) {
      queueEvent(event);
      throw error;
    }
  };

  window.scFlushAiEvents = async function () {
    const queue = getQueue();
    if (!queue.length) return { sent: 0, remaining: 0 };

    let sent = 0;
    const remaining = [];
    for (const event of queue) {
      try {
        await postEvent(event);
        sent++;
      } catch (error) {
        remaining.push(event);
      }
    }
    setQueue(remaining);
    return { sent: sent, remaining: remaining.length };
  };

  // Offline- oder Auth-Fehler werden bei der nächsten brauchbaren Gelegenheit
  // erneut versucht. Die Queue bleibt bewusst nur in der Sitzung, damit keine
  // Kundinnendaten dauerhaft unverschlüsselt im Browser gespeichert werden.
  window.addEventListener('online', function () {
    window.scFlushAiEvents().catch(function () {});
  });
  window.addEventListener('sc:login', function () {
    setTimeout(function () { window.scFlushAiEvents().catch(function () {}); }, 500);
  });
  setTimeout(function () { window.scFlushAiEvents().catch(function () {}); }, 1000);
})();
