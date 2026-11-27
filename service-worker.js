'use strict';

const PREFIX = 'takhteh-khaneh-';
const CACHE = PREFIX + 'v7';
const APP_FILES = [
  './', './index.html', './style.css', './rules.js', './opponent.js', './reference-v6.js', './game-v7.js',
  './manifest.webmanifest', './assets/ivory.png', './assets/walnut.png',
  './assets/board.jpg', './assets/fonts/Vazirmatn.woff2',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES.map(file => new Request(file, { cache: 'reload' })));
    await self.skipWaiting();
  })());
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
    if (request.mode !== 'navigate') {
      const cached = await cache.match(request);
      if (cached) return cached;
      return fetch(request);
    }
    try {
      return await fetch(request, { cache: 'no-cache' });
    } catch {
      return (await cache.match('./')) || Response.error();
    }
  })());
});
