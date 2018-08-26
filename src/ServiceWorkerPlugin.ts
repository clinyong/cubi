import * as webpack from "webpack";
import * as md5 from "md5";

const PLUGIN_NAME = "ServiceWorkerPlugin";

function genServiceWorkerFile(assets: string[]) {
  const assetsContent = assets.sort((a, b) => a.localeCompare(b)).join(",");
  const version = md5(assetsContent).slice(0, 10);

  return `
  const assetsToCache=${JSON.stringify(assets)};
  const CACHE_NAME = '${version}';

  self.addEventListener('install', event => {
    event.waitUntil(
        caches
        .open(CACHE_NAME)
        .then(cache => {
            return cache.addAll(assetsToCache)
        })
    )
  })

  self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => {
              if (cacheName.indexOf(CACHE_NAME) === 0) {
                return null
              }

              return caches.delete(cacheName)
            })
          )
        })
    )
  })

  self.addEventListener('fetch', event => {
      const request = event.request;
      if (request.method !== 'GET') {
          return;
      }

      const requestUrl = new URL(request.url);
      if (requestUrl.origin !== location.origin) {
          return;
      }

      const resource = caches.match(request).then(response => {
          if (response) {
              return response;
          }

          return fetch(request)
            .then(responseNetwork => {
                if (!responseNetwork || !responseNetwork.ok) {
                    return responseNetwork;
                }

                const responseCache = responseNetwork.clone();

                caches.open(CACHE_NAME).then(cache => {
                    return cache.put(request.responseCache)
                });

                return responseNetwork;
            })
      });

      event.respondWith(resource);
  })
  `;
}

export class ServiceWorkerPlugin {
  apply(compiler: webpack.Compiler) {
    compiler.hooks.emit.tap(PLUGIN_NAME, compilation => {
      const { assets } = compilation.getStats().toJson();
      const cacheAssets = assets
        .filter(item => item.name.endsWith("js") || item.name.endsWith("html"))
        .map(item => item.name);

      const content = genServiceWorkerFile(["./"].concat(cacheAssets));
      compilation.assets["sw.js"] = {
        source: () => content,
        size: () => content.length
      };
    });
  }
}
