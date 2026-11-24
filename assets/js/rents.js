/* ============================================================
   CSC APARTMENTS — Rented residences
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, hms, toast, imgWithFallback } = UI;
  const CFG = window.PINNACLE;
  let filter = 'active', ticker = null;

  const img = u => imgWithFallback(u.image_url || CFG.IMAGES.units[u.slug], Store.facade(u.slug, u.name.length * 7), u.name);

  function hero() {
    const ls = Store.leases();
    const active = ls.filter(l => l.status === 'active');
    const nd = Store.nextDrop();
    document.getElementById('hero').innerHTML = `
      <div class="lease-hero">
        <div class="k">Combined income every 24 hours</div>
        <div class="big">${naira(Store.dailyIncome())}</div>
        <div class="lease-hero-row">
          <div><b>${active.length}</b><span>ACTIVE LEASES</span></div>
          <div><b>${naira(ls.reduce((s, l) => s + l.total_collected, 0))}</b><span>TOTAL COLLECTED</span></div>
          <div><b id="heroClock">${nd ? hms(nd - Date.now()) : '—'}</b><span>NEXT DROP</span></div>
        </div>
      </div>`;
  }

  function filters() {
    const ls = Store.leases();
    const counts = {
      active: ls.filter(l => l.status === 'active').length,
      completed: ls.filter(l => l.status !== 'active').length,
      all: ls.length
    };
    document.getElementById('filters').innerHTML = [['active', 'Active'], ['completed', 'Ended'], ['all', 'All leases']]
      .map(([k, label]) => `<button class="btn btn--${filter === k ? 'blue' : 'ghost'} btn--xs" type="button" data-f="${k}">${label} · ${counts[k]}</button>`).join('');
    document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f; filters(); list();
    }));
  }

  function list() {
    const root = document.getElementById('list');
    let ls = Store.leases();
    if (filter === 'active') ls = ls.filter(l => l.status === 'active');
    if (filter === 'completed') ls = ls.filter(l => l.status !== 'active');

    if (!ls.length) {
      root.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty">
        <div class="empty-art">${icon('rents')}</div>
        <b>${filter === 'completed' ? 'No ended leases' : 'No active leases'}</b>
        <p>${filter === 'completed' ? 'Completed leases will appear here when a route reaches its final drop.' : 'Choose a package to start a new income route.'}</p>
        ${filter === 'completed' ? '' : '<a class="btn btn--primary btn--sm" href="packages.html" style="margin-top:14px">Browse packages</a>'}
      </div></div>`;
      return;
    }

    root.innerHTML = ls.map(l => {
      const u = l.unit;
      const out = l.days_paid >= u.duration_days;
      const pct = Math.min(100, Math.round(l.days_paid / u.duration_days * 100));
      const next = l.started_at + (l.days_paid + 1) * Store.DAY;
      const remaining = Math.max(0, u.duration_days - l.days_paid);
      return `<article class="lease ${out ? 'lease--out' : ''}">
        <div class="lease-top">
          <div class="lease-thumb">${img(u)}</div>
          <div class="lease-meta"><b>${esc(u.name)}</b><span>${esc(u.tier)} · ${u.sqm} m²</span></div>
          <span class="tag tag--${out ? 'out' : 'live'}">${out ? 'Ended' : 'Active'}</span>
        </div>

        <div class="timer ${out ? 'out' : ''}" data-drop="${out ? '' : next}">
          <span class="k">${out ? 'OUT OF DISPATCH DAYS' : 'NEXT DROP IN'}</span>
          <span class="clock">${out ? 'OUT OF DISPATCH DAYS' : hms(next - Date.now())}</span>
        </div>

        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="lease-stats">
          <span>Drop <b>${l.days_paid}</b> of ${u.duration_days}</span>
          <span>${out ? 'Completed' : `<b>${remaining}</b> income days left`}</span>
        </div>

        <div class="total-box" style="margin:0">
          <div class="kv"><span class="k">Leased on</span><span class="v" style="font-size:12.5px">${dt(l.started_at)}</span></div>
          <div class="kv"><span class="k">Lease price</span><span class="v">${naira(u.price)}</span></div>
          <div class="kv"><span class="k">Every 24 hours</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
          <div class="kv"><span class="k">Ends on</span><span class="v" style="font-size:12.5px">${dt(l.started_at + u.duration_days * Store.DAY)}</span></div>
          <div class="kv grand"><span class="k">Collected</span><span class="v">${naira(l.total_collected)}</span></div>
        </div>
        ${l.granted_by_admin ? '<span class="tag tag--soon">Granted by management</span>' : ''}
      </article>`;
    }).join('');
  }

  function tick() {
    let due = false;
    document.querySelectorAll('[data-drop]').forEach(el => {
      const t = +el.dataset.drop; if (!t) return;
      const left = t - Date.now();
      const c = el.querySelector('.clock'); if (c) c.textContent = hms(left);
      if (left <= 0) due = true;
    });
    const nd = Store.nextDrop(), hc = document.getElementById('heroClock');
    if (hc) hc.textContent = nd ? hms(nd - Date.now()) : '—';
    if (due) { Store.sweep(); render(); }
  }

  function render() { hero(); filters(); list(); }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    Store.sweep();
    UI.mountHeader({ title: 'My Fleet', back: 'dashboard.html' });
    UI.mountNav('rents.html');
    render();
    ticker = setInterval(tick, 1000);
    window.addEventListener('pinnacle:income', e => {
      render();
      toast('Income dropped', 'ok', { sub: naira(e.detail.amount) + ' credited to your wallet' });
    });
    window.addEventListener('beforeunload', () => clearInterval(ticker));
    UI.bootOff();
  });
})();
