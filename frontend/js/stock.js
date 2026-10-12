'use strict';
/* ============================================================
   Batches & expiry, Purchases (stock in), Suppliers
   ============================================================ */

/* ---------- Batches & expiry ---------- */
async function pageBatches(host) {
  const batches = await api('/batches');
  const f = { q: '', s: 'all' };
  const bucket = (b) => (b.days_left < 0 ? 'expired' : b.days_left <= 30 ? 'd30' : b.days_left <= 90 ? 'd90' : 'ok');
  const isAdmin = state.user?.role === 'admin';

  host.innerHTML = `
    <div class="page-head">
      <div><h2>Batches and expiry</h2><p>Each delivery is tracked as a batch. Sales always use the earliest-expiring batch first.</p></div>
      <div class="head-actions"><button class="btn btn-ghost" id="export">${icon('download')} Export CSV</button></div>
    </div>
    <div class="toolbar">
      <div class="search"><label class="sr-only" for="q">Search batches</label>${icon('search')}
        <input class="input" id="q" type="search" placeholder="Search by medicine or batch number" autocomplete="off"></div>
      <div class="seg" id="seg" role="group" aria-label="Expiry window"></div>
    </div>
    <div class="card table-card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Medicine</th><th>Batch</th><th>Supplier</th><th class="right">Quantity</th><th class="right">Value at cost</th><th>Expiry date</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
      <div class="table-foot" id="foot"></div>
    </div>`;

  function render() {
    const counts = { all: batches.length, expired: 0, d30: 0, d90: 0, ok: 0 };
    batches.forEach((b) => counts[bucket(b)]++);
    $('#seg', host).innerHTML = [
      ['all', 'All', ''], ['expired', 'Expired', 'bad'], ['d30', 'Within 30 days', 'warn'], ['d90', '31 to 90 days', ''], ['ok', 'Over 90 days', ''],
    ].map(([k, l, c]) => `<button type="button" data-s="${k}" class="${counts[k] ? c : ''}" aria-pressed="${f.s === k}">${l}<span class="count">${counts[k]}</span></button>`).join('');

    const q = f.q.trim().toLowerCase();
    const rows = batches.filter((b) => (f.s === 'all' || bucket(b) === f.s) &&
      (!q || b.medicine.toLowerCase().includes(q) || b.batch_no.toLowerCase().includes(q)));
    $('#rows', host).innerHTML = rows.length ? rows.map((b) => `
      <tr>
        <td><div class="name">${esc(b.medicine)} ${esc(b.strength || '')}</div><div class="sub">${esc(b.dosage_form || '')}</div></td>
        <td>${esc(b.batch_no)}</td>
        <td>${esc(b.supplier || '—')}</td>
        <td class="right num">${b.quantity}</td>
        <td class="right num">${money(b.quantity * b.cost_price)}</td>
        <td>${fmtDate(b.expiry_date)}</td>
        <td>${expiryChip(b.days_left)}</td>
        <td class="actions">${b.days_left < 0
          ? `<button class="btn btn-ghost btn-sm" data-wo="${b.id}" data-label="${esc(b.medicine)} ${esc(b.strength || '')}, batch ${esc(b.batch_no)}">Write off</button>`
          : (isAdmin ? `<button class="icon-btn danger" data-wo="${b.id}" title="Write off (damaged or lost)" aria-label="Write off batch ${esc(b.batch_no)}" data-label="${esc(b.medicine)} ${esc(b.strength || '')}, batch ${esc(b.batch_no)}">${icon('trash')}</button>` : '')}</td>
      </tr>`).join('')
      : `<tr><td colspan="8">${emptyState({ iconName: 'calendar', title: 'No batches here', text: f.s === 'expired' ? 'You have no expired stock on the shelves.' : 'No batches match this view.' })}</td></tr>`;

    const expiredValue = batches.filter((b) => b.days_left < 0).reduce((s, b) => s + b.quantity * b.cost_price, 0);
    $('#foot', host).textContent = `${rows.length} of ${batches.length} batches` + (expiredValue ? `. Expired stock on hand is worth ${money(expiredValue)} at cost.` : '.');
    host._rows = rows;
  }
  render();

  $('#q', host).addEventListener('input', (e) => { f.q = e.target.value; render(); });
  $('#seg', host).addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { f.s = b.dataset.s; render(); } });
  $('#export', host).addEventListener('click', () => downloadCSV(`batches-${todayISO()}.csv`, [
    ['Medicine', 'Strength', 'Batch', 'Supplier', 'Quantity', 'Cost price', 'Expiry date', 'Days left'],
    ...(host._rows || []).map((b) => [b.medicine, b.strength, b.batch_no, b.supplier, b.quantity, b.cost_price, b.expiry_date, b.days_left]),
  ]));
  $('#rows', host).addEventListener('click', (e) => {
    const b = e.target.closest('[data-wo]'); if (b) writeOffBatch(b.dataset.wo, b.dataset.label, () => route());
  });
}

