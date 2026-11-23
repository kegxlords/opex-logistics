/* ============================================================
   CSC APARTMENTS — Member home
   Banner · balance · 4 actions · lease catalogue only.
   Rented packages live on rents.html, not here.
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, hms, toast, layer, closeLayer, confirmSheet, imgWithFallback } = UI;
  const A = Actions;
  const CFG = window.PINNACLE;

  let timers = [];
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
  const unitImg = u => imgWithFallback(u.image_url || CFG.IMAGES.units[u.slug], Store.facade(u.slug, u.name.length * 7), u.name);

  /* ================= welcome popup — every visit ================= */
  function welcome(me, s) {
    const first = (me.full_name || 'Member').trim().split(/\s+/)[0];
    const l = layer(`
      <button class="modal-x" data-close aria-label="Close">${icon('x')}</button>
      <div class="welcome-hero">
        <div class="em" aria-hidden="true">01</div>
        <h2>Network active, <span class="welcome-name">${esc(first)}</span></h2>
        <p>Your active leases are on route. Income drops automatically every 24 hours.</p>
      </div>
      <div class="welcome-body">
        <p class="welcome-note">Join the crew channel for payout alerts, new unit releases and direct help from our care team.</p>
        <div class="welcome-actions">
          <a class="wa-btn wa-btn--wa" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">
            ${icon('wa')}<span>Join WhatsApp Group<small>Payout alerts &amp; community</small></span>${icon('chev')}
          </a>
          <button class="wa-btn wa-btn--cs" id="wCare" type="button">
            ${icon('headset')}<span>Customer Service<small>Live chat · ${esc(s.support_email)}</small></span>${icon('chev')}
          </button>
        </div>
        <button class="welcome-skip" data-close type="button">Enter dispatch board</button>
      </div>`);
    const b = l.querySelector('#wCare');
    if (b) b.addEventListener('click', () => { closeLayer(); setTimeout(UI.careSheet, 280); });
  }

  /* ================= carousel ================= */
  function carousel() {
    const root = document.getElementById('carousel');
    if (!root) return;
    const copies = [
      ['Riverside Tower', 'Waterfront residences · Lekki Phase 1'],
      ['The CSC Collection', 'Six tiers of managed rental income'],
      ['Income Every 24 Hours', 'Automatic drops, tracked to the second']
    ];
    root.innerHTML = `
      <div class="carousel-track" id="cTrack">
        ${CFG.IMAGES.banners.map((src, i) => `
          <div class="slide">
            ${imgWithFallback(src, Store.banner(i), copies[i][0])}
            <div class="slide-copy"><b>${copies[i][0]}</b><span>${copies[i][1]}</span></div>
          </div>`).join('')}
      </div>
      <button class="carousel-nav prev" id="cPrev" aria-label="Previous slide">${icon('back')}</button>
      <button class="carousel-nav next" id="cNext" aria-label="Next slide">${icon('chev')}</button>
      <div class="dots" id="cDots">
        ${copies.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" class="${i === 0 ? 'on' : ''}"></button>`).join('')}
      </div>`;

    const track = root.querySelector('#cTrack');
    const dots = [...root.querySelectorAll('.dots button')];
    let idx = 0, auto = null;
    const go = i => {
      idx = (i + copies.length) % copies.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('on', k === idx));
    };
    const start = () => { clearInterval(auto); auto = setInterval(() => go(idx + 1), 5000); };
    dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
    root.querySelector('#cPrev').addEventListener('click', () => { go(idx - 1); start(); });
    root.querySelector('#cNext').addEventListener('click', () => { go(idx + 1); start(); });
    let sx = null;
    root.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); start(); }
      sx = null;
    }, { passive: true });
    root.addEventListener('mouseenter', () => clearInterval(auto));
    root.addEventListener('mouseleave', start);
    start();
    timers.push(auto);
  }

  /* ================= balance ================= */
  function paintBalance() {
    const w = Store.wallet();
    const b = document.getElementById('balMain');
    const i = document.getElementById('balIncome');
    paintOdometer(b, naira(w.balance));
    paintOdometer(i, naira(w.income));
  }

  function paintOdometer(el, value) {
    if (!el || el.dataset.readout === value) return;
    el.dataset.readout = value;
    el.setAttribute('aria-label', value);
    el.innerHTML = [...value].map((character, index) => /\d/.test(character)
      ? `<span class="odo-digit" aria-hidden="true"><span style="animation-delay:${Math.min(index * 14, 112)}ms">${character}</span></span>`
      : `<span class="odo-char" aria-hidden="true">${esc(character)}</span>`).join('');
  }

  function paintActiveLeases() {
    const root = document.getElementById('activeLeases');
    if (!root) return;
    const leases = Store.leases().filter(lease => lease.status === 'active' && lease.days_paid < lease.unit.duration_days);
    if (!leases.length) {
      root.innerHTML = `<div class="board-empty">NO ACTIVE ROUTES // OPEN THE FLEET BOARD TO LEASE A UNIT.</div>`;
      return;
    }
    root.innerHTML = leases.map((lease, index) => {
      const unit = lease.unit;
      const days = Number(lease.days_paid) || 0;
      const duration = Math.max(1, Number(unit.duration_days) || 1);
      const progress = Math.min(100, Math.round(days / duration * 100));
      const next = lease.started_at + (days + 1) * Store.DAY;
      return `<article class="flap-row" style="animation-delay:${Math.min(index * 45, 270)}ms">
        <b class="flap-name">${esc(unit.name)}</b>
        <div class="flap-columns">
          <span class="flap-value"><small>FUND</small>${naira(unit.price)}</span>
          <span class="flap-value"><small>PER 24H</small>${naira(unit.daily_yield)}</span>
          <span class="flap-value"><small>DAYS</small>${days}/${duration}</span>
          <span class="flap-value"><small>TOTAL</small>${naira(unit.daily_yield * duration)}</span>
        </div>
        <span class="flap-status"><i class="status-lamp" aria-hidden="true"></i>EN ROUTE <b class="board-countdown" data-board-drop="${next}">${hms(next - Date.now())}</b></span>
        <div class="flap-route" aria-label="${progress}% of income route complete">
          <i class="route-pin" aria-hidden="true"></i><span class="route-track"><i style="--route-progress:${progress}%"></i></span><i class="route-pin end" aria-hidden="true"></i>
        </div>
      </article>`;
    }).join('');
  }

  function paintManifest() {
    const me = Store.me();
    if (!me) return;
    const crew = document.getElementById('manifestCrew');
    const joined = document.getElementById('manifestJoined');
    const state = document.getElementById('manifestState');
    if (crew) crew.textContent = me.referral_code || '—';
    if (joined) joined.textContent = me.created_at ? dt(me.created_at).split(',')[0] : '—';
    if (state) state.textContent = me.is_active === false ? 'HELD' : 'ACTIVE';
  }

  /* ================= four quick actions ================= */
  function quickActions() {
    const root = document.getElementById('qa');
    if (!root) return;
    const s = Store.settings();
    root.innerHTML = `
      <button class="qa-item qa--blue" type="button" data-qa="deposit">
        <span class="qa-orb">${icon('in')}</span><b>Deposit</b></button>
      <button class="qa-item qa--red" type="button" data-qa="withdraw">
        <span class="qa-orb">${icon('out')}</span><b>Withdraw</b></button>
      <button class="qa-item qa--pink" type="button" data-qa="checkin">
        <span class="qa-orb">${icon('flame')}</span><b>Check-In</b>
        <i class="pip hide" id="ciPip">1</i></button>
      <a class="qa-item qa--green" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">
        <span class="qa-orb">${icon('wa')}</span><b>WhatsApp</b></a>`;

    root.querySelectorAll('[data-qa]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.qa;
      if (k === 'deposit') A.depositSheet(refresh);
      else if (k === 'withdraw') A.withdrawSheet(refresh);
      else A.checkinSheet(refresh);
    }));
  }

  function paintPip() {
    const pip = document.getElementById('ciPip');
    if (pip) pip.classList.toggle('hide', Store.checkinState().claimed);
  }

  /* ================= lease catalogue (to-lease only) ================= */
  function paintUnits() {
    const root = document.getElementById('units');
    if (!root) return;
    const list = Store.units();

    if (!list.length) {
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-art">${icon('building')}</div>
          <b>No units in dispatch</b>
          <p>Management has not released a new fleet unit yet. Check back shortly.</p>
      </div></div>`;
      return;
    }

    root.innerHTML = list.map(u => {
      const left = Math.max(0, u.purchase_limit - Store.ownedCount(u.id));
      const live = u.status === 'live';
      const total = u.daily_yield * u.duration_days;
      return `<article class="unit rise ${live && !left ? 'unit--capped' : ''}">
        <div class="unit-img">${unitImg(u)}<span class="ribbon">${esc(u.tier)}</span></div>
        <div class="unit-body">
          <div class="unit-top">
            <h3 class="unit-name">${esc(u.name)}</h3>
            <span class="tag tag--${live ? 'live' : 'soon'}">${live ? 'Live' : 'Upcoming'}</span>
          </div>
          <div class="unit-specs">
            <span class="chip">${icon('bed')} ${u.bedrooms} bed</span>
            <span class="chip">${icon('bath')} ${u.bathrooms} bath</span>
            <span class="chip">${icon('area')} ${u.sqm} m²</span>
          </div>
          <div class="unit-econ">
            <div class="econ"><span class="k">Lease price</span><span class="v c-blue">${naira(u.price)}</span></div>
            <div class="econ"><span class="k">Every 24h</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
            <div class="econ"><span class="k">Income days</span><span class="v">${u.duration_days}</span></div>
            <div class="econ"><span class="k">Total return</span><span class="v c-pink">${naira(total)}</span></div>
          </div>
          <div class="unit-foot">
            <span class="limit">${live ? `<b>${left}</b> of ${u.purchase_limit} left` : 'Opens soon'}</span>
            <button class="btn btn--${live && left ? 'primary' : 'ghost'} btn--sm"
              type="button" data-rent="${u.id}" ${(!live || !left) ? 'disabled' : ''}>
              ${live ? (left ? 'Lease' : 'Limit reached') : 'Upcoming'}
            </button>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('[data-rent]').forEach(b => b.addEventListener('click', () => rentFlow(b.dataset.rent)));
    [...root.querySelectorAll('.unit')].forEach((el, i) => { el.style.animationDelay = (0.04 * i) + 's'; });
  }

  function rentFlow(id) {
    const u = Store.unit(id);
    const w = Store.wallet();
    confirmSheet({
      title: 'Confirm lease',
      confirmText: 'Lease for ' + naira(u.price),
      kind: 'primary',
      body: `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
          <div class="lease-thumb">${unitImg(u)}</div>
          <div><b class="dsp" style="font-size:15px">${esc(u.name)}</b>
            <div class="c-muted" style="font-size:12px;font-weight:600">${esc(u.tier)} · ${u.sqm} m²</div></div>
        </div>
        <div class="total-box">
          <div class="kv"><span class="k">Lease price</span><span class="v">${naira(u.price)}</span></div>
          <div class="kv"><span class="k">Income every 24 hours</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
          <div class="kv"><span class="k">Income days</span><span class="v">${u.duration_days}</span></div>
          <div class="kv"><span class="k">Total return</span><span class="v c-pink">${naira(u.daily_yield * u.duration_days)}</span></div>
          <div class="kv grand"><span class="k">Balance after lease</span><span class="v">${naira(Math.max(0, w.balance - w.locked - u.price))}</span></div>
        </div>
        <p class="c-muted" style="font-size:12px;font-weight:600">Your first drop lands exactly 24 hours from now, then every 24 hours until all ${u.duration_days} income days are paid. Track it under My Leases.</p>`,
      onConfirm: async () => {
        const r = await Store.rent(id);
        toast(r.unit.name + ' leased', 'ok', {
          sub: 'First drop in 24 hours · view it under My Leases',
          undo: () => { Store.undo(); refresh(); toast('Lease reversed', 'info'); }
        });
        refresh();
      }
    });
  }

  /* ================= history sheet ================= */
  function historySheet() {
    const TYPES = [
      ['all', 'All'], ['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'],
      ['rental_income', 'Income'], ['checkin_bonus', 'Attendance'], ['lease_purchase', 'Leases']
    ];
    let filter = 'all';
    const l = layer(`
      <div class="sheet-head"><h3>${icon('hist')} Transaction history</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:10px;margin-bottom:6px">
        ${TYPES.map(([k, t], i) => `<button class="btn btn--${i === 0 ? 'blue' : 'ghost'} btn--xs" type="button" data-f="${k}">${t}</button>`).join('')}
      </div>
      <div class="rows" id="hRows"></div>`, 'sheet');

    const paint = () => {
      const tx = Store.transactions(filter);
      l.querySelector('#hRows').innerHTML = tx.length ? tx.map(A.txRow).join('')
        : `<div class="empty"><div class="empty-art">${icon('hist')}</div><b>Nothing here yet</b><p>Transactions of this type will appear once recorded.</p></div>`;
      l.querySelectorAll('#hRows [data-tx]').forEach(b => b.addEventListener('click', () => A.txDetail(b.dataset.tx)));
    };
    l.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f;
      l.querySelectorAll('[data-f]').forEach(x => { x.className = 'btn btn--ghost btn--xs'; });
      b.className = 'btn btn--blue btn--xs';
      paint();
    }));
    paint();
  }

  /* ================= rewards / referral sheet ================= */
  function giftSheet() {
    const s = Store.settings();
    const me = Store.me();
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'register.html?ref=' + me.referral_code;
    const l = layer(`
      <div class="sheet-head"><h3>${icon('gift')} Rewards &amp; codes</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="card" style="background:var(--pink-tint);border-color:rgba(236,46,134,.24);margin-bottom:14px">
        <h4 style="margin-bottom:6px">Invite residents, earn on 3 levels</h4>
        <p class="c-muted" style="font-size:12.5px;font-weight:600">Level 1 pays ${s.referral_l1}% · Level 2 pays ${s.referral_l2}% · Level 3 pays ${s.referral_l3}% of every funded deposit in your network.</p>
      </div>
      <div class="code-big">${esc(me.referral_code)}</div>
      <div class="ref-box" style="margin-top:12px">
        <input id="gLink" readonly value="${esc(link)}">
        <button class="btn btn--primary btn--sm" type="button" id="gCopy">Copy</button>
      </div>
      <a class="btn btn--ghost btn--block btn--sm" style="margin-top:10px" href="refer.html">Open referral tools &amp; QR</a>`, 'sheet');
    l.querySelector('#gCopy').addEventListener('click', () => {
      navigator.clipboard.writeText(link)
        .then(() => toast('Referral link copied', 'ok'))
        .catch(() => { l.querySelector('#gLink').select(); toast('Select and copy the link', 'info'); });
    });
  }

  /* ================= refresh ================= */
  function refresh() {
    paintBalance();
    paintUnits();
    paintActiveLeases();
    paintManifest();
    paintPip();
    const me = Store.me();
    const g = document.getElementById('greet');
    if (g && me) g.textContent = (me.full_name || 'Member').trim().split(/\s+/)[0];
  }

  /* ================= boot ================= */
  document.addEventListener('DOMContentLoaded', async () => {
    const sess = await UI.guard();
    if (!sess) return;

    Store.sweep();
    const me = Store.me();
    const s = Store.settings();

    UI.mountHeader({ title: 'Board' });
    UI.mountNav('dashboard.html');
    quickActions();
    refresh();

    const boardTicker = setInterval(() => {
      document.querySelectorAll('[data-board-drop]').forEach(el => {
        el.textContent = hms(Number(el.dataset.boardDrop) - Date.now());
      });
    }, 1000);
    timers.push(boardTicker);

    document.getElementById('histBtn').addEventListener('click', historySheet);
    document.getElementById('fab').addEventListener('click', giftSheet);

    window.addEventListener('pinnacle:income', e => {
      refresh();
      toast('Income dropped', 'ok', { sub: naira(e.detail.amount) + ' across ' + e.detail.paid + ' drop' + (e.detail.paid > 1 ? 's' : '') });
    });
    window.addEventListener('beforeunload', clearTimers);

    UI.bootOff();
    setTimeout(() => welcome(me, s), 700);
  });
})();
