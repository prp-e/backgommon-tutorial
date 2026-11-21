'use strict';

const PREFIX = 'takhteh-khaneh-';
const CACHE = PREFIX + 'v1';
const APP_FILES = [
  './', './index.html', './style.css', './rules.js', './lessons.js', './game.js',
  './manifest.webmanifest', './assets/ivory.png', './assets/walnut.png',
  './assets/board.jpg', './assets/fonts/Vazirmatn.woff2',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./');
      return Response.error();
    }
  })());
});
