/* ============================================================
   Opex Logistics — dedicated package catalogue
   Uses the existing Store.rent flow and purchase rules unchanged.
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, toast, confirmSheet, imgWithFallback } = UI;
  const CFG = window.PINNACLE;
  const unitImg = unit => imgWithFallback(unit.image_url || CFG.IMAGES.units[unit.slug], Store.facade(unit.slug, unit.name.length * 7), unit.name);

  function paintUnits() {
    const root = document.getElementById('units');
    if (!root) return;
    const list = Store.units();
    const count = document.getElementById('packageCount');
    if (count) count.textContent = String(list.length);

    if (!list.length) {
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-art">${icon('building')}</div>
        <b>No units in dispatch</b>
        <p>Management has not released a new fleet unit yet. Check back shortly.</p>
      </div></div>`;
      return;
    }

    root.innerHTML = list.map(unit => {
      const left = Math.max(0, unit.purchase_limit - Store.ownedCount(unit.id));
      const live = unit.status === 'live';
      const total = unit.daily_yield * unit.duration_days;
      return `<article class="unit rise ${live && !left ? 'unit--capped' : ''}">
        <div class="unit-img">${unitImg(unit)}<span class="ribbon">${esc(unit.tier)}</span></div>
        <div class="unit-body">
          <div class="unit-top">
            <h3 class="unit-name">${esc(unit.name)}</h3>
            <span class="tag tag--${live ? 'live' : 'soon'}">${live ? 'Live' : 'Upcoming'}</span>
          </div>
          <div class="unit-specs">
            <span class="chip">${icon('bed')} ${unit.bedrooms} bed</span>
            <span class="chip">${icon('bath')} ${unit.bathrooms} bath</span>
            <span class="chip">${icon('area')} ${unit.sqm} m²</span>
          </div>
          <div class="unit-econ">
            <div class="econ"><span class="k">Lease price</span><span class="v c-blue">${naira(unit.price)}</span></div>
            <div class="econ"><span class="k">Every 24h</span><span class="v c-green">${naira(unit.daily_yield)}</span></div>
            <div class="econ"><span class="k">Income days</span><span class="v">${unit.duration_days}</span></div>
            <div class="econ"><span class="k">Total return</span><span class="v c-pink">${naira(total)}</span></div>
          </div>
          <div class="unit-foot">
            <span class="limit">${live ? `<b>${left}</b> of ${unit.purchase_limit} left` : 'Opens soon'}</span>
            <button class="btn btn--${live && left ? 'primary' : 'ghost'} btn--sm" type="button" data-rent="${unit.id}" ${(!live || !left) ? 'disabled' : ''}>
              ${live ? (left ? 'Lease' : 'Limit reached') : 'Upcoming'}
            </button>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('[data-rent]').forEach(button => button.addEventListener('click', () => rentFlow(button.dataset.rent)));
    [...root.querySelectorAll('.unit')].forEach((element, index) => { element.style.animationDelay = (0.04 * index) + 's'; });
  }

  function rentFlow(id) {
    const unit = Store.unit(id);
    const wallet = Store.wallet();
    if (!unit) return;
    confirmSheet({
      title: 'Confirm lease',
      confirmText: 'Lease for ' + naira(unit.price),
      kind: 'primary',
      body: `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <div class="lease-thumb">${unitImg(unit)}</div>
          <div><b class="dsp" style="font-size:15px">${esc(unit.name)}</b>
            <div class="c-muted" style="font-size:12px;font-weight:600">${esc(unit.tier)} · ${unit.sqm} m²</div></div>
        </div>
        <div class="total-box">
          <div class="kv"><span class="k">Lease price</span><span class="v">${naira(unit.price)}</span></div>
          <div class="kv"><span class="k">Income every 24 hours</span><span class="v c-green">${naira(unit.daily_yield)}</span></div>
          <div class="kv"><span class="k">Income days</span><span class="v">${unit.duration_days}</span></div>
          <div class="kv"><span class="k">Total return</span><span class="v c-pink">${naira(unit.daily_yield * unit.duration_days)}</span></div>
          <div class="kv grand"><span class="k">Balance after lease</span><span class="v">${naira(Math.max(0, wallet.balance - wallet.locked - unit.price))}</span></div>
        </div>
        <p class="c-muted" style="font-size:12px;font-weight:600">Your first drop lands exactly 24 hours from now, then every 24 hours until all ${unit.duration_days} income days are paid. Track it under My Leases.</p>`,
      onConfirm: async () => {
        const result = await Store.rent(id);
        toast(result.unit.name + ' leased', 'ok', {
          sub: 'First drop in 24 hours · view it under My Leases',
          undo: () => { Store.undo(); paintUnits(); toast('Lease reversed', 'info'); }
        });
        paintUnits();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const session = await UI.guard();
    if (!session) return;
    Store.sweep();
    UI.mountHeader({ title: 'Packages' });
    UI.mountNav('packages.html');
    paintUnits();
    UI.bootOff();
  });
})();
