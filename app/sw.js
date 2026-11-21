/* 开心连连看 Service Worker：全部资源网络优先，取不到才回落缓存（离线可用）。
 *
 * 为什么要全网络优先：
 *   旧版把 index.html / style.css 等设为"缓存优先"，而 fetch 在联网时永远成功，
 *   于是缓存永不更新——已安装 PWA 的玩家会永久停在旧页面，改 HTML 结构或样式
 *   他们永远看不到。本站部署延迟最多 2 分钟，网络优先的开销可以忽略。
 *
 * 发版约定：每次发布同时递增此处的 CACHE 与 main.js 里的 BUILD。
 * 缓存名变化会在 activate 时清掉所有旧缓存，避免新旧代码混跑。
 */
const CACHE = "llk-v25";
const ASSETS = [
  "./",
  "./index.html",
  "./src/style.css",
  "./src/main.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 网络优先：先向服务器要最新内容并顺手更新缓存；失败（离线/服务不可用）再回落缓存。 */
async function networkFirst(req){
  try{
    const res = await fetch(req);
    // 只缓存本站同源的成功响应，避免缓存 opaque/错误响应
    if(res && res.ok && res.type === "basic"){
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  }catch(err){
    const cached = await caches.match(req);
    if(cached) return cached;
    // 导航请求的兜底：任意离线页面都回落到 index.html
    if(req.mode === "navigate") return caches.match("./index.html");
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if(req.method !== "GET") return;
  // 只接管同源请求；跨源资源交给浏览器默认处理
  if(new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});
