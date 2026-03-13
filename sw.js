const CACHE_NAME = 'showboat-v84';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css?v=30',
  '/js/firebase-config.js',
  '/js/api.js',
  '/js/services.js',
  '/js/badges.js',
  '/js/components.js',
  '/js/animations.js',
  '/js/native.js',
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
  '/js/pages/history.js',
  '/js/pages/settings.js',
  '/js/tour.js',
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

  // Skip Firebase Storage — let browser handle CORS directly
  if (url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('storage.googleapis.com')) return;

  // Skip Firestore & Firebase auth — always network
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('identitytoolkit.googleapis.com') || url.hostname.includes('securetoken.googleapis.com')) return;

  // TMDB API: stale-while-revalidate (serve from cache instantly, refresh in background)
  if (url.hostname.includes('api.themoviedb.org')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // TMDB images: cache-first (images don't change)
  if (url.hostname.includes('image.tmdb.org')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // App JS & CSS: stale-while-revalidate (fast load + background refresh)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        // Serve from cache immediately; refresh in background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: cache-first with network fallback
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
