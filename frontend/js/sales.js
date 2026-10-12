'use strict';
/* ============================================================
   Point of sale, sales history, receipts
   ============================================================ */
function showReceipt(sale) {
  const { el } = modal({
    title: 'Receipt', size: 'sm',
    body: `
      <div class="receipt">
        <div class="r-head"><h3>${esc(PHARMACY_NAME)}</h3><div class="muted">${esc(PHARMACY_ADDRESS)}</div></div>
        <div class="r-meta">
          <span><b>${esc(sale.invoice_no)}</b></span><span>${fmtDateTime(sale.created_at)}</span>
          <span>Customer: ${esc(sale.customer_name || 'Walk-in')}</span><span>Paid by ${esc(sale.payment_method)}</span>
        </div>
        <table>
          <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
          <tbody>${sale.items.map((i) => `<tr>
            <td>${esc(medLabel(i))}<div class="muted" style="font-size:12px">Batch ${esc(i.batch_no)}</div></td>
            <td class="right num">${i.quantity}</td><td class="right num">${money(i.unit_price)}</td><td class="right num">${money(i.line_total)}</td></tr>`).join('')}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span class="num">${money(sale.subtotal)}</span></div>
          <div><span>GST</span><span class="num">${money(sale.tax)}</span></div>
          ${sale.discount > 0 ? `<div><span>Discount</span><span class="num">−${money(sale.discount)}</span></div>` : ''}
          <div class="grand"><span>Total</span><span class="num">${money(sale.total)}</span></div>
        </div>
        <p class="thanks">Served by ${esc(sale.sold_by_name || 'staff')}. Thank you, get well soon.</p>
      </div>
      <div class="form-actions no-print">
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn" data-print>${icon('printer')} Print receipt</button>
      </div>`,
  });
  $('[data-print]', el).addEventListener('click', () => window.print());
  $('.form-actions [data-close]', el).addEventListener('click', () => $('[data-close]', el).click());
}

