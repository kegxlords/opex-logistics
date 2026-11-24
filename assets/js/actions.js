/* ============================================================
   CSC APARTMENTS — shared money & reward flows
   Used by the dedicated pages and reachable from anywhere.
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, naira, dt, toast, layer, closeLayer, confirmSheet, imgWithFallback } = UI;

  const BANKS = [
    'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank',
    'First Bank of Nigeria', 'First City Monument Bank', 'Guaranty Trust Bank',
    'Keystone Bank', 'Kuda Microfinance Bank', 'Opay Digital Services', 'PalmPay',
    'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank',
    'Sterling Bank', 'Union Bank of Nigeria', 'United Bank for Africa',
    'Unity Bank', 'Wema Bank', 'Zenith Bank'
  ];

  const INBOUND = ['welcome_bonus', 'deposit', 'rental_income', 'checkin_bonus', 'referral_commission', 'admin_credit'];
  const isIn = t => INBOUND.includes(t.type);

  function cardVisual(c) {
    return `<div class="bankcard">
      ${c.is_default ? '<span class="bankcard-def">Default</span>' : ''}
      <div class="bankcard-top"><span class="bankcard-bank">${esc(c.bank_name)}</span><span class="bankcard-chip"></span></div>
      <div class="bankcard-no">${esc(c.account_number.replace(/(.{4})/g, '$1 ').trim())}</div>
      <div class="bankcard-name">${esc(c.account_name)}</div>
    </div>`;
  }

  function copyBtn(value) {
    return `<button class="copy" type="button" data-copy="${esc(value)}">Copy</button>`;
  }
  function wireCopy(root) {
    root.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      navigator.clipboard.writeText(b.dataset.copy).then(() => {
        b.classList.add('done'); b.textContent = 'Copied';
        setTimeout(() => { b.classList.remove('done'); b.textContent = 'Copy'; }, 1600);
      }).catch(() => toast('Copy unavailable — select the text manually', 'warn'));
    }));
  }

  /* ---------------- payout cards ---------------- */
  function cardForm(onDone) {
    const l = layer(`
      <div class="sheet-head"><h3>${icon('bank')} Add payout card</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <form id="acCardForm">
        <div class="field-row"><label class="label" for="acBank">Bank</label>
          <div class="input-wrap">${icon('bank')}<select class="input" id="acBank" required>
            <option value="">Select your bank</option>${BANKS.map(b => `<option>${b}</option>`).join('')}
          </select></div></div>
        <div class="field-row"><label class="label" for="acNo">Account number</label>
          <div class="input-wrap">${icon('ticket')}<input class="input" id="acNo" inputmode="numeric" maxlength="10" placeholder="10 digits" required></div></div>
        <div class="field-row"><label class="label" for="acName">Account name</label>
          <div class="input-wrap">${icon('user')}<input class="input" id="acName" placeholder="As shown on your account" required></div></div>
        <label style="display:flex;gap:9px;align-items:center;font-size:13px;font-weight:700;margin-bottom:16px">
          <input type="checkbox" id="acDef" checked style="width:18px;height:18px;accent-color:var(--blue)">
          Make this my default payout card</label>
        <button class="btn btn--blue btn--block" type="submit">Save card</button>
      </form>`, 'sheet');

    l.querySelector('#acNo').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });
    l.querySelector('#acCardForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Saving…';
      try {
        await Store.saveCard({
          bank_name: l.querySelector('#acBank').value,
          account_number: l.querySelector('#acNo').value,
          account_name: l.querySelector('#acName').value,
          makeDefault: l.querySelector('#acDef').checked
        });
        closeLayer(); toast('Payout card saved', 'ok');
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
    return l;
  }

  function removeCard(id, onDone) {
    confirmSheet({
      title: 'Remove this card?', confirmText: 'Remove', kind: 'red',
      body: '<p class="c-muted" style="font-size:13px;font-weight:600">You can add it again at any time. Pending withdrawals are unaffected.</p>',
      onConfirm: async () => {
        await Store.deleteCard(id);
        toast('Card removed', 'info', { undo: () => { Store.undo(); if (onDone) onDone(); toast('Card restored', 'ok'); } });
        if (onDone) onDone();
      }
    });
  }

  /* ---------------- deposit ---------------- */
  function bankBlock() {
    const s = Store.settings();
    const accounts = [1, 2].map(index => ({
      bank: String(s[`deposit_bank_${index}_name`] || '').trim(),
      number: String(s[`deposit_bank_${index}_account_number`] || '').trim(),
      name: String(s[`deposit_bank_${index}_account_name`] || '').trim()
    })).filter(account => account.bank && account.number && account.name);
    if (!accounts.length && s.bank_name && s.account_number && s.account_name) {
      accounts.push({ bank: s.bank_name, number: s.account_number, name: s.account_name });
    }
    if (!accounts.length) return '<div class="card c-muted">Deposit account details are unavailable. Please contact support.</div>';
    return `<div style="display:grid;gap:10px">${accounts.map((account, index) => `<div class="card" style="background:var(--blue-tint);border-color:var(--blue-tint-2);margin:0">
      <div class="c-muted" style="font-size:12px;font-weight:700;margin-bottom:8px">Deposit option ${index + 1}</div>
      <div class="kv"><span class="k">Bank</span><span class="v">${esc(account.bank)} ${copyBtn(account.bank)}</span></div>
      <div class="kv"><span class="k">Account number</span><span class="v">${esc(account.number)} ${copyBtn(account.number)}</span></div>
      <div class="kv"><span class="k">Account name</span><span class="v">${esc(account.name)} ${copyBtn(account.name)}</span></div>
    </div>`).join('')}</div>`;
  }

  function depositSheet(onDone) {
    const s = Store.settings();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('in')} Fund your wallet</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <p class="c-muted" style="font-size:13px;margin:0 0 10px">Send your transfer to either account below.</p>
      ${bankBlock()}
      <div class="alert alert--info show" style="margin-top:14px">${icon('info')}<span>Transfer exactly the amount you enter, then submit below.</span></div>
      <form id="acDep">
        <div class="field-row"><label class="label" for="acDepAmt">Amount (₦)</label>
          <div class="input-wrap">${icon('wallet')}<input class="input" id="acDepAmt" type="number" inputmode="numeric" min="${s.min_deposit}" max="${s.max_deposit}" placeholder="${s.min_deposit}" required></div>
          <p class="hint">Min ${naira(s.min_deposit)} · Max ${naira(s.max_deposit)}</p></div>
        <div class="field-row"><label class="label" for="acDepSender">Sender name <span class="opt">(optional)</span></label>
          <div class="input-wrap">${icon('user')}<input class="input" id="acDepSender" maxlength="80" autocomplete="name" placeholder="Name used to send the transfer"></div></div>
        <button class="btn btn--blue btn--block" type="submit">Submit deposit</button>
      </form>`, 'sheet');
    wireCopy(l);
    l.querySelector('#acDep').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Submitting…';
      try {
        const r = await Store.deposit(l.querySelector('#acDepAmt').value, l.querySelector('#acDepSender').value.trim());
        closeLayer();
        toast('Deposit submitted', 'ok', { sub: 'Reference ' + r.reference, undo: () => { Store.undo(); if (onDone) onDone(); toast('Deposit withdrawn', 'info'); } });
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  /* ---------------- withdraw ---------------- */
  function withdrawSheet(onDone) {
    const cards = Store.cards();
    if (!cards.length) {
      confirmSheet({
        title: 'Add a payout card', confirmText: 'Add card', kind: 'blue',
        body: `<div class="empty" style="padding:12px 0 4px"><div class="empty-art">${icon('bank')}</div>
          <b>No payout card saved</b><p>Save your bank account once and it will be used for every withdrawal.</p></div>`,
        onConfirm: async () => { setTimeout(() => cardForm(() => withdrawSheet(onDone)), 280); }
      });
      return;
    }
    const r = Store.withdrawRules(), w = Store.wallet(), s = Store.settings(), def = Store.defaultCard();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('out')} Withdraw</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="alert alert--${r.open ? 'info' : 'warn'} show">${icon(r.open ? 'clock' : 'alert')}
        <span>${r.open ? 'Window open' : 'Window closed'} · ${esc(r.days)} · ${esc(r.window)} WAT · ${r.usedToday}/${r.cap} used today</span></div>
      <div style="margin-bottom:14px">${cardVisual(def)}</div>
      ${cards.length > 1 ? `<div class="field-row"><label class="label" for="acWCard">Payout card</label>
        <div class="input-wrap">${icon('bank')}<select class="input" id="acWCard">
          ${cards.map(c => `<option value="${c.id}" ${c.id === def.id ? 'selected' : ''}>${esc(c.bank_name)} · ${esc(c.account_number)}</option>`).join('')}
        </select></div></div>` : `<input type="hidden" id="acWCard" value="${def.id}">`}
      <form id="acW">
        <div class="field-row"><label class="label" for="acWAmt">Amount (₦)</label>
          <div class="input-wrap">${icon('wallet')}<input class="input" id="acWAmt" type="number" inputmode="numeric" min="${r.min}" max="${r.max}" placeholder="${r.min}" required></div>
          <p class="hint">Available ${naira(w.balance - w.locked)} · Min ${naira(r.min)} · Max ${naira(r.max)}</p></div>
        <div class="total-box">
          <div class="kv"><span class="k">Withdrawal amount</span><span class="v" id="acWG">${naira(0)}</span></div>
          <div class="kv"><span class="k">Processing fee (${s.withdrawal_fee}%)</span><span class="v c-red" id="acWF">${naira(0)}</span></div>
          <div class="kv grand"><span class="k">You receive</span><span class="v" id="acWN">${naira(0)}</span></div>
        </div>
        <button class="btn btn--red btn--block" type="submit" ${r.open ? '' : 'disabled'}>${r.open ? 'Request withdrawal' : 'Withdrawals closed'}</button>
      </form>`, 'sheet');
    const calc = () => {
      const a = +l.querySelector('#acWAmt').value || 0, fee = Math.round(a * s.withdrawal_fee) / 100;
      l.querySelector('#acWG').textContent = naira(a);
      l.querySelector('#acWF').textContent = naira(fee);
      l.querySelector('#acWN').textContent = naira(a - fee);
    };
    l.querySelector('#acWAmt').addEventListener('input', calc);
    l.querySelector('#acW').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'), old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<i class="spin"></i> Processing…';
      try {
        const res = await Store.withdraw(l.querySelector('#acWAmt').value, l.querySelector('#acWCard').value);
        closeLayer();
        toast('Withdrawal requested', 'ok', { sub: naira(res.net) + ' net · ' + res.reference, undo: () => { Store.undo(); if (onDone) onDone(); toast('Withdrawal cancelled', 'info'); } });
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.innerHTML = old; }
    });
  }

  /* ---------------- check-in ---------------- */
  function checkinSheet(onDone) {
    const st = Store.checkinState(), s = Store.settings();
    const l = layer(`
      <div class="sheet-head"><h3>${icon('flame')} Daily attendance</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div class="streak"><span class="streak-flame">🔥</span>
        <div><b>${st.streak}</b><span>day streak · best ${st.longest || 0}</span></div></div>
      <div class="total-box">
        <div class="kv"><span class="k">Today’s bonus</span><span class="v c-green">${naira(st.bonus)}</span></div>
        <div class="kv"><span class="k">Day 7 streak</span><span class="v">+${s.streak_7}%</span></div>
        <div class="kv"><span class="k">Day 14 streak</span><span class="v">+${s.streak_14}%</span></div>
        <div class="kv"><span class="k">Day 30 streak</span><span class="v">+${s.streak_30}%</span></div>
      </div>
      <button class="btn btn--primary btn--block" type="button" id="acCi" ${st.claimed ? 'disabled' : ''}>
        ${st.claimed ? 'Already checked in today' : 'Claim ' + naira(st.bonus)}</button>`, 'sheet');
    const b = l.querySelector('#acCi');
    if (!st.claimed) b.addEventListener('click', async () => {
      const old = b.innerHTML; b.disabled = true; b.innerHTML = '<i class="spin"></i> Claiming…';
      try {
        const r = await Store.checkin();
        closeLayer();
        toast('+' + naira(r.total) + ' attendance bonus', 'ok', { sub: 'Day ' + r.streak + (r.pct ? ' · +' + r.pct + '% streak' : ''), undo: () => { Store.undo(); if (onDone) onDone(); toast('Check-in reversed', 'info'); } });
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'err'); b.disabled = false; b.innerHTML = old; }
    });
  }

  /* ---------------- transaction row + detail ---------------- */
  function txRow(t) {
    const ic = t.type === 'rental_income' ? 'in' : t.type === 'withdrawal' ? 'out' : t.type === 'lease_purchase' ? 'building' : 'gift';
    const cls = t.type === 'lease_purchase' ? 'rent' : t.type === 'withdrawal' ? 'out' : isIn(t) ? 'in' : 'bonus';
    const st = t.status === 'completed' ? 'live' : t.status === 'pending' ? 'pending' : 'out';
    return `<button class="row" type="button" data-tx="${t.id}" style="width:100%;text-align:left;background:none">
      <span class="row-ic row-ic--${cls}">${icon(ic)}</span>
      <span class="row-main"><b>${esc(t.description)}</b><span>${dt(t.created_at)} · ${esc(t.reference)}</span></span>
      <span class="row-end"><span class="amt ${isIn(t) ? 'in' : 'out'}">${isIn(t) ? '+' : '−'}${naira(t.amount)}</span>
        <span class="tag tag--${st}">${t.status}</span></span></button>`;
  }

  function txDetail(id) {
    const t = Store.transactions().find(x => x.id === id);
    if (!t) return;
    layer(`
      <div class="sheet-head"><h3>${icon('hist')} Transaction</h3>
        <button class="modal-x" data-close style="position:static">${icon('x')}</button></div>
      <div style="text-align:center;padding:10px 0 18px">
        <div class="dsp ${isIn(t) ? 'c-green' : 'c-red'}" style="font-size:34px;font-weight:800;letter-spacing:-.03em">${isIn(t) ? '+' : '−'}${naira(t.amount)}</div>
        <span class="tag tag--${t.status === 'completed' ? 'live' : t.status === 'pending' ? 'pending' : 'out'}" style="margin-top:8px">${t.status}</span>
      </div>
      <div class="total-box">
        <div class="kv"><span class="k">Description</span><span class="v" style="font-size:13px;text-align:right">${esc(t.description)}</span></div>
        <div class="kv"><span class="k">Type</span><span class="v" style="font-size:13px">${esc(t.type.replace(/_/g, ' '))}</span></div>
        <div class="kv"><span class="k">Reference</span><span class="v" style="font-size:13px">${esc(t.reference)} ${copyBtn(t.reference)}</span></div>
        <div class="kv"><span class="k">Date &amp; time</span><span class="v" style="font-size:13px">${dt(t.created_at)}</span></div>
        ${t.fee ? `<div class="kv"><span class="k">Fee</span><span class="v c-red">${naira(t.fee)}</span></div>` : ''}
        ${t.fee ? `<div class="kv grand"><span class="k">Net</span><span class="v">${naira(t.net_amount)}</span></div>` : ''}
        ${t.bank_name ? `<div class="kv"><span class="k">Bank</span><span class="v" style="font-size:13px">${esc(t.bank_name)}</span></div>` : ''}
        ${t.account_number ? `<div class="kv"><span class="k">Account</span><span class="v" style="font-size:13px">${esc(t.account_number)} ${copyBtn(t.account_number)}</span></div>` : ''}
        ${t.account_name ? `<div class="kv"><span class="k">Name</span><span class="v" style="font-size:13px">${esc(t.account_name)}</span></div>` : ''}
        ${t.admin_note ? `<div class="kv"><span class="k">Note</span><span class="v" style="font-size:13px;text-align:right">${esc(t.admin_note)}</span></div>` : ''}
      </div>`, 'sheet');
    wireCopy(document.querySelector('.sheet-scrim.on') || document.body);
  }

  window.Actions = {
    BANKS, isIn, cardVisual, copyBtn, wireCopy, bankBlock,
    cardForm, removeCard, depositSheet, withdrawSheet, checkinSheet, txRow, txDetail
  };
})();
