// Intentionally does nothing beyond passing requests through: this app talks
// to a live API and has no offline story, so there's nothing worth caching.
// Its only job is to exist - some browsers (notably Chrome on Android) only
// offer the "Add to Home Screen" install prompt for a page controlled by a
// service worker with a fetch handler, regardless of what that handler does.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
