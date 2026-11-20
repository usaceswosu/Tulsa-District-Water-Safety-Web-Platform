// Bobber offline shell. Registered from main.js with the current asset version.
const version = new URL(self.location.href).searchParams.get("v") || "v1";
const SHELL_CACHE = `bobber-shell-${version}`;
const RUNTIME_CACHE = "bobber-runtime";
const FALLBACK = new URL("./index.html", self.registration.scope).href;
const CORE = [
  "./",
  "./index.html",
  "./grown-ups.html",
  "./accessibility.html",
  "./poster.html",
  "./404.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    let list = [];
    try {
      list = await (await fetch("./precache.json", { cache: "no-store" })).json();
    } catch {
      // Fall back to the core pages if the generated list is unavailable.
    }
    const urls = [...new Set([...CORE, ...(Array.isArray(list) ? list : [])])]
      .map((url) => new URL(url, self.registration.scope).href);
    await Promise.allSettled(urls.map((url) => cache.add(url)));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ||
      (await caches.match(FALLBACK)) ||
      new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, 160);
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, 160);
    }
    return response;
  }).catch(() => null);
  return cached || network || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(pdf|zip)$/i.test(url.pathname) || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/\.(css|js|mjs|wasm|webmanifest|bcmap)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (/\.(webp|png|jpe?g|gif|svg|ico|avif|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
