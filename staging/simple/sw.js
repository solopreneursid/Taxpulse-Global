// Network-first navigation, no cache or stored calculator requests.
// Offline mode deliberately does not serve stale statutory calculations.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{try{return await fetch(request,{cache:'no-store'});}catch{return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxPulse is offline</title><h1>TaxPulse is offline</h1><p>Reconnect to load the current preview rules. No tax calculations are available offline, because regulatory data may have changed.</p><p>Encrypted local examples remain on this device. No information was uploaded.</p><p><a href="/">Retry connection</a></p></html>',{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}})());
});
