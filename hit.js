/* Visit counter for dcreations.fr: one anonymous beacon per page view to our own /api/hit
   (Worker dcreations-visit-stats, see visit-stats/README.md). No cookie, nothing stored on the
   device, no third party. Sends: page path, referring page, browser language, ?utm_source tag.
   Not sent on other hosts, for automated browsers, when the browser asks not to be tracked
   (Global Privacy Control / Do Not Track), or on a browser where /stats/ turned counting off. */
(function () {
  var n = navigator;
  if (n.webdriver || n.globalPrivacyControl === true || n.doNotTrack === '1' || window.doNotTrack === '1') return;
  var api = location.hostname === 'dcreations.fr' ? '/api/hit' : '';
  try {
    if (localStorage.getItem('dc-nostats') === '1') return;
    api = localStorage.getItem('dc-stats-dev') || api; // local testing only
  } catch (e) {}
  if (!api) return;
  var src = '';
  try { src = new URLSearchParams(location.search).get('utm_source') || ''; } catch (e) {}
  var body = JSON.stringify({ p: location.pathname, r: document.referrer, l: (n.language || '').slice(0, 2), s: src });
  try {
    if (n.sendBeacon && n.sendBeacon(api, new Blob([body], { type: 'text/plain' }))) return;
  } catch (e) {}
  try { fetch(api, { method: 'POST', body: body, keepalive: true, credentials: 'omit' }); } catch (e) {}
})();
