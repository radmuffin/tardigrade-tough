/**
 * Tardigrade Tough - Service Worker
 * Provides offline caching, instantaneous loads (Stale-While-Revalidate),
 * and offline fallback for SPA routing.
 */

const CACHE_NAME = 'tardigrade-tough-v14';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.css',
  '/css/base.css',
  '/css/header.css',
  '/css/diorama.css',
  '/css/workouts.css',
  '/css/leaderboard.css',
  '/css/activity.css',
  '/css/trophy.css',
  '/css/modals.css',
  '/css/toasts.css',
  '/css/footer.css',
  '/app.js',
  '/js/state.js',
  '/js/navigation.js',
  '/js/leaderboard.js',
  '/js/workouts.js',
  '/js/activity-feed.js',
  '/js/trophy.js',
  '/js/modals.js',
  '/js/modals/sheet-importer.js',
  '/js/modals/activity-edit.js',
  '/js/modals/custom-quest.js',
  '/js/modals/wishlist.js',
  '/js/modals/share-modal.js',
  '/js/modals/about-modal.js',
  '/js/modals/hub.js',
  '/js/realtime.js',
  '/js/reaction-toast.js',
  '/js/pwa.js',
  '/canvas-art.js',
  '/offline-sync.js',
  '/_fly/fly-base.css',
  '/_fly/fly-device-sync.js',
  '/_fly/fly-ui.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/icon-32.png'
];

// Install: Precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use allSettled so one optional missing asset doesn't abort caching the rest
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Warning: Failed to precache ${asset}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignore non-GET, WebSockets, and non-http(s) requests
  if (
    request.method !== 'GET' ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // 2. SPA Navigation requests (e.g. /, /r/:room)
  // Network-first with cache fallback to /index.html for offline room loading
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 3. API requests (/api/*)
  // Network-first with cache fallback (for read endpoints)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4. Critical App Scripts & Styles (.css, .js)
  // Network-First with cache fallback so fresh updates apply immediately without stale locks
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(url.pathname);
        })
    );
    return;
  }

  // 5. Static Media Assets (Images, SVG, Icons, Fonts)
  // Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failure while revalidating is okay if we have cached response
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for message events (e.g. SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
