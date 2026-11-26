/* ============================================================
   CSC APARTMENTS — Deposit & Withdraw pages
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, toast, countTo } = UI;
  const A = Actions;

  function alertBox(id) {
    const el = document.getElementById(id);
    return {
      show(m, k) { el.className = 'alert alert--' + (k || 'err') + ' show'; el.innerHTML = icon(k === 'ok' ? 'check' : 'info') + '<span>' + esc(m) + '</span>'; },
      hide() { el.className = 'alert'; }
    };
  }

  function recent(type, rootId) {
    const tx = Store.transactions(type).slice(0, 8);
    document.getElementById(rootId).innerHTML = tx.length
      ? tx.map(A.txRow).join('')
      : `<div class="empty"><div class="empty-art">${icon('hist')}</div><b>Nothing here yet</b><p>Your ${type} requests will appear here once submitted.</p></div>`;
    document.querySelectorAll('#' + rootId + ' [data-tx]').forEach(b =>
      b.addEventListener('click', () => A.txDetail(b.dataset.tx)));
  }

  /* ================= DEPOSIT ================= */
  function initDeposit() {
    const s = Store.settings(), a = alertBox('alert');
    const paintBal = () => {
      const w = Store.wallet();
      document.getElementById('bal').textContent = naira(w.balance);
    };
    paintBal();
    countTo(document.getElementById('bal'), Store.wallet().balance, naira);

    const bank = document.getElementById('bank');
    bank.innerHTML = A.bankBlock();
    A.wireCopy(bank);

    document.getElementById('limits').textContent = `Minimum ${naira(s.min_deposit)} · Maximum ${naira(s.max_deposit)}`;
    document.getElementById('amt').min = s.min_deposit;
    document.getElementById('amt').max = s.max_deposit;

    const presets = [s.min_deposit, 15000, 45000, 120000, 300000].filter((v, i, arr) => v <= s.max_deposit && arr.indexOf(v) === i);
    document.getElementById('quick').innerHTML = presets.map(v =>
      `<button class="btn btn--ghost btn--xs" type="button" data-amt="${v}">${naira(v)}</button>`).join('');
    document.querySelectorAll('[data-amt]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('amt').value = b.dataset.amt;
      document.querySelectorAll('[data-amt]').forEach(x => x.className = 'btn btn--ghost btn--xs');
      b.className = 'btn btn--blue btn--xs';
    }));

    recent('deposit', 'recent');

    document.getElementById('depForm').addEventListener('submit', async e => {
      e.preventDefault(); a.hide();
      const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Submitting…';
      try {
        const r = await Store.deposit(document.getElementById('amt').value, document.getElementById('senderName').value.trim());
        a.show((r.message || 'Deposit submitted.') + ' Reference ' + r.reference + (r.checkoutUrl ? ' Opening secure checkout…' : ' Our team will confirm shortly.'), 'ok');
        toast('Deposit submitted', 'ok', { sub: 'Reference ' + r.reference, undo: () => { Store.undo(); paintBal(); recent('deposit', 'recent'); toast('Deposit withdrawn', 'info'); } });
        e.target.reset();
        if (r.checkoutUrl) { window.location.assign(r.checkoutUrl); return; }
        document.querySelectorAll('[data-amt]').forEach(x => x.className = 'btn btn--ghost btn--xs');
        paintBal(); recent('deposit', 'recent');
        btn.disabled = false; btn.innerHTML = old;
      } catch (err) { a.show(err.message); toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  /* ================= WITHDRAW ================= */
  function initWithdraw() {
    const s = Store.settings(), a = alertBox('alert');

    function paint() {
      const w = Store.wallet(), r = Store.withdrawRules(), cards = Store.cards(), def = Store.defaultCard();

      document.getElementById('bal').textContent = naira(w.balance - w.locked);
      document.getElementById('locked').textContent = naira(w.locked);

      const win = document.getElementById('window');
      win.className = 'alert alert--' + (r.open ? 'info' : 'warn') + ' show';
      win.innerHTML = icon(r.open ? 'clock' : 'alert') +
        `<span><b>${r.open ? 'Withdrawals are open' : 'Withdrawals are closed'}</b><br>${esc(r.days)} · ${esc(r.window)} WAT</span>`;

      document.getElementById('rules').innerHTML = `
        <div class="rule"><div class="k">Minimum</div><div class="v">${naira(r.min)}</div></div>
        <div class="rule"><div class="k">Maximum</div><div class="v">${naira(r.max)}</div></div>
        <div class="rule"><div class="k">Fee</div><div class="v c-red">${s.withdrawal_fee}%</div></div>
        <div class="rule"><div class="k">Used today</div><div class="v ${r.usedToday >= r.cap ? 'c-red' : 'c-green'}">${r.usedToday} / ${r.cap}</div></div>`;

      const area = document.getElementById('cardArea');
      if (!cards.length) {
        area.innerHTML = `<div class="card"><div class="empty">
          <div class="empty-art">${icon('bank')}</div><b>No payout card saved</b>
          <p>Save your bank account once and it will be used for every withdrawal.</p>
          <button class="btn btn--blue btn--sm" type="button" id="addFirst" style="margin-top:14px">${icon('plus')} Add payout card</button>
        </div></div>`;
        document.getElementById('addFirst').addEventListener('click', () => A.cardForm(paint));
      } else {
        area.innerHTML = `
          <div style="margin-bottom:10px">${A.cardVisual(def)}</div>
          ${cards.length > 1 ? `<div class="field-row"><label class="label" for="cardSel">Payout card</label>
            <div class="input-wrap">${icon('bank')}<select class="input" id="cardSel">
              ${cards.map(c => `<option value="${c.id}" ${c.id === def.id ? 'selected' : ''}>${esc(c.bank_name)} · ${esc(c.account_number)}</option>`).join('')}
            </select></div></div>` : `<input type="hidden" id="cardSel" value="${def.id}">`}
          <a class="btn btn--ghost btn--sm btn--block" href="bank-card.html">${icon('bank')} Manage payout cards</a>`;
      }

      document.getElementById('feeLabel').textContent = `Processing fee (${s.withdrawal_fee}%)`;
      document.getElementById('limits').textContent =
        `Available ${naira(w.balance - w.locked)} · Min ${naira(r.min)} · Max ${naira(r.max)}`;
      document.getElementById('amt').min = r.min;
      document.getElementById('amt').max = r.max;

      const btn = document.getElementById('submit');
      const blocked = !r.open || r.pending || r.usedToday >= r.cap || !cards.length;
      btn.disabled = blocked;
      btn.textContent = !cards.length ? 'Add a payout card first'
        : r.pending ? 'A withdrawal is awaiting review'
        : r.usedToday >= r.cap ? 'Daily limit reached'
        : !r.open ? 'Withdrawals closed'
        : 'Request withdrawal';

      calc();
      recent('withdrawal', 'recent');
    }

    function calc() {
      const amt = +document.getElementById('amt').value || 0;
      const fee = Math.round(amt * Store.settings().withdrawal_fee) / 100;
      document.getElementById('gross').textContent = naira(amt);
      document.getElementById('fee').textContent = naira(fee);
      document.getElementById('net').textContent = naira(amt - fee);
    }

    document.getElementById('amt').addEventListener('input', calc);
    paint();
    countTo(document.getElementById('bal'), Store.wallet().balance - Store.wallet().locked, naira);

    document.getElementById('wForm').addEventListener('submit', async e => {
      e.preventDefault(); a.hide();
      const btn = document.getElementById('submit'), old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Processing…';
      try {
        const cardSel = document.getElementById('cardSel');
        const r = await Store.withdraw(document.getElementById('amt').value, cardSel ? cardSel.value : '');
        a.show(`${r.message || 'Withdrawal requested.'} ${naira(r.net)} will be paid to your saved account. Reference ${r.reference}.`, 'ok');
        toast('Withdrawal requested', 'ok', { sub: naira(r.net) + ' net · ' + r.reference, undo: () => { Store.undo(); paint(); toast('Withdrawal cancelled', 'info'); } });
        document.getElementById('amt').value = '';
        paint();
      } catch (err) { a.show(err.message); toast(err.message, 'err'); paint(); }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await UI.guard()) return;
    const page = document.body.dataset.page;
    UI.mountHeader({ title: page === 'deposit' ? 'Deposit' : 'Withdraw', back: 'dashboard.html' });
    UI.mountNav('dashboard.html');
    if (page === 'deposit') initDeposit(); else initWithdraw();
    UI.bootOff();
  });
})();
