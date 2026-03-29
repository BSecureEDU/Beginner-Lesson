// Bitcoin Education — Service Worker
// Provides offline caching so the PWA works without internet after first load
// Auto-reloads clients when a new version is deployed

const CACHE_NAME = 'btc-edu-v11';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install: pre-cache all core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // Activate immediately — don't wait for old SW to die
    self.skipWaiting();
});

// Activate: clean up old caches, then tell all open tabs to reload
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => {
            // Notify all open tabs/windows that a new version is live
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SW_UPDATED' });
                });
            });
        })
    );
    // Take control of all open tabs immediately
    self.clients.claim();
});

// Fetch: network-first for HTML (always get latest), cache-first for assets
self.addEventListener('fetch', event => {
    const request = event.request;

    // HTML pages: try network first so updates show immediately
    if (request.destination === 'document' || request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then(networkResponse => {
                // Cache the fresh copy for offline use
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline — serve cached HTML
                return caches.match(request).then(cached => cached || caches.match('./index.html'));
            })
        );
        return;
    }

    // Everything else (icons, manifest, etc.): cache-first for speed
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // Silent fail for non-critical assets
        })
    );
});
