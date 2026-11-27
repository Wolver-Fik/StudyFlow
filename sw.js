/* StudyFlow — service worker.
   HTML: Network-First con respaldo en caché. Recursos: caché primero con
   revalidación silenciosa. Instalación inmediata y control de clientes. */
(function () {
  'use strict';

  /* Etapa 2: sube la version con cada cambio. activate solo purga CacheStorage;
     nunca borra IndexedDB (studyflow_db) ni localStorage. */
  var CACHE = 'studyflow-v1.3.4';
  var VERSION = CACHE;
  var SCOPE = self.registration.scope;
  function abs(p) { return new URL(p, SCOPE).href; }
  var INDEX = abs('./index.html');
  var CORE = [
    './', './index.html', './manifest.webmanifest', './css/styles.css',
    './js/i18n.js', './js/i18n/i18n.js', './js/i18n/en.js', './js/i18n/es.js',
    './js/i18n/pt.js', './js/i18n/fr.js', './js/i18n/it.js',
    './js/i18n/de.js', './js/i18n/ru.js', './js/i18n/ja.js',
    './js/storage.js', './js/curricula.js', './js/ios-install.js', './js/app.js',
    './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
  ].map(abs);

  self.addEventListener('install', function (ev) {
    ev.waitUntil(
      caches.open(VERSION)
        .then(function (c) { return c.addAll(CORE); })
        .then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (ev) {
    ev.waitUntil(
      caches.keys().then(function (keys) {
        /* Elimina studyflow-v1 y cualquier otra caché obsoleta. */
        return Promise.all(keys.filter(function (k) { return k.indexOf('studyflow-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  /* Devuelve la promesa de escritura para poder pasarla a waitUntil. El clone
     se toma aquí, antes de que la respuesta se entregue a la página. */
  function put(url, response) {
    if (!response || !response.ok || response.type === 'opaque') return Promise.resolve();
    return caches.open(VERSION).then(function (c) { return c.put(url, response.clone()); });
  }

  self.addEventListener('fetch', function (ev) {
    var req = ev.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    /* La geolocalización por IP va siempre a la red: nunca se cachea ni se
       intercepta, para que la detección funcione con datos frescos. */
    if (url.hostname === 'ipwho.is' || url.hostname === 'ipapi.co' || url.hostname === 'www.ipapi.co') return;
    if (url.origin !== self.location.origin) return;

    var isHTML = req.mode === 'navigate' || String(req.headers.get('accept') || '').indexOf('text/html') >= 0;
    var cacheWrite = Promise.resolve();
    var responsePromise;

    if (isHTML) {
      responsePromise = fetch(req).then(function (res) {
        cacheWrite = put(INDEX, res);
        return res;
      }).catch(function () {
        return caches.match(INDEX).then(function (r) { return r || caches.match(CORE[0]); });
      });
    } else {
      responsePromise = caches.match(req).then(function (cached) {
        if (cached) {
          cacheWrite = fetch(req).then(function (res) { return put(req.url, res); }).catch(function () {});
          return cached;
        }
        return fetch(req).then(function (res) {
          cacheWrite = put(req.url, res).catch(function () {});
          return res;
        });
      });
    }

    /* waitUntil se registra durante la descarga del evento (llamarlo dentro de
       un .then sería demasiado tarde) y mantiene el worker vivo hasta que la
       escritura en caché termine, sin retrasar la respuesta. */
    ev.waitUntil(responsePromise.then(function () { return cacheWrite; }).catch(function () {}));
    ev.respondWith(responsePromise);
  });

  self.addEventListener('message', function (ev) {
    var data = ev.data;
    if (data === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (data && data.type === 'VERSION' && ev.ports && ev.ports[0]) {
      ev.ports[0].postMessage({ version: VERSION });
      return;
    }
    if (data && data.type === 'CLEAR_CACHES') {
      ev.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf('studyflow-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      }));
    }
  });
})();
