/* ============================================================
   CSC APARTMENTS — Member home
   Control tower · balances · actions · active routes · manifest.
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, hms, toast, layer, closeLayer } = UI;
  const A = Actions;
  let timers = [];
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

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
      root.innerHTML = `<div class="board-empty">NO ACTIVE ROUTES // <a href="packages.html">BROWSE AVAILABLE PACKAGES →</a></div>`;
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
      <a class="qa-item qa--blue" href="deposit.html">
        <span class="qa-orb">${icon('in')}</span><b>Deposit</b></a>
      <a class="qa-item qa--red" href="withdraw.html">
        <span class="qa-orb">${icon('out')}</span><b>Withdraw</b></a>
      <a class="qa-item qa--pink" href="check-in.html">
        <span class="qa-orb">${icon('flame')}</span><b>Check-In</b>
        <i class="pip hide" id="ciPip">1</i></a>
      <a class="qa-item qa--green" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">
        <span class="qa-orb">${icon('wa')}</span><b>WhatsApp</b></a>`;

  }

  function paintPip() {
    const pip = document.getElementById('ciPip');
    if (pip) pip.classList.toggle('hide', Store.checkinState().claimed);
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
    const packageCount = document.getElementById('packageCount');
    if (packageCount) packageCount.textContent = String(Store.units().length);
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
