/*
 * Trooquiz shared header.
 * Add <script src="js/nav.js"></script> (or ../js/nav.js inside /admin) to the <head>
 * of every page. It applies the saved theme straight away, then builds the menu.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var base = new URL('../', script.src).href;       // site root, works on GitHub Pages sub-paths
  var html = document.documentElement;
  var THEME_KEY = 'trooquiz:theme';

  var PATHS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    admin: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h11"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      PATHS[name] + '</svg>';
  }

  var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0056d2"/>' +
    '<path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- theme (applied immediately to avoid a flash) ---------- */

  function savedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') html.setAttribute('data-theme', t);
    else html.removeAttribute('data-theme');
  }
  function isDark() {
    var t = html.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  applyTheme(savedTheme());

  /* ---------- font ---------- */

  [['preconnect', 'https://fonts.googleapis.com'], ['preconnect', 'https://fonts.gstatic.com']].forEach(function (pair) {
    var l = document.createElement('link');
    l.rel = pair[0];
    l.href = pair[1];
    if (pair[1].indexOf('gstatic') !== -1) l.crossOrigin = '';
    document.head.appendChild(l);
  });
  var fontCss = document.createElement('link');
  fontCss.rel = 'stylesheet';
  fontCss.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(fontCss);

  /* ---------- favicon ---------- */

  if (!document.querySelector('link[rel~="icon"]')) {
    var fav = document.createElement('link');
    fav.rel = 'icon';
    fav.type = 'image/svg+xml';
    fav.href = 'data:image/svg+xml,' + encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    document.head.appendChild(fav);
  }

  /* ---------- public bits other scripts can use ---------- */

  var account = null;
  var built = false;

  window.Nav = {
    // Set to a message while a quiz is running; leaving then asks for confirmation
    guard: null,
    // Used by the admin dashboard to show who is signed in and a log-out button
    setAccount: function (email, onLogout) {
      account = { email: email, onLogout: onLogout };
      if (built) paintAccount();
    }
  };

  function paintAccount() {
    var list = document.getElementById('nav-list');
    if (!list || !account) return;
    list.querySelectorAll('.nav-account').forEach(function (n) { n.remove(); });

    var who = document.createElement('li');
    who.className = 'nav-account nav-email';
    who.textContent = account.email;
    who.title = account.email;

    var out = document.createElement('li');
    out.className = 'nav-account';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nav-item';
    b.innerHTML = icon('logout') + '<span>Log out</span>';
    b.addEventListener('click', account.onLogout);
    out.appendChild(b);

    list.appendChild(who);
    list.appendChild(out);
  }

  /* ---------- build the header and footer ---------- */

  function build() {
    var path = location.pathname;
    var file = path.split('/').pop() || 'index.html';
    var inAdmin = path.indexOf('/admin/') !== -1;

    var items = [
      { label: 'Home', href: base + 'index.html', icon: 'home', active: !inAdmin && file === 'index.html' },
      { label: 'Take a quiz', href: base + 'start.html', icon: 'quiz', active: file === 'start.html' || file === 'quiz.html' }
    ];
    items.push({ label: 'Admin', href: base + (inAdmin ? 'admin/dashboard.html' : 'admin/login.html'), icon: 'admin', active: inAdmin });

    var links = items.map(function (it) {
      return '<li><a href="' + it.href + '"' + (it.active ? ' aria-current="page"' : '') + '>' +
        icon(it.icon) + '<span>' + it.label + '</span>' + '</a></li>';
    }).join('');

    var header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="site-header-inner">' +
        '<a class="brand" href="' + base + 'index.html">' + LOGO + '<span>Trooquiz</span></a>' +
        '<a class="home-quick" href="' + base + 'index.html">' + icon('home') + '<span>Home</span></a>' +
        '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">' +
          icon('menu') + '</button>' +
        '<nav id="site-nav" class="site-nav" aria-label="Main menu"><ul id="nav-list">' + links +
          '<li><button type="button" class="nav-item" id="theme-btn"></button></li>' +
        '</ul></nav>' +
      '</div>';
    document.body.insertBefore(header, document.body.firstChild);

    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = '<span>&copy; ' + new Date().getFullYear() + ' Trooquiz</span>';
    document.body.appendChild(footer);

    /* theme button */
    var themeBtn = document.getElementById('theme-btn');
    function paintTheme() {
      var dark = isDark();
      themeBtn.innerHTML = icon(dark ? 'sun' : 'moon') + '<span>' + (dark ? 'Light mode' : 'Dark mode') + '</span>';
    }
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      applyTheme(next);
      paintTheme();
    });
    paintTheme();

    /* mobile menu */
    var toggle = header.querySelector('.nav-toggle');
    var nav = header.querySelector('.site-nav');
    function setOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.innerHTML = icon(open ? 'close' : 'menu');
    }
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) setOpen(false); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });

    /* ask before leaving a quiz that is in progress */
    function guardClick(e) {
      var a = e.target.closest('a');
      if (!a || !window.Nav.guard) return;
      if (confirm(window.Nav.guard)) window.Nav.guard = null;
      else e.preventDefault();
    }
    header.addEventListener('click', guardClick);
    footer.addEventListener('click', guardClick);

    /* soft shadow once the page scrolls */
    function onScroll() { header.classList.toggle('scrolled', window.scrollY > 4); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    built = true;
    paintAccount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();