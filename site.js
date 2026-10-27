/* Small shared script, no dependencies. Everything works without it:
   - hire/book switch: remembers the choice (?mode= and localStorage)
   - scroll reveal, GitHub counters, tools strip pause (off with reduced motion)
   - copy buttons on the contact page
   - remembers the language you read, for the root redirect */
(function () {
  var root = document.documentElement;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  store('lang', root.lang);

  function setMode(mode, push) {
    if (mode !== 'hire' && mode !== 'book') return;
    root.setAttribute('data-mode', mode);
    store('mode', mode);
    var links = document.querySelectorAll('.mode-switch a[data-mode]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-mode') === mode) links[i].setAttribute('aria-current', 'true');
      else links[i].removeAttribute('aria-current');
    }
    if (push && window.history && history.replaceState) {
      try {
        var url = new URL(location.href);
        url.searchParams.set('mode', mode);
        url.hash = '';
        history.replaceState(null, '', url.pathname + url.search);
      } catch (e) {}
    }
  }

  setMode(root.getAttribute('data-mode') || 'hire', false);

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('.mode-switch a[data-mode]');
    if (a) {
      ev.preventDefault();
      setMode(a.getAttribute('data-mode'), true);
      return;
    }
    var b = ev.target.closest && ev.target.closest('button[data-copy]');
    if (b) copy(b);
  });

  function copy(btn) {
    var text = btn.getAttribute('data-copy');
    var status = document.getElementById(btn.getAttribute('data-status') || '');
    function done() {
      if (status) {
        status.textContent = btn.getAttribute('data-done') || 'OK';
        setTimeout(function () { status.textContent = ''; }, 2500);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  // "Work" menu (<details>): close with Escape or a click outside.
  function closeMenus(except) {
    var m = document.querySelectorAll('details.nav-menu[open]');
    for (var k = 0; k < m.length; k++) if (m[k] !== except) m[k].open = false;
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var open = document.querySelector('details.nav-menu[open]');
    if (open) { open.open = false; var s = open.querySelector('summary'); if (s) s.focus(); }
  });
  document.addEventListener('click', function (ev) {
    var inside = ev.target.closest && ev.target.closest('details.nav-menu');
    closeMenus(inside);
  });

  var btns = document.querySelectorAll('button[data-copy]');
  for (var j = 0; j < btns.length; j++) btns[j].hidden = false;

  /* ---------- motion (all optional, off with reduced motion) ---------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // Scroll reveal: CSS scroll-driven animation where supported (global.css);
  // this IntersectionObserver is only the fallback. Sections already on screen
  // are marked first, so nothing blinks.
  var reveals = document.querySelectorAll('.reveal');
  var cssScroll = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  if (!reduce && hasIO && !cssScroll && reveals.length) {
    var vh = window.innerHeight, r;
    for (r = 0; r < reveals.length; r++) if (reveals[r].getBoundingClientRect().top < vh) reveals[r].classList.add('is-in');
    root.classList.add('reveal-on');
    var rio = new IntersectionObserver(function (en) {
      for (var e = 0; e < en.length; e++) if (en[e].isIntersecting) { en[e].target.classList.add('is-in'); rio.unobserve(en[e].target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (r = 0; r < reveals.length; r++) if (!reveals[r].classList.contains('is-in')) rio.observe(reveals[r]);
  }

  // Counters (GitHub numbers): count up once when seen. The real number is in the HTML.
  var counters = document.querySelectorAll('[data-count]');
  if (!reduce && hasIO && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      for (var c = 0; c < entries.length; c++) {
        if (!entries[c].isIntersecting) continue;
        cio.unobserve(entries[c].target);
        countUp(entries[c].target);
      }
    }, { threshold: 0.6 });
    for (var k2 = 0; k2 < counters.length; k2++) cio.observe(counters[k2]);
  }
  function countUp(el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    if (!(to > 0)) return;
    var t0 = null, dur = 1100;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Tools strip: pause button, pause when off screen (CSS handles hover/focus).
  var mq = document.querySelector('[data-marquee]');
  var toggle = document.querySelector('[data-marquee-toggle]');
  if (mq && !reduce) {
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        var paused = toggle.getAttribute('aria-pressed') !== 'true';
        toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
        toggle.setAttribute('aria-label', toggle.getAttribute(paused ? 'data-label-play' : 'data-label-pause'));
        mq.classList.toggle('is-paused', paused);
      });
    }
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        mq.classList.toggle('is-offscreen', !entries[0].isIntersecting);
      }).observe(mq);
    }
  }
})();
