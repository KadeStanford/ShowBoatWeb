const CACHE_NAME = 'showboat-v22';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css?v=10',
  '/js/firebase-config.js',
  '/js/api.js',
  '/js/services.js',
  '/js/badges.js',
  '/js/components.js',
  '/js/pages/auth.js',
  '/js/pages/home.js',
  '/js/pages/discover.js',
  '/js/pages/details.js',
  '/js/pages/watchlist.js',
  '/js/pages/profile.js',
  '/js/pages/social.js',
  '/js/pages/matcher.js',
  '/js/pages/analytics.js',
  '/js/pages/plex.js',
  '/js/pages/lists.js',
  '/js/pages/media.js',
  '/js/app.js',
  '/img/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Network-first for API calls and JS files, cache-first for other static assets
  if (url.hostname.includes('api.themoviedb.org') || url.hostname.includes('firestore.googleapis.com') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});
