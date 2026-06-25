/* 小桃記帳本 PWA Service Worker
 * 策略（重要）：
 *  - 本站檔案（HTML / manifest / icons / JS）→ 「網路優先」：只要有網路就拿最新版，
 *    離線時才退回快取。→ 解決「已更新但手機/瀏覽器還顯示舊版」的問題。
 *  - 跨網域 CDN 套件（Tailwind/Vue/Supabase JS…）→ 快取優先（穩定、檔案大）。
 *  - Supabase / Gemini / 即時 API → 永遠走網路，不快取。
 * 改版時把 CACHE_NAME 版本號 +1，舊快取會自動清除。
 */
const CACHE_NAME = 'travel-ledger-v38';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3.4.27/dist/vue.global.prod.js',
  'https://unpkg.com/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase 資料 / AI / 即時匯率 / 天氣 / 商品條碼：不快取，永遠走網路
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname === 'generativelanguage.googleapis.com' ||
      url.hostname === 'open.er-api.com' ||
      url.hostname === 'api.open-meteo.com' ||
      url.hostname === 'ipapi.co' ||
      url.hostname === 'api.bigdatacloud.net' ||
      url.hostname.endsWith('openfoodfacts.org')) {
    return; // 交給瀏覽器預設處理
  }

  // 本站檔案：網路優先（拿最新），離線才退回快取
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // 跨網域 CDN 套件：快取優先（沒有才抓網路並存入）
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return resp;
    }))
  );
});