/* ---------- Point of sale ---------- */
async function pagePOS(host) {
  await loadMedicines();
  const byId = () => new Map(state.medicines.map((m) => [m.id, m]));
  const cart = new Map();                  // medicine id -> quantity
  const ui = { q: '', cat: '', pay: 'Cash' };

  host.innerHTML = `
    <div class="page-head">
      <div><h2>New sale</h2><p>Search or tap a medicine to add it. Stock is taken from the earliest-expiring batch first.</p></div>
    </div>
    <div class="pos">
      <section aria-label="Medicines">
        <div class="toolbar">
          <div class="search" style="max-width:none"><label class="sr-only" for="q">Search medicines</label>${icon('search')}
            <input class="input" id="q" type="search" placeholder="Search medicines (press / to focus, Enter adds the first match)" autocomplete="off"></div>
        </div>
        <div class="pos-cats"><div class="seg" id="cats" role="group" aria-label="Category"></div></div>
        <div class="products" id="products"></div>
      </section>

      <aside class="card cart" aria-label="Current sale">
        <div class="cart-h"><h3>Current sale</h3><button class="btn btn-ghost btn-sm" id="clear">Clear</button></div>
        <ul class="cart-list" id="cart-list"></ul>
        <div class="cart-foot">
          <div class="row2">
            <div class="field"><label for="c-name">Customer</label><input class="input input-sm" id="c-name" placeholder="Walk-in" autocomplete="off"></div>
            <div class="field"><label for="c-phone">Phone</label><input class="input input-sm" id="c-phone" type="tel" placeholder="Optional" autocomplete="off"></div>
          </div>
          <div class="row2">
            <div class="field"><span class="label">Payment</span>
              <div class="seg" id="pay" role="group" aria-label="Payment method">${['Cash', 'UPI', 'Card'].map((p) => `<button type="button" data-pay="${p}" aria-pressed="${p === ui.pay}">${p}</button>`).join('')}</div></div>
            <div class="field"><label for="c-disc">Discount (%)</label><input class="input input-sm" id="c-disc" type="number" min="0" max="100" step="1" value="0"></div>
          </div>
          <div id="rx-note"></div>
          <div class="totals" id="totals"></div>
          <button class="btn btn-lg btn-block" id="checkout" disabled>Complete sale</button>
        </div>
      </aside>
    </div>`;

  const medsOf = () => state.medicines;
  $('#cats', host).innerHTML = ['', ...state.categories.map((c) => c.name)]
    .map((c) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === ui.cat}">${c ? esc(c) : 'All'}</button>`).join('');

  function visible() {
    const q = ui.q.trim().toLowerCase();
    return medsOf().filter((m) => (!ui.cat || m.category === ui.cat) &&
      (!q || [m.name, m.generic_name, m.sku].some((v) => (v || '').toLowerCase().includes(q))));
  }

  function renderProducts() {
    const list = visible();
    $('#products', host).innerHTML = list.length ? list.map((m) => {
      const s = stockStatus(m), inCart = cart.get(m.id);
      return `<button class="product" data-add="${m.id}" ${m.stock <= 0 ? 'disabled' : ''}>
        ${inCart ? `<span class="in-cart">${inCart}</span>` : ''}
        <b>${esc(m.name)}${m.requires_prescription ? '<span class="rx">Rx</span>' : ''}</b>
        <span class="p-sub">${esc([m.strength, m.dosage_form].filter(Boolean).join(', ') || m.unit)}</span>
        <span class="p-foot"><span class="price num">${money(m.unit_price)}</span>
          <span class="p-stock ${s}">${m.stock <= 0 ? 'Out of stock' : m.stock + ' left'}</span></span>
      </button>`;
    }).join('') : `<div style="grid-column:1/-1">${emptyState({ title: 'No medicines match', text: 'Try another name or category.' })}</div>`;
  }

  function totals() {
    const map = byId();
    let sub = 0, tax = 0;
    for (const [id, q] of cart) {
      const m = map.get(id); const line = round2(q * m.unit_price);
      sub += line; tax += (line * m.gst_percent) / 100;
    }
    sub = round2(sub); tax = round2(tax);
    const pct = Math.min(100, Math.max(0, Number($('#c-disc', host).value) || 0));
    const disc = round2(((sub + tax) * pct) / 100);
    return { sub, tax, disc, total: round2(sub + tax - disc) };
  }

  function renderCart() {
    const map = byId();
    const list = $('#cart-list', host);
    list.innerHTML = cart.size ? [...cart].map(([id, q]) => {
      const m = map.get(id);
      return `<li data-id="${id}">
        <div><div class="c-name">${esc(medLabel(m))}</div><div class="c-sub">${money(m.unit_price)} per ${esc(m.unit)}</div></div>
        <div class="c-total">${money(q * m.unit_price)}</div>
        <div class="stepper" role="group" aria-label="Quantity of ${esc(m.name)}">
          <button type="button" data-dec aria-label="Decrease">${icon('minus', 14)}</button>
          <input type="number" min="0" max="${m.stock}" value="${q}" aria-label="Quantity">
          <button type="button" data-inc aria-label="Increase">${icon('plus', 14)}</button>
        </div>
        <button class="icon-btn danger" data-rm style="justify-self:end" aria-label="Remove ${esc(m.name)}">${icon('trash', 16)}</button>
      </li>`;
    }).join('') : '<li class="cart-empty" style="display:block">Your cart is empty. Tap a medicine to add it.</li>';

    const t = totals();
    $('#totals', host).innerHTML = `
      <div><span>Subtotal</span><span class="num">${money(t.sub)}</span></div>
      <div><span>GST</span><span class="num">${money(t.tax)}</span></div>
      ${t.disc > 0 ? `<div><span>Discount</span><span class="num">−${money(t.disc)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span class="num">${money(t.total)}</span></div>`;
    const needsRx = [...cart.keys()].some((id) => map.get(id)?.requires_prescription);
    $('#rx-note', host).innerHTML = needsRx ? `<div class="rx-note">${icon('info', 18)}<span>This sale includes prescription medicines. Check the prescription before completing.</span></div>` : '';
    $('#checkout', host).disabled = cart.size === 0;
    renderProducts();
  }

  function add(id, n = 1) {
    const m = byId().get(id);
    if (!m) return;
    const next = (cart.get(id) || 0) + n;
    if (next > m.stock) return toast(`Only ${m.stock} ${m.unit}${m.stock === 1 ? '' : 's'} of ${m.name} in stock.`, 'error');
    if (next <= 0) cart.delete(id); else cart.set(id, next);
    renderCart();
  }

  renderProducts(); renderCart();

  const search = $('#q', host);
  search.addEventListener('input', (e) => { ui.q = e.target.value; renderProducts(); });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = visible().find((m) => m.stock > 0);
    if (first) { add(first.id); search.select(); }
  });
  host._slash = (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('.overlay')) { e.preventDefault(); search.focus(); }
  };
  document.addEventListener('keydown', host._slash);

  $('#cats', host).addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    ui.cat = b.dataset.cat;
    $$('#cats [data-cat]', host).forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderProducts();
  });
  $('#products', host).addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) add(Number(b.dataset.add)); });
  $('#pay', host).addEventListener('click', (e) => {
    const b = e.target.closest('[data-pay]'); if (!b) return;
    ui.pay = b.dataset.pay;
    $$('#pay [data-pay]', host).forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  $('#c-disc', host).addEventListener('input', renderCart);
  $('#clear', host).addEventListener('click', () => { cart.clear(); renderCart(); });

  $('#cart-list', host).addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const id = Number(li.dataset.id);
    if (e.target.closest('[data-inc]')) add(id, 1);
    else if (e.target.closest('[data-dec]')) add(id, -1);
    else if (e.target.closest('[data-rm]')) { cart.delete(id); renderCart(); }
  });
  $('#cart-list', host).addEventListener('change', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li || e.target.tagName !== 'INPUT') return;
    const id = Number(li.dataset.id), m = byId().get(id);
    let n = Math.floor(Number(e.target.value) || 0);
    if (n > m.stock) { toast(`Only ${m.stock} in stock.`, 'error'); n = m.stock; }
    if (n <= 0) cart.delete(id); else cart.set(id, n);
    renderCart();
  });

  $('#checkout', host).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const body = {
      customer_name: $('#c-name', host).value, customer_phone: $('#c-phone', host).value,
      payment_method: ui.pay, discount_percent: Number($('#c-disc', host).value) || 0,
      items: [...cart].map(([medicine_id, quantity]) => ({ medicine_id, quantity })),
    };
    try {
      const sale = await busy(btn, () => api('/sales', { method: 'POST', body }));
      cart.clear();
      $('#c-name', host).value = ''; $('#c-phone', host).value = ''; $('#c-disc', host).value = '0';
      toast(`Sale ${sale.invoice_no} completed for ${money(sale.total)}.`);
      await loadMedicines().catch(() => {});
      renderCart();
      showReceipt(sale);
      refreshBadge();
    } catch (ex) {
      toast(ex.message, 'error');
      await loadMedicines().catch(() => {});   // stock may have changed under us
      renderCart();
    }
  });
}

/* ---------- Sales history ---------- */
async function pageSales(host) {
  const range = { from: addDaysISO(todayISO(), -29), to: todayISO() };
  const f = { q: '', pay: '' };
  let rows = [];

  host.innerHTML = `
    <div class="page-head">
      <div><h2>Sales history</h2><p>Every bill, with totals for the period you pick.</p></div>
      <div class="head-actions"><button class="btn btn-ghost" id="export">${icon('download')} Export CSV</button></div>
    </div>
    <div class="toolbar">
      <div class="search"><label class="sr-only" for="q">Search sales</label>${icon('search')}
        <input class="input" id="q" type="search" placeholder="Search invoice or customer" autocomplete="off"></div>
      <div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="from" class="muted" style="font-weight:500">From</label>
        <input class="input input-sm" id="from" type="date" value="${range.from}" max="${todayISO()}" style="width:150px"></div>
      <div class="field" style="flex-direction:row;align-items:center;gap:8px"><label for="to" class="muted" style="font-weight:500">To</label>
        <input class="input input-sm" id="to" type="date" value="${range.to}" max="${todayISO()}" style="width:150px"></div>
      <select class="select" id="pay" aria-label="Payment method"><option value="">All payment methods</option><option>Cash</option><option>UPI</option><option>Card</option></select>
    </div>
    <section class="grid-kpi" id="kpis"></section>
    <div class="card table-card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Date and time</th><th>Customer</th><th class="right">Units</th><th>Payment</th><th class="right">Total</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
      <div class="table-foot" id="foot"></div>
    </div>`;

  const filtered = () => {
    const q = f.q.trim().toLowerCase();
    return rows.filter((r) => (!f.pay || r.payment_method === f.pay) &&
      (!q || r.invoice_no.toLowerCase().includes(q) || (r.customer_name || '').toLowerCase().includes(q)));
  };

  function render() {
    const list = filtered();
    const revenue = list.reduce((s, r) => s + r.total, 0);
    const units = list.reduce((s, r) => s + Number(r.units), 0);
    const tax = list.reduce((s, r) => s + r.tax, 0);
    $('#kpis', host).innerHTML = `
      <div class="card kpi"><div class="k-top"><span class="k-ic">${icon('rupee')}</span>Revenue</div><div class="k-val num">${money0(revenue)}</div><div class="k-sub">Includes ${money0(tax)} GST</div></div>
      <div class="card kpi info"><div class="k-top"><span class="k-ic">${icon('receipt')}</span>Bills</div><div class="k-val num">${list.length}</div><div class="k-sub">In the selected period</div></div>
      <div class="card kpi"><div class="k-top"><span class="k-ic">${icon('trend')}</span>Average bill</div><div class="k-val num">${money0(list.length ? revenue / list.length : 0)}</div><div class="k-sub">Per customer</div></div>
      <div class="card kpi info"><div class="k-top"><span class="k-ic">${icon('pill')}</span>Units sold</div><div class="k-val num">${units}</div><div class="k-sub">Across all medicines</div></div>`;
    $('#rows', host).innerHTML = list.length ? list.map((r) => `
      <tr class="row-click" data-id="${r.id}">
        <td class="name">${esc(r.invoice_no)}</td><td>${fmtDateTime(r.created_at)}</td><td>${esc(r.customer_name || 'Walk-in')}</td>
        <td class="right num">${r.units}</td>
        <td><span class="chip chip-plain ${r.payment_method === 'Cash' ? 'chip-ok' : r.payment_method === 'UPI' ? 'chip-info' : ''}">${esc(r.payment_method)}</span></td>
        <td class="right num"><b>${money(r.total)}</b></td>
        <td class="actions"><button class="btn btn-ghost btn-sm" data-id="${r.id}">Receipt</button></td></tr>`).join('')
      : `<tr><td colspan="7">${emptyState({ iconName: 'receipt', title: 'No sales found', text: 'Change the dates or filters, or make a sale from the New sale page.', action: '<a class="btn" href="#/pos">New sale</a>' })}</td></tr>`;
    $('#foot', host).textContent = `${list.length} bills shown (up to 1,000 per search).`;
    host._list = list;
  }

  async function load() {
    try { rows = await api(`/sales?from=${range.from}&to=${range.to}`); render(); }
    catch (e) { toast(e.message, 'error'); }
  }
  await load();

  $('#q', host).addEventListener('input', (e) => { f.q = e.target.value; render(); });
  $('#pay', host).addEventListener('change', (e) => { f.pay = e.target.value; render(); });
  ['from', 'to'].forEach((k) => $('#' + k, host).addEventListener('change', (e) => {
    if (!e.target.value) return;
    range[k] = e.target.value;
    if (range.from > range.to) { toast('The start date must be before the end date.', 'error'); return; }
    load();
  }));
  $('#export', host).addEventListener('click', () => downloadCSV(`sales-${range.from}-to-${range.to}.csv`, [
    ['Invoice', 'Date', 'Customer', 'Units', 'Payment', 'Subtotal', 'GST', 'Discount', 'Total'],
    ...(host._list || []).map((r) => [r.invoice_no, r.created_at, r.customer_name, r.units, r.payment_method, r.subtotal, r.tax, r.discount, r.total]),
  ]));
  $('#rows', host).addEventListener('click', async (e) => {
    const r = e.target.closest('[data-id]'); if (!r) return;
    try { showReceipt(await api(`/sales/${r.dataset.id}`)); } catch (ex) { toast(ex.message, 'error'); }
  });
}
