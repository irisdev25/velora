const CACHE_NAME = 'velora-v1';
const ASSETS = [
  '/',
  '/pages/index.html',
  '/css/style.css',
  '/assets/favicon.png'
];

// Función para limpiar respuestas redireccionadas antes de guardarlas en caché
const cleanResponse = async (response) => {
  if (!response.redirected) {
    return response;
  }
  
  // Recreamos la respuesta para limpiar el flag "redirected" y evitar fallos de red en el navegador
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = ASSETS.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Fallo al descargar ${url}: ${response.statusText}`);
          }
          const cleaned = await cleanResponse(response);
          return cache.put(url, cleaned);
        } catch (err) {
          console.warn(`No se pudo cachear ${url} durante la instalación:`, err);
        }
      });
      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
