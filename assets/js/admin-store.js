/* ============================================================
   CSC APARTMENTS — Console data engine (production)
   Shares the member store key. No seeding, no demo records.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'pinnacle.v2';
  const DAY = 86400000;
  const now = () => Date.now();
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const clone = o => JSON.parse(JSON.stringify(o));
  const code6 = () => Array.from({ length: 6 }, () => 'ACDEFGHJKLMNPQRTUVWXY3479'[Math.random() * 25 | 0]).join('');
  const ref = p => p + '-' + code6();
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
    const sets = [['#123A8F', '#1F6FEB', '#3D9BFF'], ['#C2186B', '#EC2E86', '#FF6FB0'], ['#0B7A4B', '#14A867', '#35D68C']];
    const c = sets[i % 3];
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/><g opacity=".2" fill="#fff"><rect x="700" y="150" width="110" height="450"/><rect x="830" y="80" width="130" height="520"/><rect x="980" y="200" width="100" height="400"/></g><circle cx="200" cy="130" r="70" fill="#fff" opacity=".18"/></svg>`);
  }

  const DEFAULTS = {
    min_deposit: 3000, max_deposit: 5000000, min_withdrawal: 2000, max_withdrawal: 3000000,
    withdrawal_fee: 8, withdrawals_per_day: 2, referral_l1: 10, referral_l2: 3, referral_l3: 1,
    income_days: 30, income_drop_days: '1,2,3,4,5', welcome_bonus: 500, checkin_bonus: 50, streak_7: 5, streak_14: 10, streak_30: 20,
    withdrawal_days: [1, 2, 3, 4, 5, 6, 0], withdrawal_start: '08:00', withdrawal_end: '18:00',
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

  function baseSeed() {
    return {
      v: 1, settings: clone(DEFAULTS),
      units: UNIT_SEED.map((u, i) => ({
        id: uid(), slug: u[0], name: u[1], tier: u[2], price: u[3], daily_yield: u[4],
        duration_days: u[5], purchase_limit: u[6], bedrooms: u[7], bathrooms: u[8], sqm: u[9],
        image_url: '', status: i === 4 ? 'upcoming' : 'live', sort_order: i, sold: 0,
        amenities: ['24/7 Power', 'Fibre WiFi', 'Secure Parking', 'CCTV', 'Water Treatment'].slice(0, 3 + (i % 3)),
        description: 'Fully serviced and professionally managed. Rental income is distributed automatically every 24 hours from the moment your lease begins.'
      })),
      users: [], leases: [], cards: [], tx: [], checkins: [], commissions: [],
      gift_codes: [], redemptions: [], cron: [], audit: [], session: null, resets: {}
    };
  }

  /* ---------------- persistence (read-only of shared state) ---------------- */
  function read() {
    let db;
    try { const raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : null; } catch (e) { db = null; }
    if (!db || db.v !== 1) db = baseSeed();
    db.settings = Object.assign(clone(DEFAULTS), db.settings || {});
    ['users', 'leases', 'cards', 'tx', 'checkins', 'commissions', 'gift_codes', 'redemptions', 'cron', 'audit'].forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
    if (!db.units || !db.units.length) db.units = baseSeed().units;
    return db;
  }
  function write(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  let DB = read();
  const undoStack = [];
  function commit(label, fn) {
    undoStack.push({ label, data: clone(DB) });
    if (undoStack.length > 30) undoStack.shift();
    DB = read();
    const out = fn(DB);
    write(DB);
    return out;
  }

  /* ---------------- derived ---------------- */
  const IN = ['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission', 'admin_credit'];
  function walletOf(db, id) {
    let bal = 0, inc = 0, locked = 0;
    db.tx.forEach(t => {
      if (t.user_id !== id) return;
      if (t.status === 'completed') {
        if (IN.includes(t.type)) bal += Number(t.net_amount);
        else bal -= Number(t.amount);
        if (t.type === 'rental_income') inc += Number(t.net_amount);
      }
      if (t.status === 'pending' && t.type === 'withdrawal') locked += Number(t.amount);
    });
    return { balance: Math.max(0, Math.round(bal * 100) / 100), income: inc, locked };
  }
  function sweepInto(db) {
    const t = now(); let paid = 0, amount = 0, completed = 0, scanned = 0;
    db.leases.forEach(l => {
      if (l.status !== 'active') return;
      const u = db.units.find(x => x.id === l.unit_id); if (!u) return;
      scanned++;
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
    return { scanned, paid, amount, completed };
  }

  /* ---------------- console API ---------------- */
  const Admin = {
    DAY, facade, banner, dayKey, isIn: t => IN.includes(t.type),
    fresh() { DB = read(); return DB; },
    db() { return DB; },

    stats() {
      const d = this.fresh();
      const sum = (type, status, field) => d.tx.filter(t => t.type === type && t.status === status).reduce((a, t) => a + Number(t[field]), 0);
      const cnt = (type, status) => d.tx.filter(t => t.type === type && t.status === status).length;
      return {
        users: d.users.length,
        activeUsers: d.users.filter(u => u.is_active && u.has_funded).length,
        deposits: sum('deposit', 'completed', 'net_amount'),
        withdrawals: sum('withdrawal', 'completed', 'net_amount'),
        pendingDeposits: cnt('deposit', 'pending'),
        pendingDepositValue: sum('deposit', 'pending', 'amount'),
        pendingWithdrawals: cnt('withdrawal', 'pending'),
        pendingWithdrawalValue: sum('withdrawal', 'pending', 'amount'),
        leases: d.leases.length,
        activeLeases: d.leases.filter(l => l.status === 'active').length,
        totalFunded: d.users.reduce((a, u) => a + Number(u.total_funded || 0), 0),
        incomePaid: sum('rental_income', 'completed', 'net_amount')
      };
    },

    series(days) {
      const d = this.fresh(), n = days || 14, out = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = n - 1; i >= 0; i--) {
        const start = today.getTime() - i * DAY, end = start + DAY;
        const inRange = t => t.created_at >= start && t.created_at < end && t.status === 'completed';
        out.push({
          label: new Date(start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          ts: start,
          deposits: d.tx.filter(t => t.type === 'deposit' && inRange(t)).reduce((a, t) => a + Number(t.net_amount), 0),
          withdrawals: d.tx.filter(t => t.type === 'withdrawal' && inRange(t)).reduce((a, t) => a + Number(t.net_amount), 0),
          income: d.tx.filter(t => t.type === 'rental_income' && inRange(t)).reduce((a, t) => a + Number(t.net_amount), 0)
        });
      }
      return out;
    },

    distribution() {
      const d = this.fresh();
      return d.units.filter(u => u.status !== 'deleted').map(u => {
        const ls = d.leases.filter(l => l.unit_id === u.id);
        return { id: u.id, name: u.name, slug: u.slug, count: ls.length, revenue: ls.length * Number(u.price), status: u.status };
      }).sort((a, b) => b.count - a.count);
    },

    feed(limit) {
      const d = this.fresh();
      return d.tx.slice().sort((a, b) => b.created_at - a.created_at).slice(0, limit || 18)
        .map(t => Object.assign({}, t, { user: (d.users.find(u => u.id === t.user_id) || {}).full_name || 'Member' }));
    },

    users() {
      const d = this.fresh();
      return d.users.map(u => {
        const w = walletOf(d, u.id);
        return Object.assign({}, u, {
          wallet: w,
          leases: d.leases.filter(l => l.user_id === u.id).length,
          activeLeases: d.leases.filter(l => l.user_id === u.id && l.status === 'active').length,
          team: d.users.filter(x => x.referred_by === u.id).length
        });
      });
    },
    user(id) { return this.users().find(u => u.id === id) || null; },

    member(id) {
      const d = this.fresh();
      const p = d.users.find(u => u.id === id);
      if (!p) return null;
      const cols = u => ({ id: u.id, full_name: u.full_name, created_at: u.created_at, has_funded: u.has_funded, total_funded: u.total_funded });
      return {
        profile: Object.assign({}, p, { wallet: walletOf(d, id) }),
        leases: d.leases.filter(l => l.user_id === id).map(l => {
          const source = d.units.find(u => u.id === l.unit_id);
          const unit = source ? Object.assign({}, source, {
            price: l.unit_price ?? source.price,
            daily_yield: l.daily_yield ?? source.daily_yield,
            duration_days: l.duration_days ?? source.duration_days,
            income_drop_days: l.income_drop_days || source.income_drop_days || d.settings.income_drop_days
          }) : null;
          return Object.assign({}, l, { unit });
        }).sort((a, b) => b.started_at - a.started_at),
        transactions: d.tx.filter(t => t.user_id === id).sort((a, b) => b.created_at - a.created_at),
        cards: d.cards.filter(c => c.user_id === id),
        checkins: d.checkins.filter(c => c.user_id === id).sort((a, b) => b.created_at - a.created_at),
        commissions: d.commissions.filter(c => c.beneficiary_id === id).sort((a, b) => b.created_at - a.created_at),
        team: {
          l1: d.users.filter(u => u.referred_by === id).map(cols),
          l2: d.users.filter(u => u.upline_2 === id).map(cols),
          l3: d.users.filter(u => u.upline_3 === id).map(cols)
        },
        upline: [p.referred_by, p.upline_2, p.upline_3].map(x => x ? (d.users.find(u => u.id === x) || {}).full_name : null)
      };
    },

    queue(type, status) {
      const d = this.fresh();
      return d.tx.filter(t => t.type === type && (status === 'all' || t.status === status))
        .sort((a, b) => b.created_at - a.created_at)
        .map(t => {
          const u = d.users.find(x => x.id === t.user_id) || {};
          const today = dayKey(now());
          return Object.assign({}, t, {
            user_name: u.full_name || 'Member', user_email: u.email || '',
            wallet: walletOf(d, t.user_id),
            usedToday: d.tx.filter(x => x.user_id === t.user_id && x.type === 'withdrawal' && x.status !== 'rejected' && dayKey(x.created_at) === today).length,
            activeLeases: d.leases.filter(l => l.user_id === t.user_id && l.status === 'active').length
          });
        });
    },
    tx(id) { const d = this.fresh(); return d.tx.find(t => t.id === id) || null; },

    units() { const d = this.fresh(); return d.units.filter(u => u.status !== 'deleted').slice().sort((a, b) => a.sort_order - b.sort_order); },
    unit(id) { const d = this.fresh(); return d.units.find(u => u.id === id) || null; },
    settings() { return clone(this.fresh().settings); },
    cron() { return this.fresh().cron.slice(0, 12); },
    audit() { return (this.fresh().audit || []).slice(0, 25); },

    /* ---- mutations ---- */
    approveDeposit(id, note) {
      return commit('Approve deposit', d => {
        const t = d.tx.find(x => x.id === id && x.type === 'deposit');
        if (!t) throw new Error('Deposit not found.');
        if (t.status !== 'pending') throw new Error('This deposit has already been processed.');
        t.status = 'completed'; t.admin_note = note || ''; t.processed_at = now();
        const u = d.users.find(x => x.id === t.user_id);
        if (u) { u.has_funded = true; u.total_funded = Number(u.total_funded || 0) + Number(t.net_amount); }
        let commissions = 0;
        [[u?.referred_by, 1, d.settings.referral_l1], [u?.upline_2, 2, d.settings.referral_l2], [u?.upline_3, 3, d.settings.referral_l3]]
          .forEach(([bene, lvl, rate]) => {
            if (!bene || !rate) return;
            if (d.commissions.some(c => c.source_tx_id === id && c.beneficiary_id === bene && c.level === lvl)) return;
            const amt = Math.round(Number(t.net_amount) * Number(rate)) / 100;
            d.commissions.push({ id: uid(), beneficiary_id: bene, source_user_id: t.user_id, source_tx_id: id, level: lvl, rate, amount: amt, created_at: now() });
            d.tx.push({ id: uid(), user_id: bene, type: 'referral_commission', amount: amt, fee: 0, net_amount: amt, description: 'Level ' + lvl + ' commission · ' + (u?.full_name || 'Member'), reference: ref('REF'), status: 'completed', created_at: now() });
            commissions += amt;
          });
        d.audit.unshift({ at: now(), action: 'approve_deposit', target: t.user_id, meta: { amount: t.amount, commissions } });
        return { amount: Number(t.net_amount), commissions };
      });
    },
    rejectDeposit(id, note) {
      if (!note) throw new Error('A reason is required to reject a deposit.');
      return commit('Reject deposit', d => {
        const t = d.tx.find(x => x.id === id && x.type === 'deposit');
        if (!t || t.status !== 'pending') throw new Error('Deposit is not pending.');
        t.status = 'rejected'; t.admin_note = note; t.processed_at = now();
        d.audit.unshift({ at: now(), action: 'reject_deposit', target: t.user_id, meta: { note } });
      });
    },
    approveWithdrawal(id, note) {
      return commit('Approve withdrawal', d => {
        const t = d.tx.find(x => x.id === id && x.type === 'withdrawal');
        if (!t || t.status !== 'pending') throw new Error('Withdrawal is not pending.');
        t.status = 'completed'; t.admin_note = note || ''; t.processed_at = now();
        const u = d.users.find(x => x.id === t.user_id);
        if (u) u.total_withdrawn = Number(u.total_withdrawn || 0) + Number(t.net_amount);
        d.audit.unshift({ at: now(), action: 'approve_withdrawal', target: t.user_id, meta: { net: t.net_amount } });
        return { net: Number(t.net_amount) };
      });
    },
    rejectWithdrawal(id, note) {
      if (!note) throw new Error('A reason is required to reject a withdrawal.');
      return commit('Reject withdrawal', d => {
        const t = d.tx.find(x => x.id === id && x.type === 'withdrawal');
        if (!t || t.status !== 'pending') throw new Error('Withdrawal is not pending.');
        t.status = 'rejected'; t.admin_note = note; t.processed_at = now();
        d.audit.unshift({ at: now(), action: 'reject_withdrawal', target: t.user_id, meta: { note, released: t.amount } });
      });
    },

    adjust(userId, amount, direction, note) {
      amount = Number(amount);
      if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
      if (!note || note.trim().length < 3) throw new Error('A note is required for wallet adjustments.');
      return commit(direction === 'credit' ? 'Top up wallet' : 'Deduct wallet', d => {
        const u = d.users.find(x => x.id === userId);
        if (!u) throw new Error('Member not found.');
        if (direction === 'debit') {
          const w = walletOf(d, userId);
          if (w.balance - w.locked < amount) throw new Error('Amount exceeds the available balance.');
        }
        d.tx.push({
          id: uid(), user_id: userId, type: direction === 'credit' ? 'admin_credit' : 'admin_debit',
          amount, fee: 0, net_amount: amount,
          description: direction === 'credit' ? 'Wallet top-up by admin' : 'Wallet deduction by admin',
          reference: ref('ADM'), status: 'completed', created_at: now(), admin_note: note.trim()
        });
        d.audit.unshift({ at: now(), action: direction, target: userId, meta: { amount, note } });
        return { amount, direction };
      });
    },

    setBan(userId, active) {
      return commit(active ? 'Reinstate member' : 'Suspend member', d => {
        const u = d.users.find(x => x.id === userId);
        if (!u) throw new Error('Member not found.');
        if (u.is_admin && !active) throw new Error('Administrator accounts cannot be suspended.');
        u.is_active = active;
        d.audit.unshift({ at: now(), action: active ? 'unban' : 'ban', target: userId, meta: {} });
      });
    },

    grantLease(userId, unitId) {
      return commit('Grant residence', d => {
        const u = d.users.find(x => x.id === userId), unit = d.units.find(x => x.id === unitId);
        if (!u || !unit) throw new Error('Member or residence not found.');
        d.leases.push({
          id: uid(), user_id: userId, unit_id: unitId, unit_price: unit.price,
          daily_yield: unit.daily_yield, duration_days: unit.duration_days,
          income_drop_days: unit.income_drop_days || d.settings.income_drop_days,
          status: 'active', days_paid: 0, total_collected: 0, granted_by_admin: true, started_at: now()
        });
        unit.sold++;
        d.tx.push({ id: uid(), user_id: userId, type: 'admin_credit', amount: 0, fee: 0, net_amount: 0, description: 'Residence granted: ' + unit.name, reference: ref('GRT'), status: 'completed', created_at: now() });
        d.audit.unshift({ at: now(), action: 'grant_lease', target: userId, meta: { unit: unit.name } });
        return { unit };
      });
    },

    saveUnit(row) {
      if (!row.name || !(Number(row.price) > 0) || !(Number(row.daily_yield) > 0)) throw new Error('Name, price and daily yield are required.');
      if (!(Number(row.duration_days) > 0)) throw new Error('Income days must be greater than zero.');
      return commit(row.id ? 'Update residence' : 'Publish residence', d => {
        if (row.id) {
          const u = d.units.find(x => x.id === row.id);
          if (!u) throw new Error('Residence not found.');
          Object.assign(u, {
            name: row.name, tier: row.tier || row.name, price: Number(row.price),
            daily_yield: Number(row.daily_yield), duration_days: Number(row.duration_days),
            purchase_limit: Number(row.purchase_limit) || 1, bedrooms: Number(row.bedrooms) || 1,
            bathrooms: Number(row.bathrooms) || 1, sqm: Number(row.sqm) || 0,
            image_url: row.image_url || '', description: row.description || '',
            amenities: row.amenities || [], status: row.status || u.status
          });
          d.audit.unshift({ at: now(), action: 'update_unit', target: u.id, meta: { name: u.name } });
          return u;
        }
        const u = {
          id: uid(), slug: String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) + '-' + Date.now().toString(36),
          name: row.name, tier: row.tier || row.name, price: Number(row.price), daily_yield: Number(row.daily_yield),
          duration_days: Number(row.duration_days), purchase_limit: Number(row.purchase_limit) || 1,
          bedrooms: Number(row.bedrooms) || 1, bathrooms: Number(row.bathrooms) || 1, sqm: Number(row.sqm) || 0,
          image_url: row.image_url || '', description: row.description || '', amenities: row.amenities || [],
          status: row.status || 'live', sort_order: d.units.length, sold: 0
        };
        d.units.push(u);
        d.audit.unshift({ at: now(), action: 'create_unit', target: u.id, meta: { name: u.name } });
        return u;
      });
    },
    setUnitStatus(id, status) {
      return commit('Set status', d => {
        const u = d.units.find(x => x.id === id);
        if (!u) throw new Error('Residence not found.');
        u.status = status;
        d.audit.unshift({ at: now(), action: 'unit_status', target: id, meta: { status } });
      });
    },
    deleteUnit(id) {
      return commit('Remove residence', d => {
        const u = d.units.find(x => x.id === id);
        if (!u) throw new Error('Residence not found.');
        u.status = 'deleted';
        d.audit.unshift({ at: now(), action: 'delete_unit', target: id, meta: { name: u.name } });
      });
    },
    reorder(order) {
      return commit('Reorder catalogue', d => {
        order.forEach((id, i) => { const u = d.units.find(x => x.id === id); if (u) u.sort_order = i; });
      });
    },

    saveSettings(patch) {
      const s = Object.assign({}, this.settings(), patch);
      if (Number(s.min_deposit) > Number(s.max_deposit)) throw new Error('Minimum deposit cannot exceed the maximum.');
      if (Number(s.min_withdrawal) > Number(s.max_withdrawal)) throw new Error('Minimum withdrawal cannot exceed the maximum.');
      ['withdrawal_fee', 'referral_l1', 'referral_l2', 'referral_l3', 'streak_7', 'streak_14', 'streak_30'].forEach(k => {
        const v = Number(s[k]);
        if (!(v >= 0 && v <= 100)) throw new Error(k.replace(/_/g, ' ') + ' must be between 0 and 100.');
      });
      if (!Array.isArray(s.withdrawal_days) || !s.withdrawal_days.length) throw new Error('Select at least one withdrawal day.');
      const tm = t => /^\d{2}:\d{2}$/.test(t);
      if (!tm(s.withdrawal_start) || !tm(s.withdrawal_end)) throw new Error('Enter valid start and end times.');
      if (s.withdrawal_start >= s.withdrawal_end) throw new Error('The window must end after it starts.');
      if (!(Number(s.withdrawals_per_day) >= 1)) throw new Error('Allow at least one withdrawal per day.');
      return commit('Save settings', d => {
        d.settings = s;
        d.audit.unshift({ at: now(), action: 'save_settings', target: null, meta: patch });
      });
    },

    runSweep() {
      return commit('Income sweep', d => {
        const r = sweepInto(d);
        if (r.paid || r.completed) {
          d.cron.unshift({ at: now(), paid: r.paid, amount: r.amount, completed: r.completed, ok: true, manual: true });
          if (d.cron.length > 40) d.cron.length = 40;
        }
        return r;
      });
    },

    impersonate(id) {
      const u = this.user(id);
      if (!u) throw new Error('Member not found.');
      commit('Impersonate', d => { d.audit.unshift({ at: now(), action: 'impersonate', target: id, meta: { name: u.full_name } }); });
      try { sessionStorage.setItem('pinnacle.imp', id); } catch (e) {}
      return u;
    },
    impersonating() { try { return sessionStorage.getItem('pinnacle.imp'); } catch (e) { return null; } },
    exitImpersonation() { try { sessionStorage.removeItem('pinnacle.imp'); } catch (e) {} },

    undo() {
      const s = undoStack.pop();
      if (!s) return false;
      DB = s.data; write(DB);
      return s.label;
    },
    canUndo() { return undoStack.length > 0; }
  };

  /* ---------- Store shim so app.js works unchanged on console pages ---------- */
  window.Store = {
    live: false, DAY, facade, banner, dayKey,
    async session() { const d = Admin.fresh(); return d.session ? { user: d.users.find(u => u.id === d.session) } : null; },
    me() { const d = Admin.fresh(); return d.session ? d.users.find(u => u.id === d.session) : null; },
    settings() { return Admin.settings(); },
    setting(k) { return Admin.settings()[k]; },
    wallet() { const m = this.me(); return m ? walletOf(Admin.fresh(), m.id) : { balance: 0, income: 0, locked: 0 }; },
    transactions(type) {
      const m = this.me(); if (!m) return [];
      const d = Admin.fresh();
      return d.tx.filter(t => t.user_id === m.id && (!type || type === 'all' || t.type === type)).sort((a, b) => b.created_at - a.created_at);
    },
    leases() {
      const m = this.me(); if (!m) return [];
      const d = Admin.fresh();
      return d.leases.filter(l => l.user_id === m.id).map(l => Object.assign({}, l, { unit: d.units.find(u => u.id === l.unit_id) }));
    },
    sweep() { return Admin.runSweep(); },
    async logout() { commit('Sign out', d => { d.session = null; }); }
  };

  window.Admin = Admin;
})();
