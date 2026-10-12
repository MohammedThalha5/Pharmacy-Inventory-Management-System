'use strict';
/* ============================================================
   Dashboard: what needs attention today, then the numbers
   ============================================================ */
function salesChart(days) {
  const W = 560, H = 220, padB = 30, padT = 28, bw = 42;
  const max = Math.max(...days.map((d) => d.total), 1);
  const gap = (W - days.length * bw) / (days.length + 1);
  const bars = days.map((d, i) => {
    const h = Math.max((d.total / max) * (H - padB - padT), 10);
    const x = gap + i * (bw + gap);
    const y = H - padB - h;
    const label = new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
    return `<g>
      <title>${esc(fmtDate(d.day))}: ${esc(money(d.total))} from ${plural(d.bills, 'bill')}</title>
      <rect class="bar ${i === days.length - 1 ? 'today' : ''}" x="${x}" y="${y}" width="${bw}" height="${h}" rx="${bw / 2}"/>
      ${d.total > 0 ? `<text class="val" x="${x + bw / 2}" y="${y - 8}" text-anchor="middle">${shortMoney(d.total)}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${i === days.length - 1 ? 'Today' : label}</text>
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales for the last 7 days">
    <line class="base" x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}"/>${bars}</svg>`;
}

function rankList(rows, valueFn, subFn) {
  const max = Math.max(...rows.map((r) => r._v), 1);
  return `<ul class="rank">${rows.map((r) => `
    <li>
      <span class="r-name">${esc(r._name)}</span><span class="r-val">${valueFn(r)}</span>
      <div class="bar"><i style="width:${(r._v / max) * 100}%"></i></div>
      ${subFn ? `<span class="r-sub">${subFn(r)}</span>` : ''}
    </li>`).join('')}</ul>`;
}

async function pageDashboard(host) {
  const d = await api('/dashboard');
  const k = d.kpi, a = d.attention;
  setBadge(k.expired_batches + k.expiring_30);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (state.user?.name || '').split(' ')[0];
  const delta = k.yesterday_sales > 0 ? ((k.today_sales - k.yesterday_sales) / k.yesterday_sales) * 100 : null;
  const week = d.sales7d.reduce((s, x) => s + x.total, 0);
  const attentionCount = k.low_stock + k.expired_batches + k.expiring_30;

  const tabs = [
    { key: 'expired', label: 'Expired', n: a.expired.length, cls: 'bad' },
    { key: 'expiring', label: 'Expiring soon', n: a.expiring.length, cls: 'warn' },
    { key: 'low', label: 'Low stock', n: a.low.length, cls: 'warn' },
  ];
  let tab = (tabs.find((t) => t.n > 0) || tabs[0]).key;

  host.innerHTML = `
    <div class="page-head">
      <div>
        <h2>${hello}${first ? ', ' + esc(first) : ''}</h2>
        <p>${attentionCount > 0
          ? `${plural(k.expired_batches, 'expired batch')}, ${plural(k.expiring_30, 'batch')} expiring within 30 days and ${plural(k.low_stock, 'medicine')} to reorder.`
          : 'Everything is stocked and in date. Nothing needs your attention right now.'}</p>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="#/purchases" id="receive">${icon('box')} Receive stock</a>
        <a class="btn" href="#/pos">${icon('cart')} New sale</a>
      </div>
    </div>

    <section class="grid-kpi" aria-label="Key figures">
      <div class="card kpi">
        <div class="k-top"><span class="k-ic">${icon('rupee')}</span>Sales today</div>
        <div class="k-val num">${money0(k.today_sales)}</div>
        <div class="k-sub">${plural(k.today_bills, 'bill')}${delta !== null
          ? `, <b class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)}%</b> on yesterday` : ''}</div>
      </div>
      <div class="card kpi info">
        <div class="k-top"><span class="k-ic">${icon('trend')}</span>Sales this month</div>
        <div class="k-val num">${money0(k.month_sales)}</div>
        <div class="k-sub">${money0(week)} in the last 7 days</div>
      </div>
      <div class="card kpi">
        <div class="k-top"><span class="k-ic">${icon('box')}</span>Stock value</div>
        <div class="k-val num">${money0(k.stock_value)}</div>
        <div class="k-sub">At cost, across ${plural(k.medicines, 'medicine')}</div>
      </div>
      <div class="card kpi ${k.expired_batches ? 'bad' : k.expiring_30 ? 'warn' : ''}">
        <div class="k-top"><span class="k-ic">${icon('calendar')}</span>Expiry risk</div>
        <div class="k-val num">${k.expired_batches + k.expiring_30}</div>
        <div class="k-sub">${k.expired_batches} expired, ${k.expiring_30} expiring within 30 days</div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card" id="queue-card">
        <div class="card-h"><h3>Needs attention</h3><a href="#/batches" class="btn btn-ghost btn-sm">All batches</a></div>
        <div class="queue-tabs"><div class="seg" role="group" aria-label="Attention type">
          ${tabs.map((t) => `<button type="button" data-tab="${t.key}" class="${t.n ? t.cls : ''}" aria-pressed="${t.key === tab}">${t.label}<span class="count">${t.n >= 8 ? '8+' : t.n}</span></button>`).join('')}
        </div></div>
        <ul class="queue" id="queue"></ul>
      </div>

      <div class="card">
        <div class="card-h"><h3>Sales, last 7 days</h3></div>
        <div class="card-b">
          <div class="chart-total num">${money0(week)}</div>
          ${salesChart(d.sales7d)}
        </div>
      </div>
    </section>

    <section class="grid-2 even">
      <div class="card">
        <div class="card-h"><h3>Best sellers, last 30 days</h3></div>
        <div class="card-b">${d.topSellers.length
          ? rankList(d.topSellers.map((r) => ({ ...r, _name: medLabel(r), _v: r.units })),
              (r) => plural(r.units, 'unit'), (r) => `${money(r.revenue)} in sales`)
          : '<p class="muted">No sales in the last 30 days.</p>'}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>Stock value by category</h3></div>
        <div class="card-b">${d.categoryValue.length
          ? rankList(d.categoryValue.map((r) => ({ ...r, _name: r.name, _v: r.amount })), (r) => money0(r.amount))
          : '<p class="muted">Receive stock to see its value here.</p>'}</div>
      </div>
    </section>`;

  const queue = $('#queue', host);
  function renderQueue() {
    const rows = a[tab];
    if (!rows.length) {
      queue.innerHTML = `<li style="display:block">${emptyState({
        iconName: 'check', title: tab === 'low' ? 'Nothing to reorder' : tab === 'expired' ? 'No expired stock' : 'Nothing expiring soon',
        text: 'This list is clear.',
      })}</li>`;
      return;
    }
    queue.innerHTML = rows.map((r) => {
      if (tab === 'low') {
        return `<li>
          <div class="q-main"><b>${esc(medLabel(r))}</b><span>Reorder level ${r.reorder_level}</span></div>
          ${gauge(r.stock, r.reorder_level)}
          <button class="btn btn-soft btn-sm" data-reorder="${r.id}">Reorder</button></li>`;
      }
      return `<li>
        <div class="q-main"><b>${esc(medLabel(r))}</b><span>Batch ${esc(r.batch_no)}, ${plural(r.quantity, 'unit')}, expires ${fmtDate(r.expiry_date)}</span></div>
        ${expiryChip(r.days_left)}
        ${tab === 'expired' ? `<button class="btn btn-ghost btn-sm" data-writeoff="${r.id}" data-label="${esc(medLabel(r))}, batch ${esc(r.batch_no)}">Write off</button>` : ''}
      </li>`;
    }).join('');
  }
  renderQueue();

  $$('[data-tab]', host).forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    $$('[data-tab]', host).forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderQueue();
  }));
  queue.addEventListener('click', (e) => {
    const re = e.target.closest('[data-reorder]');
    if (re) return goToPurchase(Number(re.dataset.reorder));
    const wo = e.target.closest('[data-writeoff]');
    if (wo) writeOffBatch(wo.dataset.writeoff, wo.dataset.label, () => route());
  });
}
