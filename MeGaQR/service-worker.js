const CACHE_NAME = 'megaqr-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/scanner.html',
  '/accountant.html',
  '/test-qr-codes.html',
  '/css/styles.css',
  '/js/utils.js',
  '/js/app-state.js',
  '/js/scanner.js',
  '/js/accountant.js',
  '/js/pdf-generator.js',
  '/js/notifications.js',
  '/js/validators.js'
];

// Установка Service Worker
self.addEventListener('install', function(event) {
  console.log('🚀 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', function(event) {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Возвращаем кэшированную версию или делаем запрос
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});