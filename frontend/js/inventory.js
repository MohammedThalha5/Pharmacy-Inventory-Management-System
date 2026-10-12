'use strict';
/* ============================================================
   Inventory: the medicine catalogue with live stock levels
   ============================================================ */
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Gel', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Solution', 'Dressing', 'Device', 'Other'];
const PACK_UNITS = ['strip', 'bottle', 'tube', 'vial', 'sachet', 'inhaler', 'box', 'pack', 'roll', 'piece'];

function options(list, selected) {
  const all = selected && !list.includes(selected) ? [...list, selected] : list;
  return all.map((v) => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function openMedicineForm(med, onSaved) {
  const m = med || { gst_percent: 5, reorder_level: 10, unit: 'strip', dosage_form: 'Tablet' };
  const { el, close } = modal({
    title: med ? 'Edit medicine' : 'Add medicine',
    body: `
      <form id="med-form" novalidate>
        <div class="form-grid">
          <div class="field span-2"><label for="f-name">Medicine name</label>
            <input class="input" id="f-name" name="name" value="${esc(m.name)}" required placeholder="e.g. Paracetamol"></div>
          <div class="field"><label for="f-generic">Generic name</label>
            <input class="input" id="f-generic" name="generic_name" value="${esc(m.generic_name)}" placeholder="e.g. Acetaminophen"></div>
          <div class="field"><label for="f-cat">Category</label>
            <input class="input" id="f-cat" name="category" list="cat-list" value="${esc(m.category)}" placeholder="Choose or type a new one">
            <datalist id="cat-list">${state.categories.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
          <div class="field"><label for="f-form">Dosage form</label>
            <select class="select" id="f-form" name="dosage_form">${options(DOSAGE_FORMS, m.dosage_form)}</select></div>
          <div class="field"><label for="f-strength">Strength</label>
            <input class="input" id="f-strength" name="strength" value="${esc(m.strength)}" placeholder="e.g. 500 mg"></div>
          <div class="field"><label for="f-unit">Sold by the</label>
            <select class="select" id="f-unit" name="unit">${options(PACK_UNITS, m.unit)}</select></div>
          <div class="field"><label for="f-price">Selling price (₹)</label>
            <input class="input" id="f-price" name="unit_price" type="number" min="0" step="0.01" value="${m.unit_price ?? ''}" required></div>
          <div class="field"><label for="f-gst">GST (%)</label>
            <input class="input" id="f-gst" name="gst_percent" type="number" min="0" max="100" step="0.5" value="${m.gst_percent}"></div>
          <div class="field"><label for="f-reorder">Reorder level</label>
            <input class="input" id="f-reorder" name="reorder_level" type="number" min="0" step="1" value="${m.reorder_level}" required>
            <span class="hint">You are warned when stock falls to this level.</span></div>
          <div class="field"><label for="f-rack">Rack or shelf</label>
            <input class="input" id="f-rack" name="rack_location" value="${esc(m.rack_location)}" placeholder="e.g. A1"></div>
          <div class="field"><label for="f-mfr">Manufacturer</label>
            <input class="input" id="f-mfr" name="manufacturer" value="${esc(m.manufacturer)}"></div>
          <div class="field"><label for="f-sku">SKU</label>
            <input class="input" id="f-sku" name="sku" value="${esc(m.sku)}" placeholder="Generated if left empty"></div>
          <label class="check span-2"><input type="checkbox" name="requires_prescription" ${m.requires_prescription ? 'checked' : ''}>
            Needs a prescription to sell</label>
        </div>
        <div class="form-error" role="alert"></div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn">${med ? 'Save changes' : 'Add medicine'}</button>
        </div>
      </form>`,
  });
  const form = $('#med-form', el);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', close));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form);
    err.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    data.requires_prescription = form.requires_prescription.checked;
    if (!data.name.trim()) { err.textContent = 'Enter the medicine name.'; return; }
    if (data.unit_price === '' || Number(data.unit_price) < 0) { err.textContent = 'Enter the selling price.'; return; }
    try {
      await busy($('[type=submit]', form), () => api(med ? `/medicines/${med.id}` : '/medicines', { method: med ? 'PUT' : 'POST', body: data }));
      toast(med ? 'Changes saved.' : `${data.name} added to inventory.`);
      close();
      onSaved && onSaved();
    } catch (ex) { err.textContent = ex.message; }
  });
}

