/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `spark-builder-${version}`;
const ASSETS = [...build, ...files];

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => worker.clients.claim()));
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== worker.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
