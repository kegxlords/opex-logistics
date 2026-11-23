/* ============================================================
   CSC APARTMENTS — Member dossier controller
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, dOnly, ago, hms, toast, layer, closeLayer, confirmSheet, debounce } = UI;
  const CFG = window.PINNACLE;

  const id = new URLSearchParams(location.search).get('id');
  const TABS = [
    ['overview', 'hist', 'Overview'],
    ['leases', 'rents', 'Leases'],
    ['transactions', 'wallet', 'Transactions'],
    ['cards', 'bank', 'Payout cards'],
    ['team', 'team', 'Team'],
    ['commissions', 'refer', 'Commissions'],
    ['attendance', 'flame', 'Attendance']
  ];
  const AV = ['var(--g-blue)', 'var(--g-pink)', 'var(--g-green)', 'var(--g-red)', 'var(--g-money)'];
  let tab = 'overview', txQuery = '', ticker = null;

  const initial = n => (n || 'M').trim().charAt(0).toUpperCase();
  const unitImg = u => u ? `<img src="${esc(u.image_url || CFG.IMAGES.units[u.slug] || '')}" alt="${esc(u.name)}" onerror="this.onerror=null;this.src='${Admin.facade(u.slug, u.name.length * 7)}'">` : '';
  const statusTag = s => `<span class="tag tag--${s === 'completed' ? 'live' : s === 'pending' ? 'pending' : 'out'}">${s}</span>`;

  function undoToast(msg, sub) {
    toast(msg, 'ok', { sub, undo: () => { const l = Admin.undo(); render(); toast(l ? l + ' reversed' : 'Nothing to undo', 'info'); } });
  }

  /* ================= sheets ================= */
  function adjustSheet(direction) {
    const m = Admin.member(id); if (!m) return;
    const p = m.profile, credit = direction === 'credit';
    const l = layer(`
      <div class="sheet-head"><h3>${icon(credit ? 'plus' : 'out')} ${credit ? 'Top up wallet' : 'Deduct from wallet'}</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="total-box">
        <div class="kv"><span class="k">Member</span><span class="v" style="font-size:13px">${esc(p.full_name)}</span></div>
        <div class="kv"><span class="k">Available</span><span class="v c-blue">${naira(p.wallet.balance - p.wallet.locked)}</span></div>
        <div class="kv"><span class="k">Locked</span><span class="v c-pink">${naira(p.wallet.locked)}</span></div>
      </div>
      <form id="adjForm">
        <div class="field-row"><label class="label">Amount (₦)</label>
          <div class="input-wrap">${icon('wallet')}<input class="input" name="amount" type="number" step="any" min="1" placeholder="0" required></div></div>
        <div class="field-row"><label class="label">Reason <span class="opt">(recorded in the ledger)</span></label>
          <div class="input-wrap">${icon('ticket')}<input class="input" name="note" placeholder="${credit ? 'Manual deposit confirmation' : 'Correction of duplicate credit'}" required></div></div>
        <button class="btn btn--${credit ? 'green' : 'red'} btn--block" type="submit">${credit ? 'Credit wallet' : 'Deduct wallet'}</button>
      </form>`, 'sheet');
    l.querySelector('#adjForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        Admin.adjust(id, f.get('amount'), direction, f.get('note'));
        closeLayer();
        undoToast(credit ? 'Wallet topped up' : 'Wallet deducted', naira(f.get('amount')) + ' · ' + p.full_name);
        render();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function grantSheet() {
    const m = Admin.member(id); if (!m) return;
    const units = Admin.units();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('building')} Grant a residence</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <p class="c-muted" style="font-size:13px;font-weight:600;margin-bottom:14px">Assigned free of charge to <b>${esc(m.profile.full_name)}</b>. Income begins dropping 24 hours from now and the grant is logged.</p>
      <form id="grantForm">
        <div class="field-row"><label class="label">Residence</label>
          <div class="input-wrap">${icon('building')}<select class="input" name="unit" required>
            <option value="">Select a residence</option>
            ${units.map(u => `<option value="${u.id}">${esc(u.name)} — ${naira(u.price)} · ${naira(u.daily_yield)}/24h · ${u.duration_days} days</option>`).join('')}
          </select></div></div>
        <button class="btn btn--blue btn--block" type="submit">Grant residence</button>
      </form>`, 'sheet');
    l.querySelector('#grantForm').addEventListener('submit', e => {
      e.preventDefault();
      const uid = new FormData(e.target).get('unit');
      if (!uid) return toast('Select a residence', 'warn');
      try {
        const r = Admin.grantLease(id, uid);
        closeLayer(); undoToast('Residence granted', r.unit.name); render();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function txSheet(txId) {
    const m = Admin.member(id); if (!m) return;
    const t = m.transactions.find(x => x.id === txId); if (!t) return;
    layer(`
      <div class="sheet-head"><h3>${icon('hist')} Transaction detail</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div style="text-align:center;padding:8px 0 16px">
        <div class="dsp ${Admin.isIn(t.type) ? 'c-green' : 'c-red'}" style="font-size:32px;font-weight:800;letter-spacing:-.03em">${Admin.isIn(t.type) ? '+' : '−'}${naira(t.amount)}</div>
        ${statusTag(t.status)}
      </div>
      <div class="total-box">
        <div class="kv"><span class="k">Description</span><span class="v" style="font-size:12.5px;text-align:right">${esc(t.description)}</span></div>
        <div class="kv"><span class="k">Type</span><span class="v" style="font-size:12.5px">${esc(t.type.replace(/_/g, ' '))}</span></div>
        <div class="kv"><span class="k">Reference</span><span class="v" style="font-size:12.5px">${esc(t.reference)}</span></div>
        <div class="kv"><span class="k">Date &amp; time</span><span class="v" style="font-size:12.5px">${dt(t.created_at)}</span></div>
        ${t.fee ? `<div class="kv"><span class="k">Fee</span><span class="v c-red">${naira(t.fee)}</span></div>` : ''}
        ${t.fee ? `<div class="kv grand"><span class="k">Net</span><span class="v">${naira(t.net_amount)}</span></div>` : ''}
        ${t.bank_name ? `<div class="kv"><span class="k">Bank</span><span class="v" style="font-size:12.5px">${esc(t.bank_name)}</span></div>` : ''}
        ${t.account_number ? `<div class="kv"><span class="k">Account</span><span class="v" style="font-size:12.5px">${esc(t.account_number)}</span></div>` : ''}
        ${t.admin_note ? `<div class="kv"><span class="k">Admin note</span><span class="v" style="font-size:12.5px;text-align:right">${esc(t.admin_note)}</span></div>` : ''}
      </div>`, 'sheet');
  }

  function exportMember() {
    const m = Admin.member(id); if (!m) return;
    const rows = [['Date', 'Type', 'Description', 'Reference', 'Amount', 'Fee', 'Net', 'Status']];
    m.transactions.forEach(t => rows.push([dt(t.created_at), t.type, t.description, t.reference, t.amount, t.fee || 0, t.net_amount, t.status]));
    const csv = rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'tranex-member-' + m.profile.referral_code + '.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('Member ledger exported', 'ok');
  }

  /* ================= sections ================= */
  function hero(m) {
    const p = m.profile, w = p.wallet;
    const active = m.leases.filter(l => l.status === 'active');
    const daily = active.reduce((a, l) => a + Number(l.unit.daily_yield), 0);
    const next = active.length ? Math.min(...active.map(l => l.started_at + (l.days_paid + 1) * Admin.DAY)) : null;
    const up = m.upline;
    return `
      <div class="dossier-hero">
        <div class="row">
          <span class="av">${initial(p.full_name)}</span>
          <div style="flex:1;min-width:0">
            <h1>${esc(p.full_name || 'Member')} ${p.is_admin ? '<span class="tag tag--soon" style="vertical-align:middle">Admin</span>' : ''}
              ${p.is_active ? '' : '<span class="tag tag--out" style="vertical-align:middle">Suspended</span>'}</h1>
            <p>${esc(p.email || '')} · ${esc(p.phone || 'no phone on file')}</p>
            <p style="margin-top:5px;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Resident since ${dOnly(p.created_at)} · code ${esc(p.referral_code)}</p>
          </div>
        </div>
        <div class="dossier-stats">
          <div><b>${naira(w.balance)}</b><span>Available</span></div>
          <div><b>${naira(w.locked)}</b><span>Locked</span></div>
          <div><b>${naira(w.income)}</b><span>Income earned</span></div>
          <div><b>${naira(daily)}</b><span>Per 24 hours</span></div>
          <div><b id="heroClock">${next ? hms(next - Date.now()) : '—'}</b><span>Next drop</span></div>
          <div><b>${p.streak_days || 0}</b><span>Streak</span></div>
        </div>
        ${up.some(Boolean) ? `<div class="chain">
          <span class="node">Upline</span>
          ${up.map((u, i) => u ? `<span class="arrow">›</span><span class="node">L${i + 1} <b>${esc(u)}</b></span>` : '').join('')}
        </div>` : '<div class="chain"><span class="node">No upline — joined organically</span></div>'}
      </div>

      <div class="m-actions">
        <button class="btn btn--green btn--sm" type="button" data-act="credit">${icon('plus')} Top up</button>
        <button class="btn btn--red btn--sm" type="button" data-act="debit">${icon('out')} Deduct</button>
        <button class="btn btn--blue btn--sm" type="button" data-act="grant">${icon('building')} Grant residence</button>
        <button class="btn btn--${p.is_active ? 'ghost' : 'green'} btn--sm" type="button" data-act="ban" data-active="${p.is_active}">
          ${icon('shield')} ${p.is_active ? 'Suspend' : 'Reinstate'}</button>
        <button class="btn btn--primary btn--sm" type="button" data-act="imp">${icon('user')} View as member</button>
        <button class="btn btn--ghost btn--sm" type="button" data-act="export">${icon('hist')} Export ledger</button>
      </div>

      <div class="mini-metrics">
        <div class="mini"><div class="v c-green">${naira(p.total_funded || 0)}</div><div class="k">Total funded</div></div>
        <div class="mini"><div class="v c-pink">${naira(p.total_withdrawn || 0)}</div><div class="k">Total withdrawn</div></div>
        <div class="mini"><div class="v c-blue">${m.leases.length}</div><div class="k">Leases</div></div>
        <div class="mini"><div class="v">${m.team.l1.length + m.team.l2.length + m.team.l3.length}</div><div class="k">Team size</div></div>
        <div class="mini"><div class="v c-green">${m.commissions.length}</div><div class="k">Commission payouts</div></div>
        <div class="mini"><div class="v c-pink">${m.checkins.length}</div><div class="k">Check-ins</div></div>
      </div>`;
  }

  function tabsBar() {
    return `<div class="d-tabs" id="dtabs">
      ${TABS.map(([k, ic, l]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-act="dtab" data-tab="${k}">${icon(ic)} ${l}</button>`).join('')}
    </div>`;
  }

  function secOverview(m) {
    const p = m.profile;
    const pend = m.transactions.filter(t => t.status === 'pending');
    const lastTx = m.transactions[0];
    const lastCi = m.checkins[0];
    return `
      <div class="two-col">
        <div class="panel">
          <div class="panel-head"><h3>${icon('user')} Account record</h3></div>
          <div class="kv-grid">
            <div class="kv"><span class="k">Member id</span><span class="v" style="font-size:11px">${esc(p.id)}</span></div>
            <div class="kv"><span class="k">Referral code</span><span class="v" style="font-size:13px">${esc(p.referral_code)}</span></div>
            <div class="kv"><span class="k">Email verified</span><span class="v">${p.verified ? '<span class="tag tag--live">Yes</span>' : '<span class="tag tag--pending">No</span>'}</span></div>
            <div class="kv"><span class="k">Has funded</span><span class="v">${p.has_funded ? '<span class="tag tag--live">Yes</span>' : '<span class="tag tag--out">No</span>'}</span></div>
            <div class="kv"><span class="k">Welcome bonus</span><span class="v">${p.welcome_claimed ? '<span class="tag tag--live">Claimed</span>' : '<span class="tag tag--pending">Pending</span>'}</span></div>
            <div class="kv"><span class="k">Longest streak</span><span class="v c-pink">${p.longest_streak || 0} days</span></div>
            <div class="kv"><span class="k">Last check-in</span><span class="v" style="font-size:12.5px">${p.last_checkin ? dOnly(new Date(p.last_checkin).getTime()) : 'Never'}</span></div>
            <div class="kv"><span class="k">Joined</span><span class="v" style="font-size:12.5px">${dt(p.created_at)}</span></div>
          </div>
        </div>
        <div>
          <div class="panel">
            <div class="panel-head"><h3>${icon('clock')} Needs attention</h3></div>
            ${pend.length ? pend.map(t => `
              <div class="feed-row"><span class="feed-dot" style="background:var(--pink)"></span>
                <div class="txt"><b>${esc(t.description)}</b><span>${esc(t.reference)} · ${ago(t.created_at)}</span></div>
                <div class="amt c-pink">${naira(t.amount)}</div>
                <button class="btn btn--blue btn--xs" type="button" data-act="tx" data-id="${t.id}">Review</button>
              </div>`).join('')
              : '<p class="c-muted" style="font-size:13px;font-weight:600">Nothing pending for this member.</p>'}
          </div>
          <div class="panel">
            <div class="panel-head"><h3>${icon('hist')} Latest activity</h3></div>
            <div class="feed">
              ${m.transactions.slice(0, 6).map(t => `
                <div class="feed-row"><span class="feed-dot" style="background:${Admin.isIn(t.type) ? 'var(--green)' : 'var(--red)'}"></span>
                  <div class="txt"><b>${esc(t.description)}</b><span>${ago(t.created_at)}</span></div>
                  <div class="amt" style="color:${Admin.isIn(t.type) ? 'var(--green)' : 'var(--red)'}">${Admin.isIn(t.type) ? '+' : '−'}${naira(t.amount)}</div>
                </div>`).join('') || '<p class="c-muted" style="font-size:13px;font-weight:600">No activity recorded.</p>'}
            </div>
            <p class="c-muted" style="font-size:11.5px;font-weight:700;margin-top:10px">Last transaction ${lastTx ? ago(lastTx.created_at) : '—'} · last check-in ${lastCi ? ago(lastCi.created_at) : '—'}</p>
          </div>
        </div>
      </div>`;
  }

  function secLeases(m) {
    if (!m.leases.length) return `<div class="panel"><div class="empty"><div class="empty-art">${icon('rents')}</div><b>No leases</b><p>This member has never leased a residence. Use “Grant residence” to assign one.</p></div></div>`;
    return `<div class="pkg-grid">
      ${m.leases.map(l => {
        const u = l.unit || {}, out = l.days_paid >= (u.duration_days || 0);
        const pct = Math.min(100, Math.round(l.days_paid / (u.duration_days || 1) * 100));
        const next = l.started_at + (l.days_paid + 1) * Admin.DAY;
        return `<article class="pkg">
          <div class="pkg-img">${unitImg(u)}
            <span class="st"><span class="tag tag--${out ? 'out' : 'live'}">${out ? 'Ended' : 'Active'}</span></span>
            ${l.granted_by_admin ? '<span class="grip">Granted</span>' : ''}</div>
          <div class="pkg-body">
            <h4>${esc(u.name || 'Residence')}</h4>
            <div class="timer ${out ? 'out' : ''}" data-drop="${out ? '' : next}" style="margin-bottom:10px">
              <span class="k">${out ? 'Income status' : 'Next drop in'}</span>
              <span class="clock">${out ? 'Out of income days' : hms(next - Date.now())}</span></div>
            <div class="bar" style="margin-bottom:9px"><i style="width:${pct}%"></i></div>
            <div class="pkg-econ">
              <div><span class="k">Leased on</span><span class="v" style="font-size:12px">${dt(l.started_at)}</span></div>
              <div><span class="k">Drop</span><span class="v">${l.days_paid} / ${u.duration_days}</span></div>
              <div><span class="k">Per 24h</span><span class="v c-green">${naira(u.daily_yield)}</span></div>
              <div><span class="k">Collected</span><span class="v c-pink">${naira(l.total_collected)}</span></div>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>`;
  }

  function secTransactions(m) {
    let rows = m.transactions;
    if (txQuery) {
      const q = txQuery.toLowerCase();
      rows = rows.filter(t => (t.description || '').toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q) || t.type.includes(q));
    }
    return `
      <div class="toolbar">
        <div class="input-wrap">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input class="input" id="mtq" placeholder="Search description, reference or type" value="${esc(txQuery)}">
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-act="export">${icon('hist')} Export CSV</button>
      </div>
      <div class="table-scroll">
        <table class="dt">
          <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th><th>Fee</th><th>Net</th><th>Status</th><th style="text-align:right"></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(t => `
              <tr>
                <td class="c-muted" style="font-size:11.5px;white-space:nowrap">${dt(t.created_at)}</td>
                <td><b style="font-size:12.5px">${esc(t.description)}</b><br><span class="c-muted" style="font-size:10.5px">${esc(t.type.replace(/_/g, ' '))}</span></td>
                <td class="c-muted" style="font-size:11.5px">${esc(t.reference)}</td>
                <td class="money ${Admin.isIn(t.type) ? 'c-green' : 'c-red'}">${Admin.isIn(t.type) ? '+' : '−'}${naira(t.amount)}</td>
                <td class="money c-muted">${t.fee ? naira(t.fee) : '—'}</td>
                <td class="money">${naira(t.net_amount)}</td>
                <td>${statusTag(t.status)}</td>
                <td><div class="acts"><button class="icon-act go" type="button" data-act="tx" data-id="${t.id}" title="Detail">${icon('chev')}</button></div></td>
              </tr>`).join('')
              : `<tr><td colspan="8"><div class="empty"><div class="empty-art">${icon('hist')}</div><b>No matching transactions</b><p>Try a different search term.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  function secCards(m) {
    if (!m.cards.length) return `<div class="panel"><div class="empty"><div class="empty-art">${icon('bank')}</div><b>No payout cards</b><p>This member cannot withdraw until a bank account is saved from their own app.</p></div></div>`;
    return `<div class="pkg-grid">
      ${m.cards.map(c => `<article class="pkg"><div class="pkg-body">
        <div class="bankcard" style="margin-bottom:12px">
          ${c.is_default ? '<span class="bankcard-def">Default</span>' : ''}
          <div class="bankcard-top"><span class="bankcard-bank">${esc(c.bank_name)}</span><span class="bankcard-chip"></span></div>
          <div class="bankcard-no">${esc(c.account_number.replace(/(.{4})/g, '$1 ').trim())}</div>
          <div class="bankcard-name">${esc(c.account_name)}</div>
        </div>
        <div class="pkg-econ">
          <div><span class="k">Added</span><span class="v" style="font-size:12px">${dOnly(c.created_at)}</span></div>
          <div><span class="k">Verified</span><span class="v">${c.is_verified ? 'Yes' : 'No'}</span></div>
        </div>
        <button class="btn btn--ghost btn--xs btn--block" type="button" data-act="copy" data-v="${esc(c.account_number)}">Copy account number</button>
      </div></article>`).join('')}
    </div>`;
  }

  function secTeam(m) {
    const all = [...m.team.l1.map(x => [1, x]), ...m.team.l2.map(x => [2, x]), ...m.team.l3.map(x => [3, x])];
    if (!all.length) return `<div class="panel"><div class="empty"><div class="empty-art">${icon('team')}</div><b>No downline yet</b><p>Nobody has registered under this member on any level.</p></div></div>`;
    return `<div class="table-scroll">
      <table class="dt">
        <thead><tr><th>Level</th><th>Member</th><th>Joined</th><th>Funded</th><th>Status</th></tr></thead>
        <tbody>
          ${all.map(([lvl, x], i) => `
            <tr>
              <td><span class="tag tag--soon">L${lvl}</span></td>
              <td><div class="who"><span class="av" style="background:${AV[i % AV.length]}">${initial(x.full_name)}</span>
                <div><b>${esc(x.full_name || 'Member')}</b><span>${lvl === 1 ? 'Direct referral' : lvl === 2 ? 'Second level' : 'Third level'}</span></div></div></td>
              <td class="c-muted" style="font-size:11.5px">${dOnly(x.created_at)}</td>
              <td class="money c-green">${naira(x.total_funded || 0)}</td>
              <td>${x.has_funded ? '<span class="tag tag--live">Active</span>' : '<span class="tag tag--out">Inactive</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function secCommissions(m) {
    if (!m.commissions.length) return `<div class="panel"><div class="empty"><div class="empty-art">${icon('refer')}</div><b>No commissions earned</b><p>This member earns when anyone in their three-level network has a deposit approved.</p></div></div>`;
    const total = m.commissions.reduce((a, c) => a + Number(c.amount), 0);
    return `
      <div class="mini-metrics">
        <div class="mini"><div class="v c-green">${naira(total)}</div><div class="k">Lifetime commissions</div></div>
        <div class="mini"><div class="v c-blue">${m.commissions.filter(c => c.level === 1).length}</div><div class="k">Level 1 payouts</div></div>
        <div class="mini"><div class="v c-pink">${m.commissions.filter(c => c.level === 2).length}</div><div class="k">Level 2 payouts</div></div>
        <div class="mini"><div class="v c-red">${m.commissions.filter(c => c.level === 3).length}</div><div class="k">Level 3 payouts</div></div>
      </div>
      <div class="table-scroll">
        <table class="dt">
          <thead><tr><th>Date</th><th>Level</th><th>Rate</th><th>Source member</th><th>Amount</th></tr></thead>
          <tbody>
            ${m.commissions.map(c => {
              const src = Admin.user(c.source_user_id);
              return `<tr>
                <td class="c-muted" style="font-size:11.5px">${dt(c.created_at)}</td>
                <td><span class="tag tag--soon">L${c.level}</span></td>
                <td class="money">${c.rate}%</td>
                <td><b style="font-size:12.5px">${esc(src ? src.full_name : 'Member')}</b></td>
                <td class="money c-green">+${naira(c.amount)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function secAttendance(m) {
    if (!m.checkins.length) return `<div class="panel"><div class="empty"><div class="empty-art">${icon('flame')}</div><b>No check-ins</b><p>This member has never claimed the daily attendance bonus.</p></div></div>`;
    return `
      <div class="mini-metrics">
        <div class="mini"><div class="v c-pink">${m.profile.streak_days || 0}</div><div class="k">Current streak</div></div>
        <div class="mini"><div class="v c-blue">${m.profile.longest_streak || 0}</div><div class="k">Best streak</div></div>
        <div class="mini"><div class="v c-green">${naira(m.checkins.reduce((a, c) => a + Number(c.total_amount), 0))}</div><div class="k">Bonuses paid</div></div>
        <div class="mini"><div class="v">${m.checkins.length}</div><div class="k">Days attended</div></div>
      </div>
      <div class="table-scroll">
        <table class="dt">
          <thead><tr><th>Date</th><th>Base</th><th>Streak bonus</th><th>Total</th><th>Streak at time</th></tr></thead>
          <tbody>
            ${m.checkins.map(c => `
              <tr>
                <td class="c-muted" style="font-size:11.5px">${dOnly(new Date(c.checkin_date + 'T00:00:00').getTime())}</td>
                <td class="money">${naira(c.base_amount)}</td>
                <td class="money c-pink">${c.streak_bonus ? '+' + naira(c.streak_bonus) : '—'}</td>
                <td class="money c-green">+${naira(c.total_amount)}</td>
                <td><span class="tag tag--pending">Day ${c.streak_at_time}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ================= render ================= */
  function render() {
    const v = document.getElementById('view');
    const m = Admin.member(id);
    if (!m) {
      v.innerHTML = `<div class="panel"><div class="empty">
        <div class="empty-art">${icon('team')}</div><b>Member not found</b>
        <p>This dossier link points to a member that no longer exists in the store.</p>
        <a class="btn btn--primary btn--sm" href="index.html#users" style="margin-top:14px">Back to users</a></div></div>`;
      return;
    }
    let body = '';
    if (tab === 'overview') body = secOverview(m);
    else if (tab === 'leases') body = secLeases(m);
    else if (tab === 'transactions') body = secTransactions(m);
    else if (tab === 'cards') body = secCards(m);
    else if (tab === 'team') body = secTeam(m);
    else if (tab === 'commissions') body = secCommissions(m);
    else body = secAttendance(m);

    v.innerHTML = hero(m) + tabsBar() + body;

    const q = document.getElementById('mtq');
    if (q) q.addEventListener('input', debounce(e => { txQuery = e.target.value.trim(); render(); document.getElementById('mtq')?.focus(); }, 200));
  }

  function tick() {
    let due = false;
    document.querySelectorAll('[data-drop]').forEach(el => {
      const t = +el.dataset.drop; if (!t) return;
      const left = t - Date.now();
      const c = el.querySelector('.clock'); if (c) c.textContent = hms(left);
      if (left <= 0) due = true;
    });
    const m = Admin.member(id);
    if (m) {
      const active = m.leases.filter(l => l.status === 'active');
      const next = active.length ? Math.min(...active.map(l => l.started_at + (l.days_paid + 1) * Admin.DAY)) : null;
      const hc = document.getElementById('heroClock');
      if (hc) hc.textContent = next ? hms(next - Date.now()) : '—';
    }
    if (due) { Admin.runSweep(); render(); }
  }

  /* ================= delegation ================= */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'dtab') { tab = el.dataset.tab; render(); return; }
    if (act === 'back') { location.href = 'index.html#users'; return; }
    if (act === 'credit') { adjustSheet('credit'); return; }
    if (act === 'debit') { adjustSheet('debit'); return; }
    if (act === 'grant') { grantSheet(); return; }
    if (act === 'export') { exportMember(); return; }
    if (act === 'tx') { txSheet(el.dataset.id); return; }
    if (act === 'copy') {
      navigator.clipboard.writeText(el.dataset.v).then(() => {
        el.classList.add('done'); el.textContent = 'Copied';
        setTimeout(() => { el.classList.remove('done'); el.textContent = 'Copy account number'; }, 1500);
      }).catch(() => toast('Copy unavailable', 'warn'));
      return;
    }
    if (act === 'sweep') {
      const r = Admin.runSweep();
      toast('Income sweep complete', 'ok', { sub: r.paid + ' drops · ' + naira(r.amount) });
      render(); return;
    }
    if (act === 'ban') {
      const active = el.dataset.active === 'true';
      const m = Admin.member(id);
      confirmSheet({
        title: active ? 'Suspend this member?' : 'Reinstate this member?',
        confirmText: active ? 'Suspend' : 'Reinstate', kind: active ? 'red' : 'green',
        body: `<p class="c-muted" style="font-size:13px;font-weight:600"><b>${esc(m.profile.full_name)}</b> — ${active ? 'they will be blocked at sign-in. Leases keep earning and the balance is preserved.' : 'they will be able to sign in again immediately.'}</p>`,
        onConfirm: async () => {
          Admin.setBan(id, !active);
          undoToast(active ? 'Member suspended' : 'Member reinstated', m.profile.full_name);
          render();
        }
      });
      return;
    }
    if (act === 'imp') {
      try {
        const u = Admin.impersonate(id);
        sessionStorage.setItem('pinnacle.imp', id);
        location.href = 'index.html';
        toast('Viewing as ' + u.full_name, 'info');
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
  });

  /* ================= boot ================= */
  document.addEventListener('DOMContentLoaded', async () => {
    UI.field();
    const sess = await Store.session();
    if (!sess) { location.replace('../index.html'); return; }
    const me = Store.me();
    if (!me || !me.is_admin) { location.replace('../index.html'); return; }

    Admin.runSweep();
    render();
    ticker = setInterval(tick, 1000);
    window.addEventListener('beforeunload', () => clearInterval(ticker));

    const clock = document.getElementById('clock');
    const tc = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour12: false }) + ' WAT'; };
    tc(); setInterval(tc, 1000);
    UI.bootOff();
  });
})();
