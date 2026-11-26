/* ============================================================
   CSC APARTMENTS — Data engine (production, no demo data)
   Starts empty. Every record is created by real member activity.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.PINNACLE;
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const KEY = 'pinnacle.v2';
  const DAY = 86400000;

  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const now = () => Date.now();
  const clone = o => JSON.parse(JSON.stringify(o));
  const code6 = () => Array.from({ length: 6 }, () => 'ACDEFGHJKLMNPQRTUVWXY3479'[Math.random() * 25 | 0]).join('');
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); };
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------------- artwork fallbacks ---------------- */
  const PAL = {
    studio: ['#3D9BFF', '#1F6FEB', '#123A8F'], 'one-bed': ['#FF6FB0', '#EC2E86', '#C2186B'],
    'two-bed': ['#35D68C', '#14A867', '#0B7A4B'], 'three-bed': ['#FF6A5E', '#E23B33', '#B3121B'],
    duplex: ['#3D9BFF', '#EC2E86', '#123A8F'], penthouse: ['#EC2E86', '#1F6FEB', '#123A8F']
  };
  function facade(tier, seed) {
    const p = PAL[tier] || PAL.studio;
    let s = seed || 1; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const floors = { studio: 4, 'one-bed': 5, 'two-bed': 6, 'three-bed': 7, duplex: 8, penthouse: 10 }[tier] || 5;
    let win = '';
    for (let f = 0; f < floors; f++) for (let c = 0; c < 4; c++) {
      const lit = rnd() > .38;
      win += `<rect x="${26 + c * 15}" y="${92 - f * (74 / floors)}" width="10" height="${Math.max(5, 60 / floors - 3)}" rx="1.5" fill="${lit ? '#FFD9EC' : '#123A8F'}" opacity="${lit ? .92 : .45}"/>`;
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs><rect width="120" height="120" fill="url(#s)"/><circle cx="94" cy="24" r="13" fill="#fff" opacity=".26"/><path d="M0 104 L20 96 L44 104 L70 94 L96 104 L120 96 L120 120 L0 120Z" fill="${p[2]}" opacity=".55"/><rect x="20" y="16" width="72" height="88" rx="3" fill="url(#b)"/><rect x="20" y="16" width="72" height="6" rx="3" fill="#FFD9EC" opacity=".8"/>${win}<rect x="50" y="92" width="14" height="12" rx="1.5" fill="#FFD9EC" opacity=".95"/></svg>`);
  }
  function banner(i) {
    const sets = [
      ['#123A8F', '#1F6FEB', '#3D9BFF', 'Riverside Tower', 'Waterfront residences · Lekki Phase 1'],
      ['#C2186B', '#EC2E86', '#FF6FB0', 'The CSC Collection', 'Six tiers of managed rental income'],
      ['#0B7A4B', '#14A867', '#35D68C', 'Income Every 24 Hours', 'Automatic drops, tracked to the second']
    ];
    const c = sets[i % sets.length];
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/><g opacity=".2" fill="#fff"><rect x="700" y="150" width="110" height="450"/><rect x="830" y="80" width="130" height="520"/><rect x="980" y="200" width="100" height="400"/><rect x="600" y="260" width="80" height="340"/></g><circle cx="200" cy="130" r="70" fill="#fff" opacity=".18"/><path d="M0 520 L200 480 L420 530 L640 470 L900 530 L1200 480 L1200 600 L0 600Z" fill="${c[0]}" opacity=".45"/></svg>`);
  }

  /* ---------------- product configuration ---------------- */
  const DEFAULT_SETTINGS = {
    min_deposit: 3000, max_deposit: 5000000, min_withdrawal: 2000, max_withdrawal: 3000000,
    withdrawal_fee: 8, withdrawals_per_day: 2, referral_l1: 10, referral_l2: 3, referral_l3: 1,
    income_days: 30, income_drop_days: '1,2,3,4,5', welcome_bonus: 500, checkin_bonus: 50, streak_7: 5, streak_14: 10, streak_30: 20,
    withdrawal_days: [1, 2, 3, 4, 5, 6, 0], withdrawal_start: '08:00', withdrawal_end: '18:00', withdrawal_mode: 'review',
    bank_name: 'Guaranty Trust Bank', account_number: '0123456789', account_name: 'Opex Logistics Ltd',
    whatsapp_link: 'https://chat.whatsapp.com/HdKsgo89Oi1LUBqMbI9Rmp?s=cl&p=a&mlu=4&ilr=4&iam=2', telegram_link: 'https://t.me/pinnacleapartments',
    support_link: 'https://wa.me/2348000000000', support_email: 'care@pinnacleapartments.ng'
  };
  const UNIT_SEED = [
    ['studio', 'Studio Suite', 'Studio', 15000, 1200, 30, 5, 1, 1, 34],
    ['one-bed', 'One-Bedroom Residence', '1 Bedroom', 45000, 3800, 45, 5, 1, 1, 58],
    ['two-bed', 'Two-Bedroom Terrace', '2 Bedroom', 120000, 10500, 60, 4, 2, 2, 96],
    ['three-bed', 'Three-Bedroom Maisonette', '3 Bedroom', 300000, 27000, 75, 3, 3, 2, 142],
    ['duplex', 'Executive Duplex', 'Duplex', 750000, 70000, 90, 2, 4, 3, 210],
    ['penthouse', 'Sky Penthouse', 'Penthouse', 2000000, 195000, 120, 1, 5, 4, 340]
  ];
  const INBOUND = ['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission', 'admin_credit'];

  /* ---------------- empty, production-ready seed ---------------- */
  function seed() {
    return {
      v: 1,
      settings: clone(DEFAULT_SETTINGS),
      units: UNIT_SEED.map((u, i) => ({
        id: uid(), slug: u[0], name: u[1], tier: u[2], price: u[3], daily_yield: u[4],
        duration_days: u[5], purchase_limit: u[6], bedrooms: u[7], bathrooms: u[8], sqm: u[9],
        image_url: '', status: i === 4 ? 'upcoming' : 'live', sort_order: i, sold: 0,
        amenities: ['24/7 Power', 'Fibre WiFi', 'Secure Parking', 'CCTV', 'Water Treatment'].slice(0, 3 + (i % 3)),
        description: 'Fully serviced and professionally managed. Rental income is distributed automatically every 24 hours from the moment your lease begins.'
      })),
      users: [], leases: [], cards: [], tx: [], checkins: [], commissions: [],
      gift_codes: [], redemptions: [], cron: [], audit: [],
      session: null, resets: {}
    };
  }

  /* ---------------- persistence ---------------- */
  let db;
  try { const raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : seed(); if (!db || db.v !== 1) db = seed(); }
  catch (e) { db = seed(); }
  if (LIVE) db = seed();
  ['users', 'leases', 'cards', 'tx', 'checkins', 'commissions', 'gift_codes', 'redemptions', 'cron', 'audit'].forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
  if (!db.units || !db.units.length) db.units = seed().units;
  db.settings = Object.assign(clone(DEFAULT_SETTINGS), db.settings || {});
  const save = () => {
    if (LIVE) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
  };
  save();

  const undoStack = [];
  const snapshot = label => { undoStack.push({ label, data: clone(db) }); if (undoStack.length > 25) undoStack.shift(); };

  let sb = null;
  if (LIVE) { sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY); window.sb = sb; }
  let liveWallet = null;
  function clearLive() {
    liveWallet = null; db.session = null; db.users = []; db.leases = []; db.cards = [];
    db.tx = []; db.checkins = []; db.commissions = [];
  }
  const asTime = v => {
    if (typeof v === 'number') return v;
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : now();
  };
  const asNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  function normalizedSettings(source) {
    const s = Object.assign(clone(DEFAULT_SETTINGS), source || {});
    ['min_deposit', 'max_deposit', 'min_withdrawal', 'max_withdrawal', 'withdrawal_fee',
      'withdrawals_per_day', 'referral_l1', 'referral_l2', 'referral_l3', 'income_days',
      'welcome_bonus', 'checkin_bonus', 'streak_7', 'streak_14', 'streak_30']
      .forEach(k => { s[k] = asNumber(s[k]); });
    if (typeof s.withdrawal_days === 'string') s.withdrawal_days = s.withdrawal_days.split(',').map(Number);
    return s;
  }
  async function apiRequest(path, token, method = 'GET', payload = null) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const response = await fetch(path, {
        method,
        headers: Object.assign({ Authorization: 'Bearer ' + token }, payload ? { 'Content-Type': 'application/json' } : {}),
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller ? controller.signal : undefined
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.error || 'Server request failed (' + response.status + ').');
      return result;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
      throw e;
    } finally { if (timer) clearTimeout(timer); }
  }
  function impersonationContext() {
    try {
      const raw = sessionStorage.getItem('pinnacle.impersonation');
      if (!raw) return null;
      const context = JSON.parse(raw);
      if (!context?.token || (context.expires_at && Date.parse(context.expires_at) <= Date.now())) {
        sessionStorage.removeItem('pinnacle.impersonation'); return null;
      }
      return context;
    } catch (e) { return null; }
  }
  function memberRequest(path, token, method = 'GET', payload = null) {
    const context = impersonationContext();
    if (!context) return apiRequest(path, token, method, payload);
    return fetch(path, {
      method,
      headers: Object.assign({ Authorization: 'Bearer ' + token, 'X-Impersonation-Token': context.token }, payload ? { 'Content-Type': 'application/json' } : {}),
      body: payload ? JSON.stringify(payload) : undefined
    }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.error || 'Server request failed (' + response.status + ').');
      return result;
    });
  }
  async function liveRequest(path, method, payload) {
    if (!LIVE) throw new Error('Live account service is not available.');
    const { data, error } = await sb.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session has expired. Please sign in again.');
    return memberRequest(path, token, method, payload);
  }
  async function refreshLive() {
    try { return await S.hydrate(); }
    catch (e) { console.warn('Live account refresh failed:', e.message); return null; }
  }

  /* ---------------- wallet + income sweep ---------------- */
  function walletOf(userId) {
    let bal = 0, inc = 0, locked = 0;
    db.tx.forEach(t => {
      if (t.user_id !== userId) return;
      if (t.status === 'completed') {
        if (INBOUND.includes(t.type)) bal += Number(t.net_amount);
        else bal -= Number(t.amount);
        if (t.type === 'rental_income') inc += Number(t.net_amount);
      }
      if (t.status === 'pending' && t.type === 'withdrawal') locked += Number(t.amount);
    });
    return { balance: Math.max(0, Math.round(bal * 100) / 100), income: inc, locked };
  }

  function sweep() {
    if (LIVE) return { paid: 0, amount: 0, completed: 0 };
    const t = now(); let paid = 0, amount = 0, completed = 0;
    db.leases.forEach(l => {
      if (l.status !== 'active') return;
      const u = db.units.find(x => x.id === l.unit_id); if (!u) return;
      const duration = Number(l.duration_days ?? u.duration_days);
      const dailyYield = Number(l.daily_yield ?? u.daily_yield);
      const dropDays = String(l.income_drop_days ?? u.income_drop_days ?? db.settings.income_drop_days ?? '1,2,3,4,5')
        .split(',').map(Number);
      const elapsed = Math.max(0, Math.floor((t - l.started_at) / DAY));
      let target = 0;
      for (let offset = 1; offset <= elapsed; offset++) {
        if (dropDays.includes(new Date(l.started_at + offset * DAY).getDay())) target++;
      }
      target = Math.min(target, duration);
      while (l.days_paid < target) {
        l.days_paid++;
        const r = 'INC-' + l.id.slice(0, 6) + '-' + l.days_paid;
        if (db.tx.some(x => x.reference === r)) continue;
        db.tx.push({ id: uid(), user_id: l.user_id, type: 'rental_income', amount: dailyYield, fee: 0, net_amount: dailyYield, description: u.name + ' · drop ' + l.days_paid, reference: r, status: 'completed', created_at: l.started_at + l.days_paid * DAY });
        l.total_collected += dailyYield; paid++; amount += dailyYield;
      }
      if (l.days_paid >= duration) { l.status = 'completed'; completed++; }
    });
    if (paid || completed) {
      db.cron.unshift({ at: t, paid, amount, completed, ok: true });
      if (db.cron.length > 40) db.cron.length = 40;
      save();
    }
    return { paid, amount, completed };
  }

  /* ---------------- public API ---------------- */
  const S = {
    live: LIVE, sb, DAY, facade, banner, dayKey, isIn: t => INBOUND.includes(t.type),

    async session() {
      if (LIVE) {
        const { data, error } = await sb.auth.getSession();
        if (error) throw new Error(error.message);
        if (!data.session) { clearLive(); return null; }
        const context = impersonationContext();
        return { user: { id: context?.user_id || data.session.user.id, email: data.session.user.email }, impersonating: !!context };
      }
      return db.session ? { user: db.users.find(u => u.id === db.session) } : null;
    },
    async hydrate() {
      if (!LIVE) return this.session();
      const { data, error } = await sb.auth.getSession();
      if (error) throw new Error(error.message);
      const session = data.session;
      if (!session) { clearLive(); return null; }
      const token = session.access_token;
      const profileRes = await memberRequest('/api/auth-profile', token);
      const id = profileRes.profile?.id || session.user.id;
      const [walletRes, unitsRes, networkRes, checkinRes] = await Promise.all([
        memberRequest('/api/wallet', token),
        memberRequest('/api/units', token),
        memberRequest('/api/network', token),
        memberRequest('/api/checkin', token)
      ]);
      const profile = profileRes.profile;
      if (!profile) throw new Error('Your member profile could not be found. Please contact support.');
      const wallet = walletRes.wallet || profileRes.wallet;
      if (!wallet) throw new Error('Your wallet could not be loaded. Please try again.');
      const settings = normalizedSettings(walletRes.settings || profileRes.settings);
      const me = Object.assign({}, profile, {
        id, email: session.user.email || profile.email || '',
        created_at: asTime(profile.created_at),
        total_funded: asNumber(profile.total_funded), total_withdrawn: asNumber(profile.total_withdrawn)
      });
      const levels = networkRes.levels || { l1: [], l2: [], l3: [] };
      const peers = [];
      [['l1', 'referred_by'], ['l2', 'upline_2'], ['l3', 'upline_3']].forEach(([level, relation]) => {
        (levels[level] || []).forEach(row => peers.push(Object.assign({}, row, {
          id: row.id, [relation]: id, created_at: asTime(row.created_at), total_funded: asNumber(row.total_funded)
        })));
      });
      const units = (unitsRes.units || []).map(u => Object.assign({}, u, {
        price: asNumber(u.price), daily_yield: asNumber(u.daily_yield), duration_days: asNumber(u.duration_days),
        purchase_limit: asNumber(u.purchase_limit), bedrooms: asNumber(u.bedrooms), bathrooms: asNumber(u.bathrooms),
        sqm: asNumber(u.sqm), sold: asNumber(u.sold), sort_order: asNumber(u.sort_order)
      }));
      db.session = id;
      db.users = [me, ...peers];
      db.settings = settings;
      db.units = units;
      db.leases = (profileRes.leases || []).map(l => Object.assign({}, l, {
        started_at: asTime(l.started_at), days_paid: asNumber(l.days_paid), total_collected: asNumber(l.total_collected),
        unit_price: l.unit_price == null ? null : asNumber(l.unit_price),
        daily_yield: l.daily_yield == null ? null : asNumber(l.daily_yield),
        duration_days: l.duration_days == null ? null : asNumber(l.duration_days)
      }));
      db.tx = (walletRes.transactions || []).map(t => Object.assign({}, t, {
        amount: asNumber(t.amount), fee: asNumber(t.fee), net_amount: asNumber(t.net_amount), created_at: asTime(t.created_at)
      }));
      db.cards = (walletRes.cards || profileRes.cards || []).map(c => Object.assign({}, c, { created_at: asTime(c.created_at) }));
      db.checkins = (checkinRes.history || []).map(c => ({
        id: c.id, user_id: id, date: c.checkin_date, base: asNumber(c.base_amount),
        bonus: asNumber(c.total_amount) - asNumber(c.base_amount), total: asNumber(c.total_amount),
        streak: asNumber(c.streak_at_time), created_at: asTime(c.created_at)
      }));
      db.commissions = networkRes.commissions || [];
      liveWallet = {
        balance: asNumber(wallet.balance), income: asNumber(wallet.income_balance), locked: asNumber(wallet.locked)
      };
      return { user: { id, email: me.email } };
    },
    impersonating() { return !!impersonationContext(); },
    async exitImpersonation() {
      const context = impersonationContext();
      if (!context) return;
      const { data, error } = await sb.auth.getSession();
      if (error) throw new Error(error.message);
      if (data.session) await apiRequest('/api/admin', data.session.access_token, 'POST', { action: 'end_impersonation', payload: { user_id: context.user_id, token: context.token } });
      sessionStorage.removeItem('pinnacle.impersonation');
      location.href = 'admin/index.html#users';
    },
    me() { return db.session ? db.users.find(u => u.id === db.session) : null; },
    settings() { return clone(db.settings); },
    setting(k) { return db.settings[k]; },
    wallet() {
      if (LIVE) return liveWallet ? clone(liveWallet) : { balance: 0, income: 0, locked: 0 };
      const m = this.me(); return m ? clone(walletOf(m.id)) : { balance: 0, income: 0, locked: 0 };
    },

    units(filter) {
      let list = db.units.filter(u => u.status !== 'hidden' && u.status !== 'deleted');
      if (filter === 'live') list = list.filter(u => u.status === 'live');
      return clone(list.sort((a, b) => a.sort_order - b.sort_order));
    },
    unit(id) { return clone(db.units.find(u => u.id === id)); },
    ownedCount(unitId) { const m = this.me(); return m ? db.leases.filter(l => l.user_id === m.id && l.unit_id === unitId && l.status === 'active').length : 0; },

    leases() {
      const m = this.me(); if (!m) return [];
      return db.leases.filter(l => l.user_id === m.id)
        .map(l => {
          const unit = clone(db.units.find(x => x.id === l.unit_id));
          if (unit) {
            if (l.unit_price != null) unit.price = Number(l.unit_price);
            if (l.daily_yield != null) unit.daily_yield = Number(l.daily_yield);
            if (l.duration_days != null) unit.duration_days = Number(l.duration_days);
            unit.income_drop_days = l.income_drop_days || unit.income_drop_days || db.settings.income_drop_days;
          }
          return Object.assign(clone(l), { unit });
        })
        .sort((a, b) => b.started_at - a.started_at);
    },
    nextDrop() {
      const ls = this.leases().filter(l => l.status === 'active' && l.days_paid < l.unit.duration_days);
      return ls.length ? Math.min.apply(null, ls.map(l => l.started_at + (l.days_paid + 1) * DAY)) : null;
    },
    dailyIncome() { return this.leases().filter(l => l.status === 'active').reduce((s, l) => s + l.unit.daily_yield, 0); },

    transactions(type) {
      const m = this.me(); if (!m) return [];
      let list = db.tx.filter(t => t.user_id === m.id);
      if (type && type !== 'all') list = list.filter(t => t.type === type);
      return clone(list.sort((a, b) => b.created_at - a.created_at));
    },

    cards() { const m = this.me(); return m ? clone(db.cards.filter(c => c.user_id === m.id)) : []; },
    defaultCard() { const c = this.cards(); return c.find(x => x.is_default) || c[0] || null; },

    team() {
      const m = this.me(); if (!m) return { l1: [], l2: [], l3: [] };
      const pickL = id => db.users.filter(u => u[id === 1 ? 'referred_by' : id === 2 ? 'upline_2' : 'upline_3'] === m.id)
        .map(u => ({ id: u.id, full_name: u.full_name, created_at: u.created_at, has_funded: u.has_funded, total_funded: u.total_funded }))
        .sort((a, b) => b.created_at - a.created_at);
      return { l1: pickL(1), l2: pickL(2), l3: pickL(3) };
    },

    checkinState() {
      const m = this.me(); if (!m) return { claimed: false, streak: 0, longest: 0, calendar: [], bonus: 0 };
      const today = dayKey(now());
      const mine = db.checkins.filter(c => c.user_id === m.id);
      const y = new Date(), ym = y.getFullYear(), mo = y.getMonth();
      const days = new Date(ym, mo + 1, 0).getDate();
      const cal = [];
      for (let d = 1; d <= days; d++) {
        const k = dayKey(new Date(ym, mo, d).getTime());
        const hit = mine.some(c => c.date === k);
        cal.push({ d, hit, isToday: k === today, future: d > y.getDate(), miss: !hit && d < y.getDate() && k !== today });
      }
      return { claimed: mine.some(c => c.date === today), streak: m.streak_days, longest: m.longest_streak, calendar: cal, bonus: db.settings.checkin_bonus };
    },

    withdrawRules() {
      const s = db.settings;
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CFG.TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find(p => p.type === 'weekday').value];
      const cur = +parts.find(p => p.type === 'hour').value * 60 + +parts.find(p => p.type === 'minute').value;
      const toMin = t => { const a = t.split(':'); return +a[0] * 60 + +a[1]; };
      const m = this.me(); const today = dayKey(now());
      return {
        open: s.withdrawal_days.includes(wd) && cur >= toMin(s.withdrawal_start) && cur < toMin(s.withdrawal_end),
        usedToday: m ? db.tx.filter(t => t.user_id === m.id && t.type === 'withdrawal' && t.status !== 'rejected' && dayKey(t.created_at) === today).length : 0,
        pending: m ? db.tx.some(t => t.user_id === m.id && t.type === 'withdrawal' && t.status === 'pending') : false,
        cap: s.withdrawals_per_day, min: s.min_withdrawal, max: s.max_withdrawal, fee: s.withdrawal_fee,
        window: s.withdrawal_start + ' – ' + s.withdrawal_end,
        days: s.withdrawal_days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
      };
    },

    giftCodes() { return clone(db.gift_codes); },
    async redeemCode(code) {
      code = String(code || '').trim().toUpperCase();
      if (!code) throw new Error('Enter a gift code.');
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const g = db.gift_codes.find(x => x.code === code);
      if (!g) throw new Error('That gift code is not valid.');
      if (!g.is_active) throw new Error('This gift code is no longer active.');
      if (g.expires_at && g.expires_at < now()) throw new Error('This gift code has expired.');
      if (g.max_uses && g.used_count >= g.max_uses) throw new Error('This gift code has been fully redeemed.');
      if (db.redemptions.some(r => r.code_id === g.id && r.user_id === m.id)) throw new Error('You have already redeemed this code.');
      snapshot('Redeem gift code');
      db.redemptions.push({ id: uid(), code_id: g.id, user_id: m.id, amount: g.amount, created_at: now() });
      g.used_count = (g.used_count || 0) + 1;
      db.tx.push({ id: uid(), user_id: m.id, type: 'welcome_bonus', amount: g.amount, fee: 0, net_amount: g.amount, description: 'Gift code ' + g.code + ' redeemed', reference: 'GIFT-' + code6(), status: 'completed', created_at: now() });
      save();
      return { amount: g.amount, code: g.code };
    },
    giftHistory() {
      const m = this.me(); if (!m) return [];
      return db.tx.filter(t => t.user_id === m.id && t.description.indexOf('Gift code') === 0).sort((a, b) => b.created_at - a.created_at);
    },

    /* ---- auth ---- */
    async register({ email, password, invite }) {
      email = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (LIVE) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { invite: invite || null } } });
        if (error) throw new Error(error.message);
        return { needsVerify: !data.session, email };
      }
      if (db.users.some(u => u.email === email)) throw new Error('An account with this email already exists.');
      let ref = null, u2 = null, u3 = null;
      if (invite) {
        const inv = db.users.find(u => u.referral_code === invite.toUpperCase());
        if (!inv) throw new Error('That invitation code is not valid.');
        ref = inv.id; u2 = inv.referred_by; u3 = inv.upline_2;
      }
      const u = {
        id: uid(), email, phone: '', full_name: 'Member', pass: hash(password),
        referral_code: 'PNC' + code6().slice(0, 3), referred_by: ref, upline_2: u2, upline_3: u3,
        is_admin: false, is_active: true, has_funded: false, total_funded: 0, total_withdrawn: 0,
        streak_days: 0, longest_streak: 0, last_checkin: null, verified: true, created_at: now()
      };
      db.users.push(u);
      db.tx.push({ id: uid(), user_id: u.id, type: 'welcome_bonus', amount: db.settings.welcome_bonus, fee: 0, net_amount: db.settings.welcome_bonus, description: 'Welcome bonus', reference: 'WEL-' + code6(), status: 'completed', created_at: now() });
      save();
      return { needsVerify: false, email };
    },

    async login(email, password) {
      email = String(email || '').trim().toLowerCase();
      if (LIVE) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        return true;
      }
      const u = db.users.find(x => x.email === email);
      if (!u || u.pass !== hash(password)) throw new Error('Email or password is incorrect.');
      if (!u.is_active) throw new Error('This account has been suspended. Contact customer care.');
      db.session = u.id; save(); sweep();
      return true;
    },
    async logout() {
      if (LIVE) { await sb.auth.signOut(); clearLive(); return; }
      db.session = null; save();
    },

    async requestReset(email) {
      email = String(email || '').trim().toLowerCase();
      if (LIVE) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password.html' }); if (error) throw new Error(error.message); return null; }
      const u = db.users.find(x => x.email === email);
      if (!u) return null;
      const tok = code6() + code6();
      db.resets[tok] = { user: u.id, exp: now() + 3600000 }; save();
      return tok;
    },
    async resetPassword(token, password) {
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (LIVE) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(error.message); return true; }
      const r = db.resets[token];
      if (!r || r.exp < now()) throw new Error('This reset link is invalid or has expired.');
      db.users.find(x => x.id === r.user).pass = hash(password);
      delete db.resets[token]; save(); return true;
    },

    /* ---- money & leases ---- */
    async rent(unitId) {
      if (LIVE) {
        const result = await liveRequest('/api/units', 'POST', { action: 'lease', unit_id: unitId });
        await refreshLive();
        return { unit: this.unit(unitId), message: result.message };
      }
      const m = this.me(); if (!m) throw new Error('Sign in to lease a unit.');
      const u = db.units.find(x => x.id === unitId);
      if (!u) throw new Error('That unit no longer exists.');
      if (u.status !== 'live') throw new Error('This unit is not open for leasing yet.');
      const owned = db.leases.filter(l => l.user_id === m.id && l.unit_id === unitId && l.status === 'active').length;
      if (owned >= u.purchase_limit) throw new Error('You have reached the ' + u.purchase_limit + '× limit for this unit.');
      const w = walletOf(m.id);
      if (w.balance - w.locked < u.price) throw new Error('Insufficient balance. Fund your wallet to lease this unit.');
      snapshot('Lease ' + u.name);
      db.tx.push({ id: uid(), user_id: m.id, type: 'lease_purchase', amount: u.price, fee: 0, net_amount: u.price, description: 'Leased ' + u.name, reference: 'LSE-' + code6(), status: 'completed', created_at: now() });
      db.leases.push({
        id: uid(), user_id: m.id, unit_id: u.id, unit_price: u.price,
        daily_yield: u.daily_yield, duration_days: u.duration_days,
        income_drop_days: u.income_drop_days || db.settings.income_drop_days,
        status: 'active', days_paid: 0, total_collected: 0, started_at: now()
      });
      u.sold++; save();
      return { unit: u };
    },

    async saveCard({ bank_name, account_number, account_name, makeDefault }) {
      if (LIVE) {
        const result = await liveRequest('/api/auth-profile', 'POST', {
          action: 'save_card', bank_name, account_number, account_name, make_default: !!makeDefault
        });
        await refreshLive();
        return result;
      }
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      if (!bank_name) throw new Error('Select your bank.');
      if (!/^\d{10}$/.test(account_number)) throw new Error('Account number must be exactly 10 digits.');
      if (!account_name || account_name.trim().length < 3) throw new Error('Enter the account name.');
      if (db.cards.some(c => c.user_id === m.id && c.account_number === account_number)) throw new Error('That account is already saved.');
      snapshot('Save card');
      const first = db.cards.filter(c => c.user_id === m.id).length === 0;
      if (makeDefault || first) db.cards.forEach(c => { if (c.user_id === m.id) c.is_default = false; });
      db.cards.push({ id: uid(), user_id: m.id, bank_name, bank_code: '', account_number, account_name: account_name.trim(), is_default: makeDefault || first, created_at: now() });
      save(); return {};
    },
    async setDefaultCard(id) {
      if (LIVE) {
        const result = await liveRequest('/api/auth-profile', 'POST', { action: 'default_card', id });
        await refreshLive();
        return result;
      }
      const m = this.me(); snapshot('Default card');
      db.cards.forEach(c => { if (c.user_id === m.id) c.is_default = c.id === id; });
      save(); return {};
    },
    async deleteCard(id) {
      if (LIVE) {
        const result = await liveRequest('/api/auth-profile', 'POST', { action: 'delete_card', id });
        await refreshLive();
        return result;
      }
      const m = this.me(); snapshot('Delete card');
      const i = db.cards.findIndex(c => c.id === id && c.user_id === m.id);
      if (i < 0) throw new Error('Card not found.');
      const wasDef = db.cards[i].is_default;
      db.cards.splice(i, 1);
      const rest = db.cards.filter(c => c.user_id === m.id);
      if (wasDef && rest.length) rest[0].is_default = true;
      save(); return {};
    },

    async deposit(amount, senderName) {
      senderName = String(senderName || '').trim().slice(0, 80);
      if (LIVE) {
        const result = await liveRequest('/api/wallet', 'POST', { action: 'deposit', amount: Number(amount), sender_name: senderName });
        await refreshLive();
        return { reference: result.reference, checkoutUrl: result.checkout_url, message: result.message };
      }
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const s = db.settings; amount = Number(amount);
      if (!amount || amount < s.min_deposit) throw new Error('Minimum deposit is ₦' + s.min_deposit.toLocaleString() + '.');
      if (amount > s.max_deposit) throw new Error('Maximum deposit is ₦' + s.max_deposit.toLocaleString() + '.');
      snapshot('Deposit request');
      const ref = 'DEP-' + code6();
      db.tx.push({ id: uid(), user_id: m.id, type: 'deposit', amount, fee: 0, net_amount: amount, description: 'Bank transfer deposit' + (senderName ? ' · Sender: ' + senderName : ''), reference: ref, status: 'pending', created_at: now() });
      save();
      return { reference: ref };
    },

    async withdraw(amount, cardId) {
      if (LIVE) {
        const result = await liveRequest('/api/wallet', 'POST', { action: 'withdraw', amount: Number(amount), card_id: cardId });
        await refreshLive();
        return { reference: result.reference, fee: asNumber(result.fee), net: asNumber(result.net), message: result.message };
      }
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const r = this.withdrawRules(), w = walletOf(m.id); amount = Number(amount);
      const card = db.cards.find(c => c.id === cardId && c.user_id === m.id);
      if (!card) throw new Error('Save a payout card before withdrawing.');
      if (!this.leases().some(l => l.status === 'active')) throw new Error('You need at least one active lease to withdraw.');
      if (!amount || amount < r.min) throw new Error('Minimum withdrawal is ₦' + r.min.toLocaleString() + '.');
      if (amount > r.max) throw new Error('Maximum withdrawal is ₦' + r.max.toLocaleString() + '.');
      if (amount > w.balance - w.locked) throw new Error('Insufficient available balance.');
      if (r.pending) throw new Error('You already have a withdrawal awaiting review.');
      if (r.usedToday >= r.cap) throw new Error('Daily limit reached — ' + r.cap + ' withdrawals per day.');
      if (!r.open) throw new Error('Withdrawals are closed. Window: ' + r.days + ', ' + r.window + ' (WAT).');
      snapshot('Withdrawal request');
      const fee = Math.round(amount * r.fee) / 100;
      const ref = 'WTH-' + code6();
      db.tx.push({ id: uid(), user_id: m.id, type: 'withdrawal', amount, fee, net_amount: amount - fee, description: 'Withdrawal to ' + card.bank_name, reference: ref, status: 'pending', created_at: now(), bank_name: card.bank_name, account_number: card.account_number, account_name: card.account_name });
      save();
      return { reference: ref, fee, net: amount - fee };
    },

    async checkin() {
      if (LIVE) {
        const result = await liveRequest('/api/checkin', 'POST', { action: 'claim' });
        await refreshLive();
        return { base: asNumber(result.base), bonus: asNumber(result.bonus), total: asNumber(result.total), streak: asNumber(result.streak), pct: asNumber(result.pct) };
      }
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      const today = dayKey(now());
      if (db.checkins.some(c => c.user_id === m.id && c.date === today)) throw new Error('You have already checked in today.');
      snapshot('Check-in');
      m.streak_days = m.last_checkin === dayKey(now() - DAY) ? m.streak_days + 1 : 1;
      m.longest_streak = Math.max(m.longest_streak, m.streak_days);
      m.last_checkin = today;
      const s = db.settings;
      const pct = m.streak_days >= 30 ? s.streak_30 : m.streak_days >= 14 ? s.streak_14 : m.streak_days >= 7 ? s.streak_7 : 0;
      const base = s.checkin_bonus, bonus = Math.round(base * pct) / 100;
      db.checkins.push({ id: uid(), user_id: m.id, date: today, base, bonus, total: base + bonus, streak: m.streak_days, created_at: now() });
      db.tx.push({ id: uid(), user_id: m.id, type: 'checkin_bonus', amount: base + bonus, fee: 0, net_amount: base + bonus, description: 'Attendance day ' + m.streak_days + (pct ? ' · +' + pct + '% streak' : ''), reference: 'CHK-' + code6(), status: 'completed', created_at: now() });
      save();
      return { base, bonus, total: base + bonus, streak: m.streak_days, pct };
    },

    async updateProfile(patch) {
      if (LIVE) {
        const result = await liveRequest('/api/auth-profile', 'POST', Object.assign({ action: 'update_profile' }, patch));
        await refreshLive();
        return result;
      }
      const m = this.me(); if (!m) throw new Error('Sign in first.');
      snapshot('Profile'); Object.assign(m, patch); save(); return {};
    },

    sweep,
    undo() { if (LIVE) return false; const s = undoStack.pop(); if (!s) return false; const sess = db.session; db = s.data; db.session = sess; save(); return s.label; },
    canUndo() { return !LIVE && undoStack.length > 0; },
    reset() { if (LIVE) { clearLive(); return; } db = seed(); save(); }
  };

  window.Store = S;
  sweep();
  setInterval(() => { const r = sweep(); if (r.paid) window.dispatchEvent(new CustomEvent('pinnacle:income', { detail: r })); }, 60000);
})();