/* ---------- Purchases ---------- */
async function openPurchaseForm({ medicineId, supplierId } = {}, onSaved) {
  try {
    if (!state.medicines.length) await loadMedicines();
    if (!state.suppliers.length) await loadSuppliers();
  } catch (e) { return toast(e.message, 'error'); }
  if (!state.suppliers.length) {
    return toast('Add a supplier first, then you can receive stock from them.', 'error');
  }

  const medOptions = `<option value="">Choose medicine</option>` +
    state.medicines.map((m) => `<option value="${m.id}">${esc(medLabel(m))}</option>`).join('');
  const lineRow = (med = '') => `
    <tr data-line>
      <td style="min-width:210px"><select class="select" data-f="medicine_id" aria-label="Medicine">${medOptions.replace(`value="${med}"`, `value="${med}" selected`)}</select></td>
      <td style="min-width:110px"><input class="input" data-f="batch_no" placeholder="Batch no." aria-label="Batch number"></td>
      <td style="min-width:140px"><input class="input" data-f="expiry_date" type="date" min="${todayISO()}" aria-label="Expiry date"></td>
      <td style="width:92px"><input class="input num" data-f="quantity" type="number" min="1" step="1" placeholder="Qty" aria-label="Quantity"></td>
      <td style="width:110px"><input class="input num" data-f="cost_price" type="number" min="0" step="0.01" placeholder="Cost (₹)" aria-label="Cost price per unit"></td>
      <td class="right num" style="min-width:90px;padding-top:10px" data-total>₹0.00</td>
      <td style="width:40px"><button type="button" class="icon-btn danger" data-remove aria-label="Remove line">${icon('x')}</button></td>
    </tr>`;

  const { el, close } = modal({
    title: 'Receive stock', size: 'lg',
    body: `
      <form id="po-form" novalidate>
        <div class="form-grid cols-3">
          <div class="field"><label for="p-sup">Supplier</label>
            <select class="select" id="p-sup" name="supplier_id"><option value="">Choose supplier</option>
              ${state.suppliers.map((s) => `<option value="${s.id}" ${s.id === supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="p-inv">Supplier invoice no.</label><input class="input" id="p-inv" name="invoice_no" placeholder="Optional"></div>
          <div class="field"><label for="p-date">Received on</label><input class="input" id="p-date" name="purchase_date" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        </div>
        <h4 style="margin-top:22px">Items received</h4>
        <div class="lines-wrap"><table class="lines">
          <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Cost per unit</th><th class="right">Amount</th><th></th></tr></thead>
          <tbody id="lines">${lineRow(medicineId)}</tbody>
        </table></div>
        <button type="button" class="btn btn-soft btn-sm" id="add-line">${icon('plus', 16)} Add another item</button>
        <div class="form-error" role="alert"></div>
        <div class="form-actions" style="align-items:center">
          <div style="margin-right:auto"><span class="muted">Total cost</span> <b class="num" id="po-total" style="font-family:var(--font-display);font-size:22px;margin-left:8px">₹0.00</b></div>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn">Add to stock</button>
        </div>
      </form>`,
  });

  const form = $('#po-form', el), tbody = $('#lines', el);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', close));
  const recalc = () => {
    let total = 0;
    $$('[data-line]', tbody).forEach((tr) => {
      const q = Number($('[data-f=quantity]', tr).value) || 0, c = Number($('[data-f=cost_price]', tr).value) || 0;
      $('[data-total]', tr).textContent = money(q * c); total += q * c;
    });
    $('#po-total', el).textContent = money(total);
  };
  form.addEventListener('input', recalc);
  $('#add-line', el).addEventListener('click', () => {
    tbody.insertAdjacentHTML('beforeend', lineRow());
    $('[data-line]:last-child [data-f=medicine_id]', tbody).focus();
  });
  tbody.addEventListener('click', (e) => {
    if (!e.target.closest('[data-remove]')) return;
    if ($$('[data-line]', tbody).length > 1) { e.target.closest('[data-line]').remove(); recalc(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form); err.textContent = '';
    const items = $$('[data-line]', tbody).map((tr) => Object.fromEntries($$('[data-f]', tr).map((i) => [i.dataset.f, i.value])));
    const body = { supplier_id: form.supplier_id.value, invoice_no: form.invoice_no.value, purchase_date: form.purchase_date.value, items };
    if (!body.supplier_id) { err.textContent = 'Choose a supplier.'; return; }
    try {
      await busy($('[type=submit]', form), () => api('/purchases', { method: 'POST', body }));
      toast(`Stock received: ${plural(items.length, 'item')} added.`);
      close(); refreshBadge();
      onSaved && onSaved();
    } catch (ex) { err.textContent = ex.message; }
  });
}

async function openPurchaseDetails(id) {
  let p;
  try { p = await api(`/purchases/${id}`); } catch (e) { return toast(e.message, 'error'); }
  modal({
    title: `Purchase from ${p.supplier}`, size: 'lg',
    body: `
      <dl class="detail-grid">
        <div><dt>Received on</dt><dd>${fmtDate(p.purchase_date)}</dd></div>
        <div><dt>Supplier invoice</dt><dd>${esc(p.invoice_no || '—')}</dd></div>
        <div><dt>Total cost</dt><dd>${money(p.total_amount)}</dd></div>
      </dl>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th class="right">Quantity</th><th class="right">Cost per unit</th><th class="right">Amount</th></tr></thead>
        <tbody>${p.items.map((i) => `<tr><td class="name">${esc(medLabel(i))}</td><td>${esc(i.batch_no)}</td><td>${fmtDate(i.expiry_date)}</td>
          <td class="right num">${i.quantity}</td><td class="right num">${money(i.cost_price)}</td><td class="right num">${money(i.quantity * i.cost_price)}</td></tr>`).join('')}</tbody>
      </table></div>`,
  });
}

async function pagePurchases(host) {
  const [rows] = await Promise.all([api('/purchases'), loadMedicines(), loadSuppliers()]);
  const total = rows.reduce((s, r) => s + r.total_amount, 0);
  host.innerHTML = `
    <div class="page-head">
      <div><h2>Purchases</h2><p>Record stock arriving from suppliers. Each line becomes a batch with its own expiry date.</p></div>
      <div class="head-actions"><button class="btn" id="new">${icon('plus')} Receive stock</button></div>
    </div>
    <div class="card table-card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Received</th><th>Supplier</th><th>Invoice</th><th class="right">Items</th><th class="right">Units</th><th class="right">Total cost</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map((r) => `
          <tr class="row-click" data-id="${r.id}">
            <td>${fmtDate(r.purchase_date)}</td><td class="name">${esc(r.supplier)}</td><td>${esc(r.invoice_no || '—')}</td>
            <td class="right num">${r.line_count}</td><td class="right num">${r.units}</td><td class="right num">${money(r.total_amount)}</td>
            <td class="actions"><button class="btn btn-ghost btn-sm" data-id="${r.id}">View</button></td></tr>`).join('')
          : `<tr><td colspan="7">${emptyState({ iconName: 'truck', title: 'No purchases recorded', text: 'When stock arrives, record it here so it shows up in inventory.', action: '<button class="btn" data-new>Receive stock</button>' })}</td></tr>`}</tbody>
      </table></div>
      <div class="table-foot">${rows.length} recent purchases, ${money(total)} in total.</div>
    </div>`;

  const open = (opts) => openPurchaseForm(opts, () => route());
  $('#new', host).addEventListener('click', () => open());
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return open();
    const r = e.target.closest('[data-id]'); if (r) openPurchaseDetails(Number(r.dataset.id));
  });

  if (state.pendingPurchase) {
    const p = state.pendingPurchase; state.pendingPurchase = null;
    open(p);
  }
}

/* ---------- Suppliers ---------- */
function openSupplierForm(s, onSaved) {
  const v = s || {};
  const { el, close } = modal({
    title: s ? 'Edit supplier' : 'Add supplier',
    body: `
      <form id="sup-form" novalidate>
        <div class="form-grid">
          <div class="field span-2"><label for="s-name">Supplier name</label><input class="input" id="s-name" name="name" value="${esc(v.name)}" required></div>
          <div class="field"><label for="s-contact">Contact person</label><input class="input" id="s-contact" name="contact_person" value="${esc(v.contact_person)}"></div>
          <div class="field"><label for="s-phone">Phone</label><input class="input" id="s-phone" name="phone" type="tel" value="${esc(v.phone)}"></div>
          <div class="field span-2"><label for="s-email">Email</label><input class="input" id="s-email" name="email" type="email" value="${esc(v.email)}"></div>
          <div class="field span-2"><label for="s-addr">Address</label><textarea class="textarea" id="s-addr" name="address" rows="2">${esc(v.address)}</textarea></div>
        </div>
        <div class="form-error" role="alert"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn">${s ? 'Save changes' : 'Add supplier'}</button></div>
      </form>`,
  });
  const form = $('#sup-form', el);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', close));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form); err.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim()) { err.textContent = 'Enter the supplier name.'; return; }
    try {
      await busy($('[type=submit]', form), () => api(s ? `/suppliers/${s.id}` : '/suppliers', { method: s ? 'PUT' : 'POST', body: data }));
      toast(s ? 'Changes saved.' : `${data.name} added.`);
      close(); onSaved && onSaved();
    } catch (ex) { err.textContent = ex.message; }
  });
}