async function openMedicineDetails(id, onChange) {
  const med = state.medicines.find((x) => x.id === id);
  if (!med) return;
  let batches = [];
  try { batches = await api(`/medicines/${id}/batches`); } catch (e) { toast(e.message, 'error'); return; }
  const { el, close } = modal({
    title: medLabel(med), size: 'lg',
    body: `
      <dl class="detail-grid">
        <div><dt>Generic name</dt><dd>${esc(med.generic_name || '—')}</dd></div>
        <div><dt>Category</dt><dd>${esc(med.category || '—')}</dd></div>
        <div><dt>Dosage form</dt><dd>${esc(med.dosage_form || '—')}</dd></div>
        <div><dt>Selling price</dt><dd>${money(med.unit_price)} per ${esc(med.unit)} (GST ${med.gst_percent}%)</dd></div>
        <div><dt>Available now</dt><dd>${med.stock} ${esc(med.unit)}s ${statusChip(med)}</dd></div>
        <div><dt>Rack</dt><dd>${esc(med.rack_location || '—')}</dd></div>
        <div><dt>SKU</dt><dd>${esc(med.sku || '—')}</dd></div>
        <div><dt>Manufacturer</dt><dd>${esc(med.manufacturer || '—')}</dd></div>
        <div><dt>Prescription</dt><dd>${med.requires_prescription ? 'Required' : 'Not required'}</dd></div>
      </dl>
      <h4>Batches</h4>
      ${batches.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Batch</th><th>Supplier</th><th class="right">Quantity</th><th class="right">Cost</th><th>Expiry</th><th>Status</th></tr></thead>
        <tbody>${batches.map((b) => `<tr>
          <td class="name">${esc(b.batch_no)}</td><td>${esc(b.supplier || '—')}</td>
          <td class="right num">${b.quantity}</td><td class="right num">${money(b.cost_price)}</td>
          <td>${fmtDate(b.expiry_date)}</td><td>${b.quantity === 0 ? '<span class="chip chip-plain">Sold out</span>' : expiryChip(b.days_left)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No batches received yet.</p>'}
      <div class="form-actions">
        <button class="btn btn-ghost" data-edit>${icon('edit')} Edit details</button>
        <button class="btn" data-receive>${icon('box')} Receive stock</button>
      </div>`,
  });
  $('[data-edit]', el).addEventListener('click', () => { close(); openMedicineForm(med, onChange); });
  $('[data-receive]', el).addEventListener('click', () => { close(); goToPurchase(med.id); });
}

async function pageInventory(host) {
  await loadMedicines();
  const filter = { q: '', cat: '', status: 'all' };
  const isAdmin = state.user?.role === 'admin';

  host.innerHTML = `
    <div class="page-head">
      <div><h2>Inventory</h2><p>Every medicine you stock, with live quantities from non-expired batches.</p></div>
      <div class="head-actions">
        <button class="btn btn-ghost" id="export">${icon('download')} Export CSV</button>
        <button class="btn" id="add">${icon('plus')} Add medicine</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search"><label class="sr-only" for="q">Search medicines</label>${icon('search')}
        <input class="input" id="q" type="search" placeholder="Search name, SKU or rack" autocomplete="off"></div>
      <select class="select" id="cat" aria-label="Category"><option value="">All categories</option></select>
      <div class="seg" id="status" role="group" aria-label="Stock status"></div>
    </div>
    <div class="card table-card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Next expiry</th><th class="right">Price</th><th>Rack</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
      <div class="table-foot" id="foot"></div>
    </div>`;

  $('#cat', host).insertAdjacentHTML('beforeend', state.categories.map((c) => `<option>${esc(c.name)}</option>`).join(''));

  const reload = async () => { await loadMedicines(); render(); };

  function render() {
    const all = state.medicines;
    const counts = { all: all.length, ok: 0, low: 0, out: 0, exp: 0 };
    all.forEach((m) => { counts[stockStatus(m)]++; if (m.expired_qty > 0) counts.exp++; });
    $('#status', host).innerHTML = [
      ['all', 'All', ''], ['ok', 'In stock', ''], ['low', 'Low', 'warn'], ['out', 'Out', 'bad'], ['exp', 'Has expired stock', 'bad'],
    ].map(([k, label, cls]) => `<button type="button" data-s="${k}" class="${counts[k] ? cls : ''}" aria-pressed="${filter.status === k}">${label}<span class="count">${counts[k]}</span></button>`).join('');

    const q = filter.q.trim().toLowerCase();
    const rows = all.filter((m) =>
      (!q || [m.name, m.generic_name, m.sku, m.rack_location, m.manufacturer].some((v) => (v || '').toLowerCase().includes(q))) &&
      (!filter.cat || m.category === filter.cat) &&
      (filter.status === 'all' || (filter.status === 'exp' ? m.expired_qty > 0 : stockStatus(m) === filter.status)));

    $('#rows', host).innerHTML = rows.length ? rows.map((m) => `
      <tr>
        <td><button class="link" data-view="${m.id}">${esc(medLabel(m))}</button>${m.requires_prescription ? '<span class="rx" title="Prescription required">Rx</span>' : ''}
          <div class="sub">${esc(m.generic_name || '')}${m.generic_name && m.dosage_form ? ', ' : ''}${esc(m.dosage_form || '')}</div></td>
        <td>${esc(m.category || '—')}</td>
        <td>${gauge(m.stock, m.reorder_level)}${m.expired_qty > 0 ? `<div class="sub down">${m.expired_qty} expired, not sellable</div>` : ''}</td>
        <td>${m.next_expiry ? expiryChip(daysUntil(m.next_expiry)) : '<span class="chip chip-plain">No stock</span>'}</td>
        <td class="right num">${money(m.unit_price)}<div class="sub">per ${esc(m.unit)}</div></td>
        <td>${esc(m.rack_location || '—')}</td>
        <td class="actions">
          <button class="icon-btn" data-receive="${m.id}" title="Receive stock" aria-label="Receive stock for ${esc(m.name)}">${icon('box')}</button>
          <button class="icon-btn" data-edit="${m.id}" title="Edit" aria-label="Edit ${esc(m.name)}">${icon('edit')}</button>
          ${isAdmin ? `<button class="icon-btn danger" data-del="${m.id}" title="Remove" aria-label="Remove ${esc(m.name)}">${icon('trash')}</button>` : ''}
        </td>
      </tr>`).join('')
      : `<tr><td colspan="7">${emptyState({
          title: all.length ? 'No medicines match' : 'No medicines yet',
          text: all.length ? 'Try a different search or clear the filters.' : 'Add your first medicine to start tracking stock.',
          action: all.length ? '' : '<button class="btn" data-add>Add medicine</button>' })}</td></tr>`;
    $('#foot', host).textContent = `Showing ${rows.length} of ${all.length} medicines`;
    host._rows = rows;
  }
  render();

  $('#q', host).addEventListener('input', (e) => { filter.q = e.target.value; render(); });
  $('#cat', host).addEventListener('change', (e) => { filter.cat = e.target.value; render(); });
  $('#status', host).addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    filter.status = b.dataset.s; render();
  });
  $('#add', host).addEventListener('click', () => openMedicineForm(null, reload));
  $('#export', host).addEventListener('click', () => {
    downloadCSV(`inventory-${todayISO()}.csv`, [
      ['SKU', 'Name', 'Strength', 'Category', 'Stock', 'Reorder level', 'Next expiry', 'Price', 'GST %', 'Rack'],
      ...(host._rows || []).map((m) => [m.sku, m.name, m.strength, m.category, m.stock, m.reorder_level, m.next_expiry, m.unit_price, m.gst_percent, m.rack_location]),
    ]);
  });
  $('tbody', host).addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-add')) return openMedicineForm(null, reload);
    if (t.dataset.view) return openMedicineDetails(Number(t.dataset.view), reload);
    if (t.dataset.receive) return goToPurchase(Number(t.dataset.receive));
    const med = state.medicines.find((m) => m.id === Number(t.dataset.edit || t.dataset.del));
    if (!med) return;
    if (t.dataset.edit) return openMedicineForm(med, reload);
    if (t.dataset.del) {
      const ok = await confirmDialog({
        title: `Remove ${med.name}?`, confirmLabel: 'Remove', danger: true,
        message: 'It will no longer appear in inventory or the till. Past sales and purchases stay in your records.',
      });
      if (!ok) return;
      try { await api(`/medicines/${med.id}`, { method: 'DELETE' }); toast(`${med.name} removed.`); reload(); }
      catch (ex) { toast(ex.message, 'error'); }
    }
  });
}
