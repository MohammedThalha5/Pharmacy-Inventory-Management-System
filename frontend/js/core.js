'use strict';
/* ============================================================
   Core helpers shared by every page
   ============================================================ */
const PHARMACY_NAME = 'Medstock Pharmacy';   // shown on receipts
const PHARMACY_ADDRESS = '12, Market Road, Tamil Nadu';

const state = {
  token: localStorage.getItem('medstock_token'),
  user: (() => { try { return JSON.parse(localStorage.getItem('medstock_user')); } catch { return null; } })(),
  medicines: [],
  suppliers: [],
  categories: [],
  pendingPurchase: null,
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
const shortMoney = (n) => (n >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : n >= 1000 ? '₹' + (n / 1000).toFixed(1) + 'k' : '₹' + Math.round(n));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDaysISO = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (d) => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (s) => s ? new Date(String(s).replace(' ', 'T')).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const daysUntil = (d) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(String(d).slice(0, 10) + 'T00:00:00') - t) / 86400000);
};
const medLabel = (m) => m.name + (m.strength ? ' ' + m.strength : '');

/* ---------- Icons (24px stroke set) ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  pill: '<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5.1"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  box: '<path d="m7.5 4.3 9 5.2"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};
const icon = (name, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- API ---------- */
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that it is running and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && state.token) { signOut(); throw new Error('Your session has ended. Please sign in again.'); }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
  return data;
}

/* ---------- Toasts ---------- */
function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'error' : '');
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="t-ic">${icon(type === 'error' ? 'x' : 'check', 14)}</span><span>${esc(message)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, type === 'error' ? 6000 : 3500);
}

/* ---------- Modal ---------- */
function modal({ title, body, footer = '', size = '', onOpen, onClose }) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="modal-b">${body}</div>
      ${footer ? `<footer class="modal-f">${footer}</footer>` : ''}
    </div>`;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    el.remove();
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  $$('[data-close]', el).forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  $('#modal-root').appendChild(el);
  onOpen && onOpen(el, close);
  const first = $('input:not([type=hidden]), select, textarea', el);
  if (first && !first.readOnly) first.focus();
  return { el, close };
}

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const { el, close } = modal({
      title, size: 'sm',
      body: `<p class="muted">${esc(message)}</p>
             <div class="form-actions"><button class="btn btn-ghost" data-no>Cancel</button>
             <button class="btn ${danger ? 'btn-danger' : ''}" data-yes>${esc(confirmLabel)}</button></div>`,
      onClose: () => resolve(answer),
    });
    $('[data-no]', el).addEventListener('click', close);
    $('[data-yes]', el).addEventListener('click', () => { answer = true; close(); });
  });
}

async function busy(btn, fn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Working…';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = label; }
}

/* ---------- Shared UI fragments ---------- */
function expiryChip(days) {
  if (days == null) return '<span class="chip chip-plain">No stock</span>';
  if (days < 0) return `<span class="chip chip-bad">Expired ${plural(-days, 'day')} ago</span>`;
  if (days === 0) return '<span class="chip chip-bad">Expires today</span>';
  if (days <= 30) return `<span class="chip chip-warn">${plural(days, 'day')} left</span>`;
  if (days <= 90) return `<span class="chip chip-info">${plural(days, 'day')} left</span>`;
  return `<span class="chip chip-ok">${days >= 365 ? (days / 365).toFixed(1) + ' years' : Math.round(days / 30) + ' months'} left</span>`;
}
const stockStatus = (m) => (m.stock <= 0 ? 'out' : m.stock <= m.reorder_level ? 'low' : 'ok');
function statusChip(m) {
  const s = stockStatus(m);
  return s === 'out' ? '<span class="chip chip-bad">Out of stock</span>'
    : s === 'low' ? '<span class="chip chip-warn">Low stock</span>'
    : '<span class="chip chip-ok">In stock</span>';
}
function gauge(stock, reorder) {
  const max = Math.max(reorder * 3, stock, 1);
  const pct = Math.min(100, (stock / max) * 100);
  const tick = Math.min(100, (reorder / max) * 100);
  const cls = stock <= 0 ? 'out' : stock <= reorder ? 'low' : 'ok';
  return `<div class="gauge">
    <div class="gauge-track"><i class="gauge-fill ${cls}" style="width:${pct}%"></i><b class="gauge-tick" style="left:${tick}%" title="Reorder level: ${reorder}"></b></div>
    <span class="gauge-n ${cls}">${stock}</span></div>`;
}
function emptyState({ iconName = 'pill', title, text, action }) {
  return `<div class="empty"><div class="e-ic">${icon(iconName, 28)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action || ''}</div>`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Shared data ---------- */
async function loadMedicines() {
  const [meds, cats] = await Promise.all([api('/medicines'), api('/categories')]);
  state.medicines = meds; state.categories = cats;
  return meds;
}
async function loadSuppliers() { state.suppliers = await api('/suppliers'); return state.suppliers; }

async function writeOffBatch(id, label, after) {
  const ok = await confirmDialog({
    title: 'Write off this batch?',
    message: `${label} will be removed from stock and recorded as a write-off. This cannot be undone.`,
    confirmLabel: 'Write off', danger: true,
  });
  if (!ok) return;
  try {
    await api(`/batches/${id}/writeoff`, { method: 'POST', body: { reason: 'Expired or damaged stock' } });
    toast('Batch written off.');
    refreshBadge();
    after && after();
  } catch (e) { toast(e.message, 'error'); }
}

function goToPurchase(medicineId) {
  state.pendingPurchase = { medicineId };
  location.hash = '#/purchases';
}
