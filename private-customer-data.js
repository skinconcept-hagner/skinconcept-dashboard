// Geschützte Ablage der früher statisch ausgelieferten Trello-/Treatwell-Exporte.
// Die Dokumente in `studio_private` dürfen laut Firestore-Regeln ausschließlich
// vom angemeldeten Studio-Konto gelesen werden.
(function (global) {
  'use strict';

  var loadPromise = null;
  var STUDIO_EMAIL = 'skinconcept.hagner@gmail.com';

  function toolApp() {
    if (!global.firebase || !firebase.apps) return null;
    for (var i = 0; i < firebase.apps.length; i++) {
      var options = firebase.apps[i].options || {};
      if (options.projectId === 'skinconcept-tool') return firebase.apps[i];
    }
    return null;
  }

  function studioSignedIn(app) {
    try {
      var user = app.auth && app.auth().currentUser;
      return !!(user && user.email === STUDIO_EMAIL);
    } catch (e) {
      return false;
    }
  }

  function readItems(doc, label) {
    if (!doc.exists) throw new Error(label + ' fehlt in der geschützten Ablage.');
    var items = doc.data() && doc.data().items;
    if (!Array.isArray(items)) throw new Error(label + ' hat ein ungültiges Format.');
    return items;
  }

  function scLoadPrivateCustomerData() {
    if (loadPromise) return loadPromise;

    loadPromise = Promise.resolve().then(function () {
      var app = toolApp();
      if (!app) throw new Error('Firebase-Projekt skinconcept-tool ist nicht initialisiert.');
      if (!studioSignedIn(app)) throw new Error('Studio-Anmeldung fehlt. Kundendaten werden nicht geladen.');

      var firestore = app.firestore();
      return Promise.all([
        firestore.collection('studio_private').doc('legacy_trello_customers').get(),
        firestore.collection('studio_private').doc('legacy_treatwell_contacts').get()
      ]);
    }).then(function (docs) {
      global.alleKunden = readItems(docs[0], 'Trello-Kunden');
      global.TW_CONTACTS = readItems(docs[1], 'Treatwell-Kontakte');
      return { trello: global.alleKunden.length, treatwell: global.TW_CONTACTS.length };
    }).catch(function (error) {
      loadPromise = null;
      throw error;
    });

    return loadPromise;
  }

  global.scLoadPrivateCustomerData = scLoadPrivateCustomerData;
})(window);
