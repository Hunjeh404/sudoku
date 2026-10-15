// 서비스워커: 그림·음악·데이터·해시된 빌드 파일은 기기에 저장해 두고(캐시 우선),
// 화면 틀(index.html)과 서버 요청(supabase)은 항상 네트워크로 받는다.
const VERSION = 'v10'; // v10: 테마판 구역 상징 무늬 없앰
const ASSET_CACHE = `olympus-assets-${VERSION}`;

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('olympus-') && k !== ASSET_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const p = url.pathname.slice(scope.length);
  const cacheable = p.startsWith('assets/') || p.startsWith('data/');
  if (!cacheable) return; // index.html 등은 브라우저 기본 동작
  e.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
    const hit = await cache.match(e.request);
    // 데이터(json)는 캐시를 먼저 보여 주고 뒤에서 새로 받아 둔다
    if (hit && p.startsWith('data/')) {
      fetch(e.request).then((r) => r.ok && cache.put(e.request, r.clone())).catch(() => {});
      return hit;
    }
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && res.status === 200) cache.put(e.request, res.clone());
    return res;
  }));
});
