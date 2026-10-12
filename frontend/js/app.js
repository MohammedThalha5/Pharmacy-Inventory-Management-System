'use strict';
/* ============================================================
   App shell: sign-in, navigation and routing
   ============================================================ */
const LOGO = (size = 38) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><g transform="rotate(-45 16 16)"><rect x="2" y="9" width="28" height="14" rx="7" fill="#14956F"/><path d="M16 9h7a7 7 0 0 1 0 14h-7z" fill="#F2F6F4"/></g></svg>`;

const ROUTES = {
  dashboard: { fn: pageDashboard, icon: 'dashboard', label: 'Dashboard' },
  inventory: { fn: pageInventory, icon: 'pill', label: 'Inventory' },
  batches:   { fn: pageBatches,   icon: 'calendar', label: 'Batches & expiry', badge: true },
  pos:       { fn: pagePOS,       icon: 'cart', label: 'New sale' },
  sales:     { fn: pageSales,     icon: 'receipt', label: 'Sales history' },
  purchases: { fn: pagePurchases, icon: 'truck', label: 'Purchases' },
  suppliers: { fn: pageSuppliers, icon: 'users', label: 'Suppliers' },
};

/* ---------- Sign in ---------- */
function renderLogin() {
  document.body.classList.remove('nav-open');
  const caps = [
    ['2%', '62%', 240, -35, '#14956F'], ['34%', '72%', 200, 24, '#8FBDB1'], ['62%', '52%', 280, -58, '#1D5E55'],
    ['76%', '-4%', 220, 35, '#14956F'], ['12%', '26%', 150, 40, '#B5E3D0'],
  ].map(([top, left, w, rot, c]) => `<i style="top:${top};left:${left};width:${w}px;transform:rotate(${rot}deg);background:${c}"></i>`).join('');
  $('#app').innerHTML = `
    <div class="login">
      <section class="login-art">
        <div class="login-caps" aria-hidden="true">${caps}</div>
        <div class="brand" style="position:relative">${LOGO(42)}<div>Medstock<small>Pharmacy inventory</small></div></div>
        <div style="position:relative"><h1>Know what is on every shelf.</h1>
          <p>Track stock, catch expiries before they cost you, and bill customers in seconds.</p></div>
        <div style="position:relative;color:var(--pine-300);font-size:13px">Stock is sold earliest-expiry first, automatically.</div>
      </section>
      <section class="login-form-wrap">
        <form class="login-card" id="login" novalidate>
          <h2>Sign in</h2>
          <p class="sub">Use your pharmacy staff account.</p>
          <div class="field"><label for="u">Username</label><input class="input" id="u" name="username" autocomplete="username" autofocus required></div>
          <div class="field"><label for="p">Password</label><input class="input" id="p" name="password" type="password" autocomplete="current-password" required></div>
          <div class="form-error" role="alert"></div>
          <button class="btn btn-lg btn-block" type="submit">Sign in</button>
          <p class="login-hint">First time here? Sign in as <b>admin</b> with the password set in <code>backend/.env</code> (default <b>admin123</b>).</p>
        </form>
      </section>
    </div>`;
  const form = $('#login');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form); err.textContent = '';
    if (!form.username.value.trim() || !form.password.value) { err.textContent = 'Enter your username and password.'; return; }
    try {
      const res = await busy($('button', form), () => api('/auth/login', { method: 'POST', body: { username: form.username.value, password: form.password.value } }));
      state.token = res.token; state.user = res.user;
      localStorage.setItem('medstock_token', res.token);
      localStorage.setItem('medstock_user', JSON.stringify(res.user));
      location.hash = '#/dashboard';
      startApp();
    } catch (ex) { err.textContent = ex.message; }
  });
}

function signOut() {
  state.token = null; state.user = null;
  localStorage.removeItem('medstock_token'); localStorage.removeItem('medstock_user');
  renderLogin();
}

/* ---------- Shell ---------- */
function renderShell() {
  const u = state.user || {};
  $('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="brand">${LOGO()}<div>Medstock<small>Pharmacy inventory</small></div></div>
        <nav class="nav">
          ${Object.entries(ROUTES).map(([key, r]) => `
            <a href="#/${key}" data-route="${key}">${icon(r.icon, 20)}<span>${r.label}</span>${r.badge ? '<span class="badge" id="nav-badge" hidden></span>' : ''}</a>`).join('')}
        </nav>
        <div class="me">
          <div class="avatar" aria-hidden="true">${esc((u.name || '?').charAt(0).toUpperCase())}</div>
          <div class="who"><b>${esc(u.name || '')}</b><span>${esc(u.role || '')}</span></div>
          <button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu" aria-label="Open menu">${icon('menu', 22)}</button>
          <span class="date">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span class="spacer"></span>
          <a class="btn btn-sm" href="#/pos">${icon('cart', 16)} New sale</a>
        </header>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
    </div>
    <div class="scrim" id="scrim"></div>`;

  $('#logout').addEventListener('click', signOut);
  $('#menu').addEventListener('click', () => document.body.classList.add('nav-open'));
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
}

function setBadge(n) {
  const b = $('#nav-badge');
  if (!b) return;
  b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
}
async function refreshBadge() {
  try { const d = await api('/dashboard'); setBadge(d.kpi.expired_batches + d.kpi.expiring_30); } catch { /* badge is optional */ }
}

/* ---------- Router ---------- */
let currentHost = null;
async function route() {
  if (!state.token) return;
  const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
  const r = ROUTES[key] || ROUTES.dashboard;
  const activeKey = ROUTES[key] ? key : 'dashboard';

  $$('.nav a').forEach((a) => {
    if (a.dataset.route === activeKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${r.label} · Medstock`;
  document.body.classList.remove('nav-open');

  // Drop listeners left behind by the previous page
  if (currentHost && currentHost._slash) document.removeEventListener('keydown', currentHost._slash);
  const view = $('#view');
  if (!view) return;

  // Each page renders into its own element. It only replaces the skeleton once it
  // is ready, and only if the person has not navigated elsewhere in the meantime.
  const host = document.createElement('div');
  currentHost = host;
  view.innerHTML = '<div class="skeleton" aria-busy="true"><i></i><i></i></div>';

  try {
    await r.fn(host);
    if (currentHost !== host) { if (host._slash) document.removeEventListener('keydown', host._slash); return; }
    view.replaceChildren(host);
    window.scrollTo({ top: 0 });
  } catch (e) {
    if (currentHost !== host) return;
    view.innerHTML = `<div class="card">${emptyState({
      iconName: 'alert', title: 'This page could not load', text: e.message,
      action: '<button class="btn" id="retry">Try again</button>' })}</div>`;
    $('#retry', view).addEventListener('click', route);
  }
}

/* ---------- Start ---------- */
function startApp() {
  renderShell();
  route();
  refreshBadge();
}

window.addEventListener('hashchange', route);
(async function init() {
  if (!state.token) return renderLogin();
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    startApp();
  } catch {
    renderLogin();   // session expired, or the server is not reachable yet
  }
})();
