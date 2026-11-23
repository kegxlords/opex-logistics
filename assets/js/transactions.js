/* ============================================================
   CSC APARTMENTS — Transaction ledger
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, toast, debounce } = UI;
  const A = Actions;

  const TYPES = [
    ['all', 'All'], ['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'],
    ['rental_income', 'Income'], ['checkin_bonus', 'Attendance'],
    ['referral_commission', 'Commissions'], ['lease_purchase', 'Leases']
  ];
  let filter = 'all', query = '';

  function visible() {
    let tx = Store.transactions(filter);
    if (query) {
      const q = query.toLowerCase();
      tx = tx.filter(t => (t.description || '').toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q));
    }
    return tx;
  }

  function sums() {
    const all = Store.transactions();
    const inSum = all.filter(t => t.status === 'completed' && A.isIn(t)).reduce((s, t) => s + t.net_amount, 0);
    const outSum = all.filter(t => t.status === 'completed' && !A.isIn(t)).reduce((s, t) => s + t.amount, 0);
    const pend = all.filter(t => t.status === 'pending').length;
    document.getElementById('sums').innerHTML = `
      <div class="sum"><div class="k">Total in</div><div class="v c-green">${naira(inSum)}</div></div>
      <div class="sum"><div class="k">Total out</div><div class="v c-red">${naira(outSum)}</div></div>
      <div class="sum"><div class="k">Pending</div><div class="v c-pink">${pend}</div></div>`;
  }

  function chips() {
    document.getElementById('chips').innerHTML = TYPES.map(([k, l]) =>
      `<button class="btn btn--${filter === k ? 'blue' : 'ghost'} btn--xs" type="button" data-f="${k}">${l}</button>`).join('');
    document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f; chips(); list();
    }));
  }

  function list() {
    const tx = visible();
    const root = document.getElementById('list');
    root.innerHTML = tx.length ? tx.map(A.txRow).join('')
      : `<div class="empty"><div class="empty-art">${icon('hist')}</div>
          <b>No matching transactions</b><p>Try a different filter or clear your search.</p></div>`;
    root.querySelectorAll('[data-tx]').forEach(b => b.addEventListener('click', () => A.txDetail(b.dataset.tx)));
  }

  function exportCSV() {
    const tx = visible();
    if (!tx.length) { toast('Nothing to export', 'warn'); return; }
    const rows = [['Date', 'Type', 'Description', 'Reference', 'Amount', 'Fee', 'Net', 'Status']];
    tx.forEach(t => rows.push([dt(t.created_at), t.type, t.description, t.reference, t.amount, t.fee || 0, t.net_amount, t.status]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'tranex-transactions.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('Exported ' + tx.length + ' transactions', 'ok');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    UI.mountHeader({ title: 'Garage ledger', back: 'dashboard.html' });
    UI.mountNav('transactions.html');
    sums(); chips(); list();
    document.getElementById('search').addEventListener('input', debounce(e => {
      query = e.target.value.trim(); list();
    }, 180));
    document.getElementById('export').addEventListener('click', exportCSV);
    window.addEventListener('pinnacle:income', () => { sums(); list(); });
    UI.bootOff();
  });
})();
