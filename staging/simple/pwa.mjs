const status=document.getElementById('offline-status');
if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>{status.textContent='Offline notice available. Calculations require a fresh online rule snapshot.';}).catch(()=>{status.textContent='Offline notice unavailable in this browser.';});
}else status.textContent='Offline notice unavailable in this browser.';
