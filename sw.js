/* ShowBoard Service Worker — Offline caching */

const CACHE_NAME = 'showboard-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api/tmdb.js',
  '/js/api/plex.js',
  '/js/pages/home.js',
  '/js/pages/discover.js',
  '/js/pages/activity.js',
  '/js/pages/settings.js',
  '/js/pages/details.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API calls
  if (url.hostname === 'api.themoviedb.org' || url.hostname === 'image.tmdb.org') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache images for offline
          if (url.hostname === 'image.tmdb.org' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
