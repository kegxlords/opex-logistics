/* ============================================================
   CSC APARTMENTS — Refer · Team · Profile
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, dOnly, toast, layer, closeLayer, debounce, countTo } = UI;
  const A = Actions;

  const refLink = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'register.html?ref=' + Store.me().referral_code;
  const AV = ['var(--g-blue)', 'var(--g-pink)', 'var(--g-green)', 'var(--g-red)', 'var(--g-money)'];
  const initial = n => (n || 'M').trim().charAt(0).toUpperCase();

  function copyText(v, msg) {
    navigator.clipboard.writeText(v).then(() => toast(msg || 'Copied', 'ok'))
      .catch(() => toast('Copy unavailable — select the text manually', 'warn'));
  }

  /* ================= REFER ================= */
  function initRefer() {
    const me = Store.me(), s = Store.settings(), link = refLink();
    document.getElementById('code').textContent = me.referral_code;
    document.getElementById('link').value = link;
    document.getElementById('copyLink').addEventListener('click', () => copyText(link, 'Referral link copied'));

    document.getElementById('qr').innerHTML = QR.svg(link, { dark: '#123A8F', scale: 8 });
    document.getElementById('qrPng').addEventListener('click', () => {
      try { QR.downloadPNG(link, 'tranex-' + me.referral_code + '.png'); toast('QR downloaded', 'ok'); }
      catch (e) { toast(e.message, 'err'); }
    });
    document.getElementById('qrSvg').addEventListener('click', () => {
      QR.downloadSVG(link, 'tranex-' + me.referral_code + '.svg'); toast('QR downloaded', 'ok');
    });

    const shareText = `Join me on Tranex — track every lease and income drop from your dispatch board. Use my code ${me.referral_code}: ${link}`;
    document.getElementById('waShare').href = 'https://wa.me/?text=' + encodeURIComponent(shareText);
    document.getElementById('shareBtn').addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ title: 'Tranex', text: shareText, url: link }); }
        catch (e) { if (e.name !== 'AbortError') copyText(link, 'Referral link copied'); }
      } else copyText(link, 'Referral link copied — paste it anywhere');
    });

    document.getElementById('levels').innerHTML = [[1, s.referral_l1], [2, s.referral_l2], [3, s.referral_l3]]
      .map(([l, p]) => `<div class="lvl"><b>${p}%</b><span>LEVEL ${l}</span></div>`).join('');

    const team = Store.team();
    const comm = Store.transactions('referral_commission');
    const earned = comm.reduce((a, t) => a + t.net_amount, 0);
    document.getElementById('earn').innerHTML = `
      <div class="tot" style="padding:14px 8px;border-radius:var(--r-md);text-align:center;background:var(--ground);border:1px solid var(--hairline)">
        <div class="v c-green" style="font-family:var(--font-display);font-size:17px;font-weight:800">${naira(earned)}</div>
        <div class="k" style="font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-2)">Earned</div></div>
      <div class="tot" style="padding:14px 8px;border-radius:var(--r-md);text-align:center;background:var(--ground);border:1px solid var(--hairline)">
        <div class="v c-blue" style="font-family:var(--font-display);font-size:17px;font-weight:800">${team.l1.length + team.l2.length + team.l3.length}</div>
        <div class="k" style="font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-2)">Members</div></div>
      <div class="tot" style="padding:14px 8px;border-radius:var(--r-md);text-align:center;background:var(--ground);border:1px solid var(--hairline)">
        <div class="v c-pink" style="font-family:var(--font-display);font-size:17px;font-weight:800">${comm.length}</div>
        <div class="k" style="font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-2)">Payouts</div></div>`;

    document.getElementById('comm').innerHTML = comm.length ? comm.slice(0, 8).map(A.txRow).join('')
      : `<div class="empty"><div class="empty-art">${icon('refer')}</div><b>No commissions yet</b><p>Share your link. You earn the moment someone in your network funds their account.</p></div>`;
    document.querySelectorAll('#comm [data-tx]').forEach(b => b.addEventListener('click', () => A.txDetail(b.dataset.tx)));
  }

  /* ================= TEAM ================= */
  let level = 1, tQuery = '', tSort = 'new';

  function teamTotals() {
    const t = Store.team();
    const all = [...t.l1, ...t.l2, ...t.l3];
    const active = all.filter(m => m.has_funded).length;
    document.getElementById('totals').innerHTML = `
      <div class="tot"><div class="v c-blue">${all.length}</div><div class="k">Total team</div></div>
      <div class="tot"><div class="v c-green">${active}</div><div class="k">Active</div></div>
      <div class="tot"><div class="v c-red">${all.length - active}</div><div class="k">Inactive</div></div>
      <div class="tot"><div class="v c-pink">${naira(all.reduce((a, m) => a + Number(m.total_funded || 0), 0))}</div><div class="k">Team funding</div></div>`;
  }

  function teamTabs() {
    const t = Store.team();
    const counts = { 1: t.l1.length, 2: t.l2.length, 3: t.l3.length };
    document.getElementById('tabs').innerHTML = [1, 2, 3].map(l =>
      `<button type="button" class="${level === l ? 'on' : ''}" data-l="${l}">Level ${l} · ${counts[l]}</button>`).join('');
    document.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => {
      level = +b.dataset.l; teamTabs(); teamList();
    }));
  }

  function teamList() {
    const t = Store.team();
    let rows = t['l' + level].slice();
    if (tQuery) rows = rows.filter(m => (m.full_name || '').toLowerCase().includes(tQuery.toLowerCase()));
    if (tSort === 'funded') rows.sort((a, b) => Number(b.total_funded || 0) - Number(a.total_funded || 0));
    else if (tSort === 'name') rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    else rows.sort((a, b) => b.created_at - a.created_at);

    const root = document.getElementById('list');
    if (!rows.length) {
      root.innerHTML = `<div class="empty"><div class="empty-art">${icon('team')}</div>
        <b>${tQuery ? 'No matching members' : 'No level ' + level + ' members yet'}</b>
        <p>${tQuery ? 'Try a different search term.' : 'Share your referral link to start building this level of your network.'}</p>
        ${tQuery ? '' : '<a class="btn btn--primary btn--sm" href="refer.html" style="margin-top:14px">Get my link</a>'}</div>`;
      return;
    }
    root.innerHTML = rows.map((m, i) => `
      <div class="member">
        <span class="avatar" style="background:${AV[i % AV.length]}">${initial(m.full_name)}</span>
        <div style="flex:1;min-width:0">
          <b style="display:block;font-size:13.5px;font-weight:800">${esc(m.full_name || 'Member')}</b>
          <span class="c-muted" style="font-size:11px;font-weight:600">Joined ${dOnly(m.created_at)} · Funded ${naira(m.total_funded || 0)}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
          <span class="tag tag--${m.has_funded ? 'live' : 'out'}">${m.has_funded ? 'Active' : 'Inactive'}</span>
          <span class="tag tag--soon">Lvl ${level}</span>
        </div>
      </div>`).join('');
  }

  function initTeam() {
    const link = refLink();
    document.getElementById('link').value = link;
    document.getElementById('copy').addEventListener('click', () => copyText(link, 'Referral link copied'));
    teamTotals(); teamTabs(); teamList();
    document.getElementById('search').addEventListener('input', debounce(e => { tQuery = e.target.value.trim(); teamList(); }, 180));
    document.getElementById('sort').addEventListener('change', e => { tSort = e.target.value; teamList(); });
  }

  /* ================= PROFILE ================= */
  const DIRECTORY = [
    { title: '01 / Operations', links: [
      ['dashboard.html', 'home', 'Dispatch board', 'Balance, income and activity', 'amber'],
      ['rents.html', 'rents', 'My fleet', 'Active leases and income routes', 'green'],
      ['check-in.html', 'flame', 'Daily check-in', 'Claim today’s attendance reward', 'teal']
    ] },
    { title: '02 / Funds & records', links: [
      ['deposit.html', 'in', 'Deposit', 'Add funds to your account', 'green'],
      ['withdraw.html', 'out', 'Withdraw', 'Request a payout', 'red'],
      ['bank-card.html', 'bank', 'Bank cards', 'Manage payout destinations', 'blue'],
      ['transactions.html', 'hist', 'Transaction ledger', 'Review and export account activity', 'amber']
    ] },
    { title: '03 / Crew & support', links: [
      ['refer.html', 'refer', 'Refer & earn', 'Share your invitation link and QR', 'teal'],
      ['team.html', 'team', 'My team', 'View your referral network', 'blue'],
      ['support.html', 'headset', 'Support desk', 'Contact Tranex care', 'amber']
    ] }
  ];

  function initProfile() {
    const me = Store.me(), s = Store.settings(), w = Store.wallet();
    const ls = Store.leases();

    document.getElementById('hero').innerHTML = `
      <div class="p-hero">
        <div class="p-avatar">${initial(me.full_name)}</div>
        <h2>${esc(me.full_name || 'Member')}</h2>
        <p>${esc(me.email || '')}</p>
        <p style="margin-top:8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Resident since ${dOnly(me.created_at)}</p>
      </div>`;

    document.getElementById('stats').innerHTML = `
      <div class="p-stat"><div class="k">Balance</div><div class="v c-blue">${naira(w.balance)}</div></div>
      <div class="p-stat"><div class="k">Funded</div><div class="v c-green">${naira(me.total_funded || 0)}</div></div>
      <div class="p-stat"><div class="k">Withdrawn</div><div class="v c-pink">${naira(me.total_withdrawn || 0)}</div></div>`;

    document.getElementById('details').innerHTML = `
      <div class="kv"><span class="k">Full name</span><span class="v" style="font-size:13px">${esc(me.full_name || '—')}</span></div>
      <div class="kv"><span class="k">Email</span><span class="v" style="font-size:12.5px">${esc(me.email || '—')}</span></div>
      <div class="kv"><span class="k">Phone</span><span class="v" style="font-size:13px">${esc(me.phone || 'Not set')}</span></div>
      <div class="kv"><span class="k">Referral code</span><span class="v" style="font-size:13px">${esc(me.referral_code)} ${A.copyBtn(me.referral_code)}</span></div>
      <div class="kv"><span class="k">Active leases</span><span class="v">${ls.filter(l => l.status === 'active').length}</span></div>
      <div class="kv"><span class="k">Attendance streak</span><span class="v c-pink">${me.streak_days || 0} days</span></div>
      <div class="kv"><span class="k">Account status</span><span class="v"><span class="tag tag--${me.is_active ? 'live' : 'out'}">${me.is_active ? 'Active' : 'Suspended'}</span></span></div>`;
    A.wireCopy(document.getElementById('details'));

    document.getElementById('dir').innerHTML = DIRECTORY.map(group => `
      <section class="dir-group">
        <h4>${group.title}</h4>
        <div class="dir-links">${group.links.map(([href, ic, label, detail, tone]) => `
          <a class="dir-link" href="${href}">
            <i class="dir-icon dir-icon--${tone}">${icon(ic)}</i>
            <span><b>${label}</b><small>${detail}</small></span><em aria-hidden="true">›</em>
          </a>`).join('')}
        </div>
      </section>`).join('') + `
      <section class="dir-group dir-account">
        <h4>04 / Session</h4>
        <div class="dir-links"><a href="#" id="logout" class="dir-link danger">
          <i class="dir-icon dir-icon--red">${icon('logout')}</i>
          <span><b>Sign out</b><small>End this member session</small></span><em aria-hidden="true">›</em>
        </a></div>
      </section>`;

    document.getElementById('community').innerHTML = `
      <a class="wa-btn wa-btn--wa" href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">${icon('wa')}<span>WhatsApp Group<small>Alerts &amp; community</small></span>${icon('chev')}</a>
      <a class="wa-btn wa-btn--cs" href="${esc(s.telegram_link)}" target="_blank" rel="noopener">${icon('refer')}<span>Telegram Channel<small>Announcements</small></span>${icon('chev')}</a>
      <a class="wa-btn" style="background:var(--g-pink);box-shadow:var(--sh-pink)" href="support.html">${icon('headset')}<span>Customer Service<small>${esc(s.support_email)}</small></span>${icon('chev')}</a>`;

    document.getElementById('editPhone').addEventListener('click', () => {
      const l = layer(`
        <div class="sheet-head"><h3>${icon('user')} Phone number</h3>
          <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
        <form id="phForm">
          <div class="field-row"><label class="label" for="ph">Phone</label>
            <div class="input-wrap">${icon('user')}<input class="input" id="ph" inputmode="tel" value="${esc(me.phone || '')}" placeholder="08031234567"></div>
            <p class="hint">Used by our care team only. Your email remains your sign-in.</p></div>
          <button class="btn btn--blue btn--block" type="submit">Save</button>
        </form>`, 'sheet');
      l.querySelector('#phForm').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Saving…';
        try {
          await Store.updateProfile({ phone: l.querySelector('#ph').value.trim() });
          closeLayer(); toast('Phone number updated', 'ok', { undo: () => { Store.undo(); initProfile(); toast('Reverted', 'info'); } });
          initProfile();
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
      });
    });

    document.getElementById('logout').addEventListener('click', e => {
      e.preventDefault();
      UI.confirmSheet({
        title: 'Sign out?', confirmText: 'Sign out', kind: 'red',
        body: '<p class="c-muted" style="font-size:13px;font-weight:600">Your leases keep earning while you are away. Income drops continue every 24 hours.</p>',
        onConfirm: async () => { await Store.logout(); location.replace('index.html'); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    const page = document.body.dataset.page;
    const titles = { refer: 'Refer & Earn', team: 'My Team', profile: 'Profile' };
    UI.mountHeader({ title: titles[page], back: page === 'profile' ? 'dashboard.html' : 'dashboard.html' });
    UI.mountNav(page === 'refer' ? 'refer.html' : page === 'team' ? 'team.html' : 'profile.html');
    if (page === 'refer') initRefer();
    else if (page === 'team') initTeam();
    else initProfile();
    UI.bootOff();
  });
})();