async function pageSuppliers(host) {
  const list = await loadSuppliers();
  const isAdmin = state.user?.role === 'admin';
  host.innerHTML = `
    <div class="page-head">
      <div><h2>Suppliers</h2><p>The wholesalers and distributors you buy from.</p></div>
      <div class="head-actions"><button class="btn" id="add">${icon('plus')} Add supplier</button></div>
    </div>
    ${list.length ? `<div class="cards">${list.map((s) => `
      <article class="card sup">
        <div class="sup-top">
          <div class="avatar" aria-hidden="true">${esc(s.name.charAt(0).toUpperCase())}</div>
          <div style="flex:1;min-width:0"><h3>${esc(s.name)}</h3><div class="who">${esc(s.contact_person || 'No contact person')}</div></div>
          <button class="icon-btn" data-edit="${s.id}" aria-label="Edit ${esc(s.name)}" title="Edit">${icon('edit')}</button>
          ${isAdmin ? `<button class="icon-btn danger" data-del="${s.id}" aria-label="Remove ${esc(s.name)}" title="Remove">${icon('trash')}</button>` : ''}
        </div>
        <dl>
          ${s.phone ? `<div>${icon('phone', 16)}<dd style="margin:0">${esc(s.phone)}</dd></div>` : ''}
          ${s.email ? `<div>${icon('mail', 16)}<dd style="margin:0;overflow-wrap:anywhere">${esc(s.email)}</dd></div>` : ''}
          ${s.address ? `<div>${icon('pin', 16)}<dd style="margin:0">${esc(s.address)}</dd></div>` : ''}
        </dl>
        <div class="sup-stats">
          <div><b class="num">${s.purchase_count}</b><span>Purchases</span></div>
          <div><b class="num">${money0(s.purchase_total)}</b><span>Total bought</span></div>
          <div><b>${s.last_purchase ? fmtDate(s.last_purchase) : '—'}</b><span>Last delivery</span></div>
        </div>
        <div class="sup-actions"><button class="btn btn-soft btn-sm" data-receive="${s.id}">${icon('box', 16)} Receive stock</button></div>
      </article>`).join('')}</div>`
      : `<div class="card">${emptyState({ iconName: 'users', title: 'No suppliers yet', text: 'Add the distributors you buy from so you can record deliveries.', action: '<button class="btn" data-add>Add supplier</button>' })}</div>`}`;

  const reload = () => route();
  host.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'add' || t.hasAttribute('data-add')) return openSupplierForm(null, reload);
    const id = Number(t.dataset.edit || t.dataset.del || t.dataset.receive);
    const s = list.find((x) => x.id === id); if (!s) return;
    if (t.dataset.edit) return openSupplierForm(s, reload);
    if (t.dataset.receive) return openPurchaseForm({ supplierId: s.id }, () => { location.hash = '#/purchases'; });
    if (t.dataset.del) {
      const ok = await confirmDialog({ title: `Remove ${s.name}?`, confirmLabel: 'Remove', danger: true,
        message: 'They will no longer appear when you receive stock. Past purchases stay in your records.' });
      if (!ok) return;
      try { await api(`/suppliers/${s.id}`, { method: 'DELETE' }); toast(`${s.name} removed.`); reload(); }
      catch (ex) { toast(ex.message, 'error'); }
    }
  });
}
