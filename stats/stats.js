/* Visit Stats dashboard (dcreations.fr/stats/). Data from the Worker dcreations-visit-stats, see
   visit-stats/README.md. The token lives in this browser's localStorage only. */
(function () {
  var API = '/api/stats';
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  // Local testing only: localStorage['dc-stats-api'] = 'http://127.0.0.1:8788/api/stats'. Ignored on the real site,
  // so the token can never be sent anywhere else.
  if (local) API = get('dc-stats-api') || API;

  var $ = function (id) { return document.getElementById(id); };
  var days = parseInt(get('dc-stats-days') || '30', 10) || 30;
  var timer = null;
  var nf = new Intl.NumberFormat('en-GB');
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  var langNames = null;
  try { langNames = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) {}

  function flag(cc) {
    if (!/^[A-Z]{2}$/.test(cc)) return '🌐';
    return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65);
  }
  function country(cc) {
    if (cc === '??') return '🌐 Unknown';
    var name = cc; try { name = regionNames ? regionNames.of(cc) : cc; } catch (e) {}
    return flag(cc) + ' ' + esc(name);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function showLogin(msg) {
    $('dash').hidden = true; $('tools').hidden = true; $('login').hidden = false;
    $('loginErr').textContent = msg || '';
    $('token').focus();
  }

  function load() {
    var token = get('dc-stats-token');
    if (!token) return showLogin('');
    clearTimeout(timer);
    fetch(API + '?days=' + days, { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) { set('dc-stats-token', null); throw new Error('auth'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        $('login').hidden = true; $('dash').hidden = false; $('tools').hidden = false;
        render(data);
        schedule();
      })
      .catch(function (e) {
        if (e.message === 'auth') return showLogin('Wrong token.');
        if (!$('dash').hidden) { $('updated').textContent = 'Could not refresh (' + e.message + '), retrying in a minute'; schedule(); }
        else showLogin('Could not reach the counter (' + e.message + ').');
      });
  }

  // Refresh every minute while the tab is visible (the Worker caches reports for a minute anyway).
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { if (document.hidden) schedule(); else load(); }, 60000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('dash').hidden) load(); });

  // previous = the same number of days just before; null when those days are no longer kept.
  // Not shown for "Today": a day in progress against a full yesterday says nothing.
  function delta(el, now, before, n) {
    el.className = 'delta';
    if (before === null || n === 1) { el.textContent = '\u00a0'; return; }
    var span = n + ' days before';
    if (!before) { el.textContent = now > 0 ? 'none in the ' + span : '\u00a0'; return; }
    var pct = Math.round((now - before) / before * 100);
    el.textContent = (pct > 0 ? '+' : '') + pct + '% vs the ' + span;
    el.classList.add(pct > 0 ? 'up' : pct < 0 ? 'down' : 'same');
  }

  function list(id, rows, label, showViews) {
    var el = $(id);
    if (!rows.length) { el.innerHTML = '<li class="empty">No visits yet</li>'; return; }
    var max = rows[0].visitors || 1;
    el.innerHTML = rows.map(function (r) {
      var w = Math.max(2, Math.round(r.visitors / max * 100));
      var n = '<b>' + nf.format(r.visitors) + '</b>' + (showViews ? ' · ' + nf.format(r.views) : '');
      return '<li title="' + esc(r.k) + ': ' + r.visitors + ' visitors, ' + r.views + ' views"><span class="fill" style="width:' + w + '%"></span><span class="k">' + label(r.k) + '</span><span class="n">' + n + '</span></li>';
    }).join('');
  }

  function chart(data) {
    var svg = $('chart');
    var hourly = data.days === 1;
    var pts = hourly
      ? data.hours.map(function (v, h) { return { label: String(h).padStart(2, '0') + 'h', views: v, visitors: null, tip: h + ':00 · ' + v + ' views' }; })
      : data.daily.map(function (d) { return { label: d.day, views: d.views, visitors: d.visitors, tip: d.day + ' · ' + d.visitors + ' visitors · ' + d.views + ' views' }; });
    $('chartTitle').firstChild.nodeValue = hourly ? 'Today per hour (Paris time) ' : 'Per day ';
    $('chartTitle').querySelector('.legend').innerHTML = (hourly ? '' : '<i style="background:var(--bar)"></i>visitors') + '<i style="background:var(--bar-2)"></i>page views';
    var W = svg.clientWidth || 800, H = 220, padL = 34, padB = 22, padT = 8;
    var max = Math.max(1, Math.max.apply(null, pts.map(function (p) { return p.views; })));
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var nice = Math.ceil(max / step) * step; if (nice / step > 5 && step > 1) nice = Math.ceil(max / (step * 2)) * step * 2;
    var cw = (W - padL) / pts.length, bw = Math.max(1, cw * 0.72);
    var y = function (v) { return padT + (H - padT - padB) * (1 - v / nice); };
    var out = [];
    for (var g = 0; g <= 4; g++) {
      var gv = nice * g / 4, gy = y(gv);
      out.push('<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/><text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + (gv % 1 ? gv.toFixed(1) : gv) + '</text>');
    }
    var every = Math.ceil(pts.length / Math.max(2, Math.floor(W / 70)));
    pts.forEach(function (p, i) {
      var x = padL + i * cw + (cw - bw) / 2;
      var s = '<g class="col"><title>' + esc(p.tip) + '</title><rect x="' + (padL + i * cw) + '" y="' + padT + '" width="' + cw + '" height="' + (H - padT - padB) + '" fill="transparent"/>';
      s += '<rect class="v" rx="2" x="' + x + '" y="' + y(p.views) + '" width="' + bw + '" height="' + (y(0) - y(p.views)) + '"/>';
      if (p.visitors !== null) s += '<rect class="u" rx="2" x="' + (x + bw * 0.2) + '" y="' + y(p.visitors) + '" width="' + (bw * 0.6) + '" height="' + (y(0) - y(p.visitors)) + '"/>';
      s += '</g>';
      if (i % every === 0) {
        var lbl = hourly ? p.label : (data.days > 90 ? p.label.slice(2, 7) : p.label.slice(5));
        s += '<text x="' + (padL + i * cw + cw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + lbl + '</text>';
      }
      out.push(s);
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = out.join('');
  }

  var lastData = null;
  function render(data) {
    lastData = data;
    $('range').textContent = data.from === data.to ? data.from + ' (Paris time)' : data.from + ' → ' + data.to + ' (Paris time)';
    $('kVisitors').textContent = nf.format(data.totals.visitors);
    $('kViews').textContent = nf.format(data.totals.views);
    $('kPpv').textContent = data.totals.pagesPerVisitor || '–';
    $('kLive').textContent = nf.format(data.live);
    delta($('dVisitors'), data.totals.visitors, data.previous && data.previous.visitors, data.days);
    delta($('dViews'), data.totals.views, data.previous && data.previous.views, data.days);
    setCounting(data.enabled);
    chart(data);
    var plain = function (k) { return esc(k); };
    list('pages', data.pages, plain, true);
    list('countries', data.countries, country);
    list('cities', data.cities, function (k) { var m = /, ([A-Z]{2})$/.exec(k); return (m ? flag(m[1]) + ' ' : '') + esc(k.replace(/, [A-Z]{2}$/, '')); });
    list('referrers', data.referrers, plain);
    list('devices', data.devices, plain);
    list('browsers', data.browsers, plain);
    list('os', data.os, plain);
    list('langs', data.langs, function (k) { if (k === '??') return 'Unknown'; try { return esc(langNames ? langNames.of(k) : k) + ' (' + k + ')'; } catch (e) { return esc(k); } });
    var tf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('recent').innerHTML = data.recent.length ? data.recent.map(function (r) {
      return '<tr><td>' + tf.format(r.ts) + '</td><td class="path" title="' + esc(r.path) + '">' + esc(r.path) + '</td><td>' + esc(r.ref || '(direct)') + '</td><td>' + flag(r.country) + ' ' + esc(r.city || r.country || '') + '</td><td>' + esc(r.device + ' · ' + r.browser) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No visits yet</td></tr>';
    $('updated').textContent = 'updated ' + new Date().toLocaleTimeString('en-GB');
  }

  function setCounting(on) {
    var b = $('counting');
    b.textContent = on ? 'Counter: on' : 'Counter: off';
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Click to stop counting visits on dcreations.fr (for everyone)' : 'Click to count visits again';
  }
  $('counting').addEventListener('click', function () {
    var on = $('counting').getAttribute('aria-pressed') !== 'true';
    var verb = on ? 'Turn the visit counter back ON' : 'Turn the visit counter OFF for everyone';
    if (!window.confirm(verb + '?')) return;
    fetch(API + '/enabled', {
      method: 'POST', cache: 'no-store',
      headers: { authorization: 'Bearer ' + get('dc-stats-token'), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: on }),
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { setCounting(d.enabled); })
      .catch(function (e) { $('updated').textContent = 'Could not switch the counter (' + e.message + ')'; });
  });

  function setTabs() {
    var b = document.querySelectorAll('.tabs button');
    for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', String(parseInt(b[i].getAttribute('data-days'), 10) === days));
  }
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-days]'); if (!b) return;
    days = parseInt(b.getAttribute('data-days'), 10); set('dc-stats-days', String(days)); setTabs(); load();
  });

  function setNoStats() {
    var off = get('dc-nostats') === '1';
    $('nostats').textContent = off ? 'Count my visits: off' : 'Count my visits: on';
    $('nostats').setAttribute('aria-pressed', String(off));
    $('nostats').title = off ? 'This browser is not counted on dcreations.fr' : 'Click so this browser is no longer counted';
  }
  $('nostats').addEventListener('click', function () { set('dc-nostats', get('dc-nostats') === '1' ? null : '1'); setNoStats(); });
  $('refresh').addEventListener('click', load);
  $('logout').addEventListener('click', function () { set('dc-stats-token', null); clearTimeout(timer); showLogin(''); });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); set('dc-stats-token', $('token').value.trim()); $('token').value = ''; load();
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (lastData) chart(lastData); }, 150); });

  // Opening the dashboard turns counting off for this browser the first time, so your own visits don't skew the numbers.
  if (get('dc-nostats') === null && get('dc-nostats-asked') === null) { set('dc-nostats', '1'); set('dc-nostats-asked', '1'); }
  setTabs(); setNoStats(); load();
})();
