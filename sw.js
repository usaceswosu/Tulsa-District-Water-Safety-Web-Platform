// Bobber offline shell. Registered from main.js with the current asset version.
const version = new URL(self.location.href).searchParams.get("v") || "v1";
const SHELL_CACHE = `bobber-shell-${version}`;
const RUNTIME_CACHE = `bobber-runtime-${version}`;
const LEGACY_RUNTIME_CACHE = "bobber-runtime";
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

// CacheStorage is shared by every project on the origin, so only remove this
// site's own old caches.
function isSiteCache(key) {
  return key.startsWith("bobber-shell-") ||
    key === LEGACY_RUNTIME_CACHE ||
    key.startsWith("bobber-runtime-");
}

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
    await Promise.all(keys
      .filter((key) => isSiteCache(key) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)));
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

async function matchCached(request, options) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request, options);
  if (cached) return cached;
  if (!(await caches.has(RUNTIME_CACHE))) return undefined;
  const runtime = await caches.open(RUNTIME_CACHE);
  return runtime.match(request, options);
}

async function networkFirst(request, event) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(request, copy);
        } catch {
          // Cache quota failures should not break the response.
        }
      })());
    }
    return response;
  } catch {
    return (await matchCached(request, { ignoreSearch: true })) ||
      (await (await caches.open(SHELL_CACHE)).match(FALLBACK)) ||
      new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request, event) {
  const cached = await matchCached(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(request, copy);
          await trimCache(RUNTIME_CACHE, 160);
        } catch {
          // Cache quota failures should not break the response.
        }
      })());
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function staleWhileRevalidate(request, event) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      try { await shell.put(request, response.clone()); } catch { /* quota */ }
    }
    return response;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(pdf|zip)$/i.test(url.pathname) || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, event));
    return;
  }
  if (/\.(css|js|mjs|wasm|webmanifest|bcmap)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, event));
    return;
  }
  if (/\.(webp|png|jpe?g|gif|svg|ico|avif|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
