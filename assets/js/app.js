/* ============================================================
   CSC APARTMENTS — UI kit + shell + guard
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- icons ---------------- */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    refer: '<path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-7 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 12c2.8 0 5 1.9 5 4.2V22H7v-5.8C7 13.9 9.2 12 12 12z"/>',
    rents: '<path d="M4 4h16v4H4zm0 6h16v10H4zm3 3v4h4v-4z"/>',
    team: '<path d="M8 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM8 13c3 0 6 1.4 6 3.6V21H2v-4.4C2 14.4 5 13 8 13zm8 0c2.6 0 5 1.2 5 3.2V21h-5v-4.4c0-1.3-.6-2.4-1.6-3.2z"/>',
    user: '<path d="M12 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0 2c4 0 8 1.8 8 4.4V21H4v-2.6C4 15.8 8 14 12 14z"/>',
    bell: '<path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/>',
    headset: '<path d="M12 2a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h2v-8H5v-2a7 7 0 0 1 14 0v2h-3v8h2a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    chev: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    check: '<path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    alert: '<path d="M12 2L1 21h22zm0 6v7m0 3v.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 11v6m0-9.5v.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    mail: '<path d="M2 5h20v14H2zm0 0l10 8L22 5" fill="none" stroke="currentColor" stroke-width="2"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>',
    ticket: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zm6 1v8" fill="none" stroke="currentColor" stroke-width="2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v3H5a2 2 0 0 1-2-1zm0 1v10a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1-2-1zm13 4h3v4h-3a2 2 0 0 1 0-4z"/>',
    out: '<path d="M12 3v13m0 0l-5-5m5 5l5-5M4 21h16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
    in: '<path d="M12 21V8m0 0l-5 5m5-5l5 5M4 3h16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
    flame: '<path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s-1 4 2 4c2 0 2-2 2-4 0-3-2-5-2-7z"/>',
    wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1a11 11 0 0 1-5.4-4.7c-.4-.7-.7-1.5-.7-2.2 0-.7.3-1.3.7-1.7.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3 0 .6a8 8 0 0 0 3.4 3c.3.1.4.1.6-.1l.7-.8c.2-.2.3-.1.5 0l1.6.8c.2.1.4.2.4.3.1.2.1.6-.1 1z"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13M12 8S9.5 3 7.5 4.5 9 8 12 8s4.5-2 2.5-3.5S12 8 12 8z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    spark: '<path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    bed: '<path d="M3 18v-8h13a4 4 0 0 1 4 4v4M3 14h17M6 10V7h5v3" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM7 12V6a2 2 0 0 1 4 0" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    area: '<path d="M4 4h16v16H4zm4 4h8v8H8z" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    hist: '<path d="M12 8v5l4 2M3 12a9 9 0 1 0 3-6.7M3 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v9h14v-9M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="2"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-8 0l1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="2"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    building: '<path d="M4 21V6l8-4 8 4v15M9 21v-5h6v5M8 9h2m4 0h2M8 13h2m4 0h2" fill="none" stroke="currentColor" stroke-width="2"/>'
  };
  const icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="currentColor" ${cls ? 'class="' + cls + '"' : ''} aria-hidden="true">${I[n] || ''}</svg>`;

  /* ---------------- format ---------------- */
  const naira = n => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
  const naira2 = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dt = ts => new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const dOnly = ts => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const ago = ts => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  const hms = ms => {
    if (ms <= 0) return '00:00:00';
    const t = Math.floor(ms / 1000);
    return [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map(v => String(v).padStart(2, '0')).join(':');
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 220); }; };

  /* ---------------- toasts ---------------- */
  function toastRoot() {
    let r = document.querySelector('.toasts');
    if (!r) { r = document.createElement('div'); r.className = 'toasts'; document.body.appendChild(r); }
    return r;
  }
  function toast(msg, kind, opts) {
    kind = kind || 'info'; opts = opts || {};
    const undo = opts.undo && !(window.Store && window.Store.live) ? opts.undo : null;
    const map = { ok: 'check', err: 'alert', info: 'info', warn: 'alert' };
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.innerHTML = icon(map[kind] || 'info') +
      `<div style="flex:1;min-width:0"><b>${esc(msg)}</b>${opts.sub ? '<span>' + esc(opts.sub) + '</span>' : ''}</div>` +
      (undo ? '<button class="toast-undo" type="button">Undo</button>' : '');
    toastRoot().appendChild(el);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    if (undo) el.querySelector('.toast-undo').addEventListener('click', () => { undo(); kill(); });
    setTimeout(kill, undo ? 7000 : 3800);
    return kill;
  }

  /* ---------------- modal / sheet ---------------- */
  let openLayer = null;
  function layer(html, kind) {
    closeLayer();
    const wrap = document.createElement('div');
    wrap.className = kind === 'sheet' ? 'sheet-scrim' : 'scrim';
    wrap.innerHTML = kind === 'sheet'
      ? `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`
      : `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => wrap.classList.add('on'));
    wrap.addEventListener('click', e => { if (e.target === wrap) closeLayer(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeLayer));
    openLayer = wrap;
    const f = wrap.querySelector('input,select,textarea,button:not([data-close])');
    if (f) setTimeout(() => f.focus(), 260);
    return wrap;
  }
  function closeLayer() {
    if (!openLayer) return;
    const l = openLayer; openLayer = null;
    l.classList.remove('on');
    document.body.style.overflow = '';
    setTimeout(() => l.remove(), 340);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLayer(); });

  function confirmSheet({ title, body, confirmText, kind, onConfirm }) {
    const l = layer(`
      <div class="sheet-head"><h3>${esc(title)}</h3><button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      ${body}
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn--ghost" data-close style="flex:1">Cancel</button>
        <button class="btn btn--${kind || 'primary'}" id="cfmBtn" style="flex:1.4">${esc(confirmText || 'Confirm')}</button>
      </div>`, 'sheet');
    l.querySelector('#cfmBtn').addEventListener('click', async e => {
      const b = e.currentTarget; const old = b.innerHTML;
      b.disabled = true; b.innerHTML = '<i class="spin"></i> Working…';
      try { await onConfirm(); closeLayer(); }
      catch (err) { toast(err.message || 'Something went wrong', 'err'); b.disabled = false; b.innerHTML = old; }
    });
    return l;
  }

  /* ---------------- counters ---------------- */
  function countTo(el, target, fmt) {
    const dur = 850, t0 = performance.now(), from = 0;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (fmt || naira)(from + (target - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- image with fallback ---------------- */
  function imgWithFallback(src, fallback, alt) {
    return `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy"
      onerror="this.onerror=null;this.src='${fallback}'">`;
  }

  /* ---------------- shell ---------------- */
  const NAV = [
    ['dashboard.html', 'home', 'Board'],
    ['rents.html', 'rents', 'Fleet'],
    ['team.html', 'team', 'Crew'],
    ['profile.html', 'user', 'Account']
  ];

  function crest() {
    return `<span class="crest-mark"><svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M6 7h28v6H22v21h-6V13H6z" fill="#0F1216"/>
    </svg></span>`;
  }

  let dispatchTicker = null;
  function updateDispatchClock() {
    const clock = document.getElementById('watClock');
    if (clock) clock.textContent = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).format(new Date());
    const drop = document.getElementById('nextDropClock');
    if (drop) {
      let next = null;
      try { next = window.Store && Store.nextDrop ? Store.nextDrop() : null; } catch (e) {}
      drop.textContent = next ? hms(next - Date.now()) : 'NO ROUTE';
    }
  }

  function mountHeader({ title, back } = {}) {
    const h = document.getElementById('hdr'); if (!h) return;
    h.className = 'header';
    const impersonating = Store.impersonating && Store.impersonating();
    h.innerHTML = `<div class="header-in">
      ${back ? `<a class="back-btn" href="${back}" aria-label="Back">${icon('back')}</a>` : ''}
      <a class="crest" href="dashboard.html">${crest()}<span class="crest-txt"><b>Tranex</b><i>Dispatch network</i></span></a>
      ${title ? `<span class="header-title">${esc(title)}</span>` : ''}
      <div class="dispatch-data" aria-label="Dispatch timing">
        <span class="dispatch-readout"><small>WAT</small><b id="watClock">--:--:--</b></span>
        <span class="dispatch-divider" aria-hidden="true"></span>
        <span class="dispatch-readout drop"><small>NEXT DROP</small><b id="nextDropClock">NO ROUTE</b></span>
      </div>
      <span class="header-spacer"></span>
      <span class="dispatch-health"><i class="status-lamp" aria-hidden="true"></i>LIVE</span>
      <button class="icon-btn" id="hdrCare" aria-label="Customer care">${icon('headset')}</button>
      <button class="icon-btn" id="hdrBell" aria-label="Notifications">${icon('bell')}<i class="dot"></i></button>
    </div>${impersonating ? `<div style="background:#d92d20;color:#fff;padding:9px 14px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:12px;letter-spacing:.02em">Admin member session <button id="exitImpersonation" type="button" style="border:1px solid rgba(255,255,255,.6);border-radius:999px;background:rgba(255,255,255,.16);color:#fff;padding:6px 10px;font:inherit">Exit preview</button></div>` : ''}`;
    if (dispatchTicker) clearInterval(dispatchTicker);
    updateDispatchClock();
    dispatchTicker = setInterval(updateDispatchClock, 1000);
    const st = () => h.classList.toggle('is-stuck', window.scrollY > 8);
    window.addEventListener('scroll', st, { passive: true }); st();
    h.querySelector('#hdrCare').addEventListener('click', careSheet);
    h.querySelector('#hdrBell').addEventListener('click', bellSheet);
    h.querySelector('#exitImpersonation')?.addEventListener('click', async () => {
      const button = h.querySelector('#exitImpersonation');
      button.disabled = true; button.textContent = 'Exiting…';
      try { await Store.exitImpersonation(); } catch (err) { button.disabled = false; button.textContent = 'Exit preview'; toast(err.message, 'err'); }
    });
  }

  function mountNav(active) {
    const n = document.getElementById('nav'); if (!n) return;
    n.className = 'nav';
    n.innerHTML = NAV.map(([href, ic, label]) =>
      `<a class="nav-item ${href === active ? 'on' : ''}" href="${href}">${icon(ic)}<span>${label}</span></a>`
    ).join('');
  }

  /* ---------------- care + notifications ---------------- */
  function careSheet() {
    const s = Store.settings();
    layer(`
      <div class="sheet-head"><h3>${icon('headset')} Customer Care</h3><button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <p class="c-muted" style="font-size:13px;font-weight:600;margin-bottom:16px">Our team responds within minutes during business hours. Reach us on any channel below.</p>
      <div class="welcome-actions">
        <a class="wa-btn wa-btn--wa" href="${esc(s.support_link)}" target="_blank" rel="noopener">${icon('wa')}<span>WhatsApp Care<small>${esc(s.support_email)}</small></span>${icon('chev')}</a>
        <a class="wa-btn wa-btn--cs" href="${esc(s.telegram_link)}" target="_blank" rel="noopener">${icon('refer')}<span>Telegram Channel<small>Announcements &amp; support</small></span>${icon('chev')}</a>
        <a class="wa-btn" style="background:var(--g-pink);box-shadow:var(--sh-pink)" href="mailto:${esc(s.support_email)}">${icon('mail')}<span>Email Us<small>${esc(s.support_email)}</small></span>${icon('chev')}</a>
      </div>`, 'sheet');
  }

  function bellSheet() {
    const tx = Store.transactions().slice(0, 8);
    const rows = tx.length ? tx.map(t => {
      const inbound = ['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission'].includes(t.type);
      const ic = t.type === 'rental_income' ? 'in' : t.type === 'withdrawal' ? 'out' : t.type === 'lease_purchase' ? 'building' : 'gift';
      const cls = t.type === 'lease_purchase' ? 'rent' : t.type === 'withdrawal' ? 'out' : inbound ? 'in' : 'bonus';
      return `<div class="row"><span class="row-ic row-ic--${cls}">${icon(ic)}</span>
        <div class="row-main"><b>${esc(t.description)}</b><span>${ago(t.created_at)} · ${esc(t.reference)}</span></div>
        <div class="row-end"><div class="amt ${inbound ? 'in' : 'out'}">${inbound ? '+' : '−'}${naira(t.amount)}</div>
        <span class="tag tag--${t.status === 'completed' ? 'live' : t.status === 'pending' ? 'pending' : 'out'}">${t.status}</span></div></div>`;
    }).join('') : `<div class="empty"><div class="empty-art">${icon('bell')}</div><b>No activity yet</b><p>Your income drops and account events will appear here.</p></div>`;
    layer(`<div class="sheet-head"><h3>${icon('bell')} Activity</h3><button class="modal-x" data-close style="position:static">${icon('x')}</button></div><div class="rows">${rows}</div>`, 'sheet');
  }

  /* ---------------- guard ---------------- */
  const PUBLIC = [
    '', 'index.html', 'index',
    'register', 'register.html',
    'forgot-password', 'forgot-password.html',
    'reset-password', 'reset-password.html'
  ];
  function withTimeout(promise, ms, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
    ]).finally(() => clearTimeout(timer));
  }
  async function guard() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    try {
      const sess = await withTimeout(Store.session(), 10000, 'Authentication is taking too long. Please try again.');
      if (!sess && !PUBLIC.includes(page)) { location.replace('index.html'); return null; }
      if (sess && ['index.html', 'index', ''].includes(page)) { location.replace('dashboard.html'); return null; }
      if (sess && Store.live && !PUBLIC.includes(page))
        await withTimeout(Store.hydrate(), 20000, 'Loading your account took too long. Please refresh and try again.');
      return sess;
    } catch (err) {
      bootOff();
      toast('Unable to load your account data. ' + (err.message || 'Please try again.'), 'err');
      return null;
    }
  }

  /* ---------------- boot ---------------- */
  function bootOff() {
    const b = document.getElementById('boot'); if (!b) return;
    setTimeout(() => { b.classList.add('off'); setTimeout(() => b.remove(), 560); }, 420);
  }
  window.addEventListener('error', () => {
    if (document.getElementById('boot')) { bootOff(); toast('This page could not finish loading. Please refresh and try again.', 'err'); }
  });
  window.addEventListener('unhandledrejection', () => {
    if (document.getElementById('boot')) { bootOff(); toast('This page could not finish loading. Please refresh and try again.', 'err'); }
  });
  function field() {
    if (document.querySelector('.field')) return;
    const f = document.createElement('div');
    f.className = 'field'; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<div class="field-mesh"></div><div class="field-grid"></div><div class="field-grain"></div>';
    document.body.prepend(f);
  }

  window.UI = {
    icon, naira, naira2, esc, dt, dOnly, ago, hms, debounce,
    toast, layer, closeLayer, confirmSheet, countTo, imgWithFallback,
    mountHeader, mountNav, crest, careSheet, bellSheet, guard, bootOff, field
  };

  document.addEventListener('DOMContentLoaded', field);
})();
