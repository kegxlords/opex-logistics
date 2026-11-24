/* ============================================================
   CSC APARTMENTS — Operations console controller
   Reads and writes through the authenticated /api/admin endpoint.
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => UI.esc(s == null ? '' : s);
  const naira = n => UI.naira(Number(n) || 0);
  const date = s => s ? UI.dt(s) : '—';
  const VIEW = $('#view');
  const TABS = [
    ['overview', 'Overview'], ['users', 'Members'], ['deposits', 'Deposits'],
    ['withdrawals', 'Withdrawals'], ['units', 'Residences'], ['settings', 'Settings']
  ];
  let tab = 'overview';
  let settingsData = {};
  let currentMemberId = null;
  let currentMemberData = null;
  let currentPreviewId = null;
  let currentPreviewToken = null;
  let queueStatus = 'pending';
  let queueSearch = '';
  let unitsCache = [];

  function message(title, detail, retry) {
    VIEW.innerHTML = `<section class="panel" role="alert">
      <div class="panel-head"><h3>${esc(title)}</h3></div>
      <p class="c-muted" style="font-size:13px;font-weight:600">${esc(detail)}</p>
      ${retry ? '<button class="btn btn--blue btn--sm" type="button" data-act="retry" style="margin-top:14px">Try again</button>' : ''}
    </section>`;
  }

  async function request(view, method = 'GET', payload = null, extra = {}) {
    if (!window.Store || !Store.sb) throw new Error('Secure sign-in is unavailable. Please reload the page.');
    const { data, error } = await Store.sb.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session && data.session.access_token;
    if (!token) throw new Error('Your session has expired. Please sign in again.');

    const url = new URL('/api/admin', location.origin);
    if (method === 'GET') {
      url.searchParams.set('view', view);
      Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url.pathname + url.search, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          ...(payload ? { 'Content-Type': 'application/json' } : {})
        },
        body: payload ? JSON.stringify(payload) : undefined,
        cache: 'no-store',
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        const err = new Error(result.error || `Request failed (${response.status}).`);
        err.status = response.status;
        throw err;
      }
      return result;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('The server did not respond within 20 seconds.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function setTabs() {
    const root = $('#tabs');
    root.innerHTML = TABS.map(([key, label]) =>
      `<button class="tab ${tab === key ? 'on' : ''}" type="button" data-act="tab" data-tab="${key}">${label}</button>`
    ).join('');
  }

  function metric(label, value, color, sub = '') {
    return `<article class="metric ${color}"><div class="k">${esc(label)}</div>
      <div class="v">${value}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</article>`;
  }

  async function loadOverview() {
    const data = await request('overview');
    const s = data.stats || {};
    const tx = data.recent || [];
    const cron = data.cron || [];
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Operations</span><h1>Overview</h1></div>
      <div class="view-actions"><button class="btn btn--ghost btn--sm" data-act="refresh">Refresh</button>
      <button class="btn btn--blue btn--sm" data-act="sweep">Run income sweep</button></div></div>
      <div class="metrics">
        ${metric('Members', Number(s.users || 0).toLocaleString(), 'm-blue', `${Number(s.activeUsers || 0).toLocaleString()} active and funded`)}
        ${metric('Deposits completed', naira(s.deposits), 'm-green')}
        ${metric('Withdrawals completed', naira(s.withdrawals), 'm-red')}
        ${metric('Pending deposits', `${Number(s.pendingDeposits || 0).toLocaleString()}`, 'm-pink', naira(s.pendingDepositValue))}
        ${metric('Pending withdrawals', `${Number(s.pendingWithdrawals || 0).toLocaleString()}`, 'm-red', naira(s.pendingWithdrawalValue))}
        ${metric('Leases', Number(s.leases || 0).toLocaleString(), 'm-blue', `Total funded ${naira(s.totalFunded)}`)}
      </div>
      <div class="two-col"><section class="panel"><div class="panel-head"><h3>Recent transactions</h3></div>
        ${tx.length ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Member</th><th>Type</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>
        ${tx.map(t => `<tr><td>${esc(t.user_name || t.profiles?.full_name || 'Member')}</td><td>${esc(String(t.type || '').replace(/_/g, ' '))}</td><td class="money">${naira(t.amount)}</td><td>${statusTag(t.status)}</td><td>${date(t.created_at)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="c-muted">No transactions yet.</p>'}</section>
        <section class="panel"><div class="panel-head"><h3>Income sweep health</h3></div>
        ${cron.length ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Time</th><th>Scanned</th><th>Drops paid</th><th>Amount</th><th>Result</th></tr></thead><tbody>
        ${cron.map(r => `<tr><td>${date(r.created_at)}</td><td>${Number(r.scanned || 0)}</td><td>${Number(r.drops_paid || 0)}</td><td class="money">${naira(r.amount_paid)}</td><td>${r.ok ? '<span class="tag tag--live">OK</span>' : '<span class="tag tag--out">Failed</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="c-muted">No sweep runs recorded yet.</p>'}</section></div>`;
  }

  function statusTag(status) {
    const cls = status === 'completed' ? 'live' : status === 'pending' ? 'pending' : 'out';
    const label = status === 'completed' ? 'successful' : status;
    return `<span class="tag tag--${cls}">${esc(label || 'unknown')}</span>`;
  }

  async function loadUsers() {
    const data = await request('users');
    const users = data.users || [];
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Directory</span><h1>Members <small class="c-muted">${users.length}</small></h1></div>
      <button class="btn btn--ghost btn--sm" data-act="refresh">Refresh</button></div>
      <div class="toolbar"><div class="input-wrap"><input class="input" id="userSearch" type="search" placeholder="Search name, email or referral code"></div></div>
      <div class="table-scroll"><table class="dt"><thead><tr><th>Member</th><th>Joined</th><th>Funded</th><th>Total funded</th><th>Status</th><th></th></tr></thead><tbody id="userRows">
      ${users.map(userRow).join('') || '<tr><td colspan="6">No members found.</td></tr>'}
      </tbody></table></div>`;
    $('#userSearch')?.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      $$('#userRows tr').forEach(row => { row.hidden = !row.dataset.search.includes(q); });
    });
  }

  function $$(s, root = document) { return Array.from(root.querySelectorAll(s)); }
  function userRow(u) {
    const search = `${u.full_name || ''} ${u.email || ''} ${u.referral_code || ''}`.toLowerCase();
    return `<tr data-search="${esc(search)}"><td><div class="who"><span class="av" style="background:var(--g-blue)">${esc((u.full_name || 'M').trim().charAt(0).toUpperCase())}</span><div><b>${esc(u.full_name || 'Member')}</b><span>${esc(u.email || '')}</span></div></div></td>
      <td>${date(u.created_at)}</td><td>${u.has_funded ? '<span class="tag tag--live">Yes</span>' : '<span class="tag tag--pending">No</span>'}</td>
      <td class="money">${naira(u.total_funded)}</td><td>${u.is_active === false ? '<span class="tag tag--out">Suspended</span>' : '<span class="tag tag--live">Active</span>'}</td>
      <td><button class="btn btn--blue btn--xs" data-act="member" data-id="${esc(u.id)}">Details</button></td></tr>`;
  }

  async function loadMember(id) {
    if (currentPreviewId) await endPreview(false);
    const data = await request('member', 'GET', null, { id });
    currentMemberId = id;
    currentMemberData = data;
    $('#impBar')?.classList.add('hide');
    renderMemberRecord(data);
  }

  function renderMemberRecord(data) {
    const p = data.profile || {};
    const wallet = data.wallet || {};
    const tx = data.transactions || [];
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Member record</span><h1>${esc(p.full_name || p.email || 'Member')}</h1></div>
      <button class="btn btn--ghost btn--sm" data-act="tab" data-tab="users">Back to members</button></div>
      <div class="metrics">${metric('Available balance', naira(wallet.balance), 'm-blue')}${metric('Income balance', naira(wallet.income_balance), 'm-green')}${metric('Locked', naira(wallet.locked), 'm-pink')}${metric('Total funded', naira(p.total_funded), 'm-blue')}</div>
      <section class="panel"><div class="panel-head"><h3>Account</h3><span>${p.is_admin ? '<span class="tag tag--soon">Admin</span>' : ''} ${p.is_active === false ? '<span class="tag tag--out">Suspended</span>' : '<span class="tag tag--live">Active</span>'}</span></div>
        <div class="kv-grid"><div class="kv"><span class="k">Email</span><span class="v">${esc(p.email || '—')}</span></div><div class="kv"><span class="k">Phone</span><span class="v">${esc(p.phone || '—')}</span></div><div class="kv"><span class="k">Referral code</span><span class="v">${esc(p.referral_code || '—')}</span></div><div class="kv"><span class="k">Joined</span><span class="v">${date(p.created_at)}</span></div></div>
        <div class="view-actions" style="margin-top:14px"><button class="btn btn--blue btn--sm" data-act="preview-member" data-id="${esc(p.id)}">View as member</button><button class="btn btn--green btn--sm" data-act="grant-package" data-id="${esc(p.id)}">Grant package</button><button class="btn btn--green btn--sm" data-act="adjust" data-id="${esc(p.id)}" data-direction="credit">Credit wallet</button><button class="btn btn--red btn--sm" data-act="adjust" data-id="${esc(p.id)}" data-direction="debit">Debit wallet</button><button class="btn btn--${p.is_active === false ? 'green' : 'ghost'} btn--sm" data-act="ban" data-id="${esc(p.id)}" data-active="${p.is_active !== false}">${p.is_active === false ? 'Reinstate' : 'Suspend'}</button></div></section>
        <section class="panel"><div class="panel-head"><h3>Recent transactions</h3></div>
        ${tx.length ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>${tx.slice(0, 50).map(t => `<tr><td>${date(t.created_at)}</td><td>${esc(t.description || '')}</td><td>${esc(t.type)}</td><td class="money">${naira(t.amount)}</td><td>${statusTag(t.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c-muted">No transactions.</p>'}</section>`;
  }

  function renderMemberPreview(data) {
    const p = data.profile || {};
    const wallet = data.wallet || {};
    const leases = data.leases || [];
    const active = leases.filter(l => l.status === 'active');
    const tx = data.transactions || [];
    const dailyIncome = active.reduce((sum, lease) => {
      const unit = Array.isArray(lease.units) ? lease.units[0] : (lease.units || {});
      return sum + Number(unit.daily_yield || 0);
    }, 0);
    const residenceRows = active.map(lease => {
      const unit = Array.isArray(lease.units) ? lease.units[0] : (lease.units || {});
      return `<tr><td><b>${esc(unit.name || 'Residence')}</b></td><td>${Number(lease.days_paid || 0)} days paid</td><td class="money">${naira(unit.daily_yield)}</td><td>${date(lease.started_at)}</td></tr>`;
    }).join('');
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Read-only member preview</span><h1>Welcome, ${esc(p.full_name || 'Member')}</h1><p class="c-muted">Preview of the member-facing account summary. This does not sign in as the member; member actions are unavailable.</p></div>
      <button class="btn btn--ghost btn--sm" data-act="exit-imp">Exit preview</button></div>
      <div class="metrics">${metric('Available balance', naira(wallet.balance), 'm-blue')}${metric('Income balance', naira(wallet.income_balance), 'm-green')}${metric('Active residences', active.length.toLocaleString(), 'm-pink')}${metric('Estimated daily income', naira(dailyIncome), 'm-blue')}</div>
      <section class="panel"><div class="panel-head"><h3>Account</h3>${p.is_active === false ? '<span class="tag tag--out">Suspended</span>' : '<span class="tag tag--live">Active</span>'}</div>
        <div class="kv-grid"><div class="kv"><span class="k">Name</span><span class="v">${esc(p.full_name || '—')}</span></div><div class="kv"><span class="k">Referral code</span><span class="v">${esc(p.referral_code || '—')}</span></div><div class="kv"><span class="k">Member since</span><span class="v">${date(p.created_at)}</span></div><div class="kv"><span class="k">Check-in streak</span><span class="v">${Number(p.streak_days || 0)} days</span></div></div></section>
      <section class="panel"><div class="panel-head"><h3>Your residences</h3></div>
        ${residenceRows ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Residence</th><th>Term</th><th>Daily income</th><th>Started</th></tr></thead><tbody>${residenceRows}</tbody></table></div>` : '<p class="c-muted">No active residences.</p>'}</section>
      <section class="panel"><div class="panel-head"><h3>Recent activity</h3></div>
        ${tx.length ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>${tx.slice(0, 10).map(t => `<tr><td>${date(t.created_at)}</td><td>${esc(t.description || '')}</td><td>${esc(String(t.type || '').replace(/_/g, ' '))}</td><td class="money">${naira(t.amount)}</td><td>${statusTag(t.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c-muted">No recent activity.</p>'}</section>`;
  }

  async function beginPreview(id) {
    const session = await post('impersonate', { user_id: id });
    const context = session.impersonation;
    if (!context?.token) throw new Error('The server did not return a member session.');
    sessionStorage.setItem('pinnacle.impersonation', JSON.stringify(context));
    location.href = '../dashboard.html?impersonation=1';
  }

  async function endPreview(restore = true) {
    const id = currentPreviewId;
    if (!id) return;
    currentPreviewId = null;
    const token = currentPreviewToken;
    currentPreviewToken = null;
    $('#impBar')?.classList.add('hide');
    try {
      await post('end_impersonation', { user_id: id, token });
    } catch (err) {
      UI.toast('Preview closed, but its exit audit could not be saved: ' + err.message, 'err');
    }
    if (restore && currentMemberData) renderMemberRecord(currentMemberData);
  }

  async function loadQueue(type) {
    const data = await request('queue', 'GET', null, { type, status: queueStatus });
    const rows = data.transactions || [];
    const title = type === 'deposit' ? 'Deposits' : 'Withdrawals';
    const visibleRows = queueSearch ? rows.filter(t => `${t.reference || ''} ${t.description || ''} ${t.profiles?.full_name || ''} ${t.profiles?.email || ''}`.toLowerCase().includes(queueSearch)) : rows;
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Review queue</span><h1>${type === 'deposit' ? 'Deposits' : 'Withdrawals'}</h1></div>
      <button class="btn btn--ghost btn--sm" data-act="refresh">Refresh</button></div>
      <div class="toolbar"><div class="input-wrap"><input class="input" id="queueSearch" type="search" placeholder="Search member, email or reference" value="${esc(queueSearch)}"></div>
        <select class="input" id="queueStatus" aria-label="Transaction status"><option value="pending" ${queueStatus === 'pending' ? 'selected' : ''}>Pending</option><option value="completed" ${queueStatus === 'completed' ? 'selected' : ''}>Successful</option><option value="rejected" ${queueStatus === 'rejected' ? 'selected' : ''}>Rejected</option><option value="all" ${queueStatus === 'all' ? 'selected' : ''}>All statuses</option></select></div>
      <section class="panel"><div class="panel-head"><h3>${title} <span class="tag tag--${queueStatus === 'completed' ? 'live' : queueStatus === 'rejected' ? 'out' : 'pending'}">${visibleRows.length}</span></h3></div>
      ${visibleRows.length ? `<div class="table-scroll"><table class="dt"><thead><tr><th>Member</th><th>Reference</th><th>Amount</th><th>Status</th><th>Created</th><th>Details</th><th></th></tr></thead><tbody>
        ${visibleRows.map(t => { const p = Array.isArray(t.profiles) ? t.profiles[0] : (t.profiles || {}); return `<tr><td><b>${esc(p.full_name || 'Member')}</b><br><span class="c-muted">${esc(p.email || '')}</span></td><td>${esc(t.reference || '')}</td><td class="money">${naira(t.amount)}${type === 'withdrawal' && t.fee ? `<br><small class="c-muted">Net ${naira(t.net_amount)}</small>` : ''}</td><td>${statusTag(t.status)}</td><td>${date(t.created_at)}</td><td>${type === 'withdrawal' ? `${esc(t.bank_name || '')}<br>${esc(t.account_number || '')}` : esc(t.description || '')}</td><td><div class="acts">${t.status === 'pending' ? `<button class="icon-act ok" title="Approve" aria-label="Approve" data-act="approve" data-id="${esc(t.id)}" data-type="${type}">✓</button><button class="icon-act no" title="Reject" aria-label="Reject" data-act="reject" data-id="${esc(t.id)}" data-type="${type}">×</button>` : '—'}</div></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="c-muted">No matching transactions.</p>'}</section>`;
    $('#queueSearch')?.addEventListener('input', e => { queueSearch = e.target.value.trim().toLowerCase(); loadQueue(type); });
    $('#queueStatus')?.addEventListener('change', e => { queueStatus = e.target.value; queueSearch = ''; loadQueue(type); });
  }

  async function grantPackage(id) {
    const data = await request('units');
    const units = data.units || [];
    if (!units.length) throw new Error('No packages are configured.');
    const menu = units.map((u, i) => `${i + 1}. ${u.name} — ${naira(u.daily_yield)}/day · ${u.duration_days} days`).join('\n');
    const choice = window.prompt(`Choose a package to grant:\n\n${menu}\n\nEnter the package number:`);
    if (choice == null) return;
    const unit = units[Number(choice) - 1];
    if (!unit) throw new Error('Choose a valid package number.');
    if (!window.confirm(`Grant ${unit.name} to this member?`)) return;
    await refreshAfter('grant_package', { user_id: id, unit_id: unit.id }, 'Package granted.');
  }

  async function loadUnits() {
    const data = await request('units');
    const units = data.units || [];
    unitsCache = units;
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Catalogue</span><h1>Residences</h1></div><button class="btn btn--blue btn--sm" data-act="create-unit">Add residence</button></div>
      <div class="table-scroll"><table class="dt"><thead><tr><th>Residence</th><th>Price</th><th>Yield / day</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${units.map(u => `<tr><td><b>${esc(u.name)}</b><br><span class="c-muted">${esc(u.tier || u.slug || '')}</span></td><td class="money">${naira(u.price)}</td><td class="money">${naira(u.daily_yield)}</td><td>${Number(u.duration_days || 0)} days</td><td><span class="tag tag--${u.status === 'live' ? 'live' : u.status === 'upcoming' ? 'soon' : 'out'}">${esc(u.status)}</span></td><td><div class="acts"><button class="btn btn--ghost btn--xs" data-act="unit-status" data-id="${esc(u.id)}" data-status="${u.status === 'live' ? 'hidden' : 'live'}">${u.status === 'live' ? 'Hide' : 'Publish'}</button><button class="btn btn--ghost btn--xs" data-act="edit-unit" data-id="${esc(u.id)}">Edit all data</button></div></td></tr>`).join('') || '<tr><td colspan="6">No residences configured.</td></tr>'}
      </tbody></table></div>`;
  }

  async function loadSettings() {
    const data = await request('settings');
    settingsData = data.settings || {};
    const fields = [
      ['min_deposit', 'Minimum deposit'], ['max_deposit', 'Maximum deposit'],
      ['min_withdrawal', 'Minimum withdrawal'], ['max_withdrawal', 'Maximum withdrawal'],
      ['withdrawal_fee', 'Withdrawal fee (%)'], ['withdrawals_per_day', 'Withdrawals per day'],
      ['referral_l1', 'Referral level 1 (%)'], ['referral_l2', 'Referral level 2 (%)'], ['referral_l3', 'Referral level 3 (%)'],
      ['income_days', 'Income duration (days)'], ['welcome_bonus', 'Welcome bonus'], ['checkin_bonus', 'Check-in bonus'],
      ['withdrawal_days', 'Withdrawal days (0=Sun, 1=Mon … 6=Sat)'],
      ['income_drop_days', 'Income drop days (0=Sun, 1=Mon … 6=Sat)'],
      ['withdrawal_start', 'Withdrawal start (WAT)'], ['withdrawal_end', 'Withdrawal end (WAT)'],
      ['deposit_bank_1_name', 'Deposit option 1 bank'], ['deposit_bank_1_account_number', 'Deposit option 1 account number'], ['deposit_bank_1_account_name', 'Deposit option 1 account name'],
      ['deposit_bank_2_name', 'Deposit option 2 bank'], ['deposit_bank_2_account_number', 'Deposit option 2 account number'], ['deposit_bank_2_account_name', 'Deposit option 2 account name'],
      ['support_email', 'Support email'], ['support_link', 'WhatsApp support URL'], ['whatsapp_link', 'WhatsApp group invite URL'], ['telegram_link', 'Telegram URL']
    ];
    VIEW.innerHTML = `<div class="view-head"><div><span class="eyebrow">Configuration</span><h1>Settings</h1></div></div>
      <section class="panel"><form id="settingsForm"><div class="set-grid">
      ${fields.map(([key, label]) => {
        const isDepositField = /^deposit_bank_[12]_(name|account_number|account_name)$/.test(key);
        const isAccountNumber = /^deposit_bank_[12]_account_number$/.test(key);
        const isNumeric = /^(min_|max_|withdrawal_fee$|withdrawals_per_day$|referral_|income_days$|welcome_bonus$|checkin_bonus$)/.test(key);
        return `<label class="field-row"><span class="label">${esc(label)}</span><input class="input" name="${key}" value="${esc(settingsData[key] ?? '')}" placeholder="${key.endsWith('_days') && key !== 'income_days' ? '1,2,3,4,5' : ''}" ${isNumeric ? 'type="number" step="any"' : ''} ${isAccountNumber ? 'inputmode="numeric" pattern="[0-9]{10}" maxlength="10"' : ''} ${isDepositField ? 'required' : ''}></label>`;
      }).join('')}
      </div><button class="btn btn--blue" type="submit" style="margin-top:18px">Save settings</button></form></section>`;
    $('#settingsForm').addEventListener('submit', saveSettings);
  }

  async function render(next = tab) {
    tab = next;
    setTabs();
    VIEW.innerHTML = '<section class="panel"><p class="c-muted">Loading…</p></section>';
    try {
      if (tab === 'overview') await loadOverview();
      else if (tab === 'users') await loadUsers();
      else if (tab === 'deposits') await loadQueue('deposit');
      else if (tab === 'withdrawals') await loadQueue('withdrawal');
      else if (tab === 'units') await loadUnits();
      else if (tab === 'settings') await loadSettings();
    } catch (e) {
      if (e.status === 401) {
        await Store.logout().catch(() => {});
        location.replace('../index.html');
        return;
      }
      if (e.status === 403) message('Administrator access required', 'This account is signed in but is not authorized to use the operations console.');
      else message('Could not load this view', e.message || 'Please try again.', true);
    }
  }

  async function post(action, payload) {
    return request('', 'POST', { action, payload });
  }

  async function refreshAfter(action, payload, successMessage) {
    const result = await post(action, payload);
    UI.toast(result.message || successMessage || 'Saved.', 'ok');
    await render(tab);
  }

  function promptUnit(existing) {
    const u = existing || {};
    const layer = UI.layer(`<div class="sheet-head"><h3>${existing ? 'Edit residence data' : 'Add residence'}</h3><button class="modal-x" data-close style="position:static">×</button></div>
      <form id="unitForm"><div class="set-grid">
        ${[['name','Name','text',u.name || ''],['tier','Tier / category','text',u.tier || ''],['price','Price (NGN)','number',u.price || ''],['daily_yield','Income per drop (NGN)','number',u.daily_yield || ''],['duration_days','Income drops','number',u.duration_days || 30],['purchase_limit','Purchase limit','number',u.purchase_limit || 5],['bedrooms','Bedrooms','number',u.bedrooms || 1],['bathrooms','Bathrooms','number',u.bathrooms || 1],['sqm','Area (sqm)','number',u.sqm || 0],['sort_order','Display order','number',u.sort_order || 0],['image_url','Image URL','text',u.image_url || '']].map(([key,label,type,value]) => `<label class="field-row"><span class="label">${label}</span><input class="input" name="${key}" type="${type}" value="${esc(value)}" ${['price','daily_yield','duration_days','purchase_limit'].includes(key) ? 'min="1" required' : ''}></label>`).join('')}
        <label class="field-row"><span class="label">Status</span><select class="input" name="status"><option value="live" ${u.status === 'live' ? 'selected' : ''}>Live</option><option value="hidden" ${u.status === 'hidden' ? 'selected' : ''}>Hidden</option><option value="upcoming" ${u.status === 'upcoming' ? 'selected' : ''}>Upcoming</option></select></label>
        <label class="field-row"><span class="label">Amenities <small>(comma-separated)</small></span><input class="input" name="amenities" value="${esc(Array.isArray(u.amenities) ? u.amenities.join(', ') : '')}"></label>
        <label class="field-row" style="grid-column:1/-1"><span class="label">Description</span><textarea class="input" name="description" rows="3">${esc(u.description || '')}</textarea></label>
      </div><button class="btn btn--blue btn--block" type="submit">${existing ? 'Save all package data' : 'Create residence'}</button></form>`, 'sheet');
    layer.querySelector('#unitForm').addEventListener('submit', async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const payload = Object.fromEntries(form.entries());
      ['price','daily_yield','duration_days','purchase_limit','bedrooms','bathrooms','sqm','sort_order'].forEach(k => { payload[k] = Number(payload[k] || 0); });
      payload.amenities = String(payload.amenities || '').split(',').map(v => v.trim()).filter(Boolean);
      if (existing) payload.id = existing.id;
      try { UI.closeLayer(); await refreshAfter(existing ? 'update_unit' : 'create_unit', payload, existing ? 'Residence updated.' : 'Residence created.'); }
      catch (err) { UI.toast(err.message, 'err'); }
    });
  }

  async function saveSettings(e) {
    e.preventDefault();
    const patch = Object.assign({}, settingsData);
    new FormData(e.currentTarget).forEach((value, key) => { patch[key] = String(value); });
    try {
      await refreshAfter('save_settings', patch, 'Settings saved.');
    } catch (err) { UI.toast(err.message, 'err'); }
  }

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const action = el.dataset.act;
    try {
      if (action === 'tab') { if (currentPreviewId) await endPreview(false); await render(el.dataset.tab); return; }
      if (action === 'refresh' || action === 'retry') { if (currentPreviewId && currentMemberData) renderMemberPreview(currentMemberData); else await render(tab); return; }
      if (action === 'member') { await loadMember(el.dataset.id); return; }
      if (action === 'preview-member') { await beginPreview(el.dataset.id); return; }
      if (action === 'grant-package') { await grantPackage(el.dataset.id); return; }
      if (action === 'exit-imp') { await endPreview(true); return; }
      if (action === 'sweep') {
        if (!window.confirm('Run the income sweep now? This will credit any due income drops.')) return;
        await refreshAfter('run_sweep', {}, 'Income sweep completed.'); return;
      }
      if (action === 'approve' || action === 'reject') {
        const type = el.dataset.type;
        const verb = action === 'approve' ? 'approve' : 'reject';
        if (!window.confirm(`Are you sure you want to ${verb} this ${type}?`)) return;
        const note = action === 'reject' ? window.prompt('Reason for rejection:') : window.prompt('Optional note:') || '';
        if (action === 'reject' && !note?.trim()) { UI.toast('A rejection reason is required.', 'warn'); return; }
        const verbKey = action + '_' + type;
        await refreshAfter(verbKey, { id: el.dataset.id, note: note || '' }); return;
      }
      if (action === 'adjust') {
        const amount = window.prompt(`Amount to ${el.dataset.direction}:`);
        if (amount == null) return;
        const note = window.prompt('Reason (required):');
        if (!note?.trim()) { UI.toast('A reason is required.', 'warn'); return; }
        await refreshAfter(el.dataset.direction, { user_id: el.dataset.id, amount: Number(amount), note }); return;
      }
      if (action === 'ban') {
        const currentlyActive = el.dataset.active === 'true';
        if (!window.confirm(currentlyActive ? 'Suspend this member?' : 'Reinstate this member?')) return;
        await refreshAfter(currentlyActive ? 'ban' : 'unban', { user_id: el.dataset.id }); return;
      }
      if (action === 'create-unit') { promptUnit(); return; }
      if (action === 'edit-unit') {
        promptUnit(unitsCache.find(u => u.id === el.dataset.id)); return;
      }
      if (action === 'unit-status') {
        await refreshAfter('unit_status', { id: el.dataset.id, status: el.dataset.status }); return;
      }
      if (action === 'signout') {
        if (currentPreviewId) await endPreview(false);
        await Store.logout(); location.replace('../index.html'); return;
      }
    } catch (err) {
      UI.toast(err.message || 'The action failed.', 'err');
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.Store || !Store.live || !Store.sb) {
        message('Secure admin service unavailable', 'Supabase did not initialize. Check the network connection and reload.');
        return;
      }
      const session = await Store.session();
      if (!session) {
        location.replace('../index.html');
        return;
      }
      setTabs();
      await render('overview');
    } catch (e) {
      message('Could not start the console', e.message || 'Please reload and try again.', true);
    } finally {
      UI.bootOff();
    }
  });

  const clock = $('#clock');
  function updateClock() {
    if (clock) clock.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour12: false }) + ' WAT';
  }
  updateClock();
  setInterval(updateClock, 1000);
})();
