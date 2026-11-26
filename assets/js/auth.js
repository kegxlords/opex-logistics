/* ============================================================
   CSC APARTMENTS — Auth controller (production)
   login · register · forgot · reset — no demo paths
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, toast, bootOff, guard } = UI;

  /* ---------------- helpers ---------------- */
  function alertBox(id) {
    const el = document.getElementById(id);
    return {
      el,
      show(msg, kind) {
        el.className = 'alert alert--' + (kind || 'err') + ' show';
        el.innerHTML = icon(kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert') + '<span>' + esc(msg) + '</span>';
      },
      hide() { el.className = 'alert'; el.innerHTML = ''; }
    };
  }
  function busy(btn, on, label) {
    if (on) { btn.dataset.old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="spin"></i> ' + (label || 'Working…'); }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.old || label || 'Continue'; }
  }
  function hero() {
    const h = document.getElementById('hero'); if (!h) return;
    h.innerHTML = `<img class="auth-hero-img" src="${esc(window.PINNACLE.IMAGES.authHero)}" alt=""
        onerror="this.onerror=null;this.src='${Store.banner(0)}'">
      <div class="auth-hero-badge">${UI.crest()}<b>OPEX LOGISTICS DISPATCH</b></div>`;
  }
  function eyes() {
    document.querySelectorAll('[data-eye]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = document.getElementById(btn.dataset.eye);
        const show = t.type === 'password';
        t.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
      });
    });
  }
  function strength(input, meter) {
    if (!input || !meter) return;
    input.addEventListener('input', () => {
      const v = input.value; let s = 0;
      if (v.length >= 6) s++;
      if (v.length >= 10) s++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
      if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
      meter.className = 'strength s' + s;
    });
  }
  function rememberEmail() {
    try {
      const saved = localStorage.getItem('pinnacle.email');
      const el = document.getElementById('email');
      const chk = document.getElementById('remember');
      if (el && saved) el.value = saved;
      const form = document.getElementById('loginForm');
      if (form && chk) form.addEventListener('submit', () => {
        try {
          if (chk.checked) localStorage.setItem('pinnacle.email', el.value.trim());
          else localStorage.removeItem('pinnacle.email');
        } catch (e) {}
      });
    } catch (e) {}
  }

  /* ---------------- page routers ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;
    hero(); eyes();
    const session = await guard();
    bootOff();

    /* ===== LOGIN ===== */
    if (page === 'login') {
      const a = alertBox('alert');
      const form = document.getElementById('loginForm');
      rememberEmail();
      form.addEventListener('submit', async e => {
        e.preventDefault(); a.hide();
        const btn = form.querySelector('button[type=submit]');
        busy(btn, true, 'Signing in…');
        try {
          await Store.login(document.getElementById('email').value, document.getElementById('password').value);
          a.show('Welcome back. Opening your portfolio…', 'ok');
          setTimeout(() => location.replace('dashboard.html'), 550);
        } catch (err) { a.show(err.message); busy(btn, false, 'Sign In'); }
      });
    }

    /* ===== REGISTER ===== */
    if (page === 'register') {
      const a = alertBox('alert');
      const form = document.getElementById('regForm');
      strength(document.getElementById('password'), document.getElementById('meter'));

      const ref = new URLSearchParams(location.search).get('ref');
      if (ref) {
        document.getElementById('invite').value = ref.toUpperCase();
        a.show('Invitation code applied — you are joining a verified member’s network.', 'ok');
      }
      document.getElementById('bonusAmt').textContent = UI.naira2(Store.setting('welcome_bonus'));

      form.addEventListener('submit', async e => {
        e.preventDefault(); a.hide();
        const btn = form.querySelector('button[type=submit]');
        busy(btn, true, 'Creating access pass…');
        try {
          const r = await Store.register({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            invite: document.getElementById('invite').value.trim()
          });
          if (r.needsVerify) {
            a.show('Account created. Check ' + r.email + ' for your confirmation link, then sign in.', 'ok');
            busy(btn, false, 'Create access pass'); form.reset();
          } else {
            a.show('Account created with a ' + UI.naira(Store.setting('welcome_bonus')) + ' welcome bonus. Taking you to sign in…', 'ok');
            setTimeout(() => location.replace('index.html'), 1100);
          }
        } catch (err) {
          a.show(err.message);
          busy(btn, false, 'Create access pass');
        }
      });
    }

    /* ===== FORGOT ===== */
    if (page === 'forgot') {
      const a = alertBox('alert');
      const form = document.getElementById('forgotForm');
      form.addEventListener('submit', async e => {
        e.preventDefault(); a.hide();
        const btn = form.querySelector('button[type=submit]');
        busy(btn, true, 'Sending link…');
        try {
          await Store.requestReset(document.getElementById('email').value);
          a.show('If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.', 'ok');
          busy(btn, false, 'Send Reset Link');
        } catch (err) { a.show(err.message); busy(btn, false, 'Send Reset Link'); }
      });
    }

    /* ===== RESET ===== */
    if (page === 'reset') {
      const a = alertBox('alert');
      const form = document.getElementById('resetForm');
      const token = new URLSearchParams(location.search).get('token') || '';
      strength(document.getElementById('password'), document.getElementById('meter'));
      if (Store.live ? !session : !token) a.show('This recovery link is missing or expired. Open the latest reset email or request a new link.', 'warn');

      form.addEventListener('submit', async e => {
        e.preventDefault(); a.hide();
        const p1 = document.getElementById('password').value;
        const p2 = document.getElementById('confirm').value;
        if (p1 !== p2) { a.show('The two passwords do not match.'); return; }
        const btn = form.querySelector('button[type=submit]');
        busy(btn, true, 'Updating…');
        try {
          await Store.resetPassword(token, p1);
          a.show('Password updated. Taking you to sign in…', 'ok');
          setTimeout(() => location.replace('index.html'), 1000);
        } catch (err) { a.show(err.message); busy(btn, false, 'Update Password'); }
      });
    }
  });
})();
