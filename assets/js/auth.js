/* ============================================================
   CSC APARTMENTS — Auth controller (production)
   login · register (captcha) · forgot · reset — no demo paths
   ============================================================ */
(function () {
  'use strict';
  const { icon, esc, toast, bootOff, guard } = UI;

  /* ---------------- canvas captcha ---------------- */
  const Captcha = (() => {
    let value = '', canvas = null, ctx = null;
    function draw() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 112, h = canvas.clientHeight || 50;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      ctx.fillStyle = '#0E1730'; ctx.fillRect(0, 0, w, h);
      const hues = ['#3D9BFF', '#FF6FB0', '#FF6A5E', '#35D68C', '#E8C86A'];
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = hues[i % hues.length] + '55';
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, Math.random() * h);
        ctx.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h);
        ctx.stroke();
      }
      for (let i = 0; i < 34; i++) {
        ctx.fillStyle = hues[i % hues.length] + '99';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
      }
      value = String(Math.floor(1000 + Math.random() * 9000));
      const step = w / 4;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(step * i + step / 2, h / 2 + (Math.random() * 6 - 3));
        ctx.rotate((Math.random() * 34 - 17) * Math.PI / 180);
        ctx.font = '800 ' + (20 + Math.random() * 6) + 'px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = hues[(i + 1) % hues.length];
        ctx.fillText(value[i], 0, 0);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(4, h * .62); ctx.lineTo(w - 4, h * .38); ctx.stroke();
    }
    return {
      mount(el) { canvas = el; draw(); },
      refresh() { draw(); },
      check(v) { return String(v).trim() === value; }
    };
  })();

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
      <div class="auth-hero-badge">${UI.crest()}<b>CSC APARTMENTS</b></div>`;
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
      Captcha.mount(document.getElementById('capCanvas'));
      document.getElementById('capRefresh').addEventListener('click', () => {
        Captcha.refresh();
        document.getElementById('captcha').value = '';
      });
      strength(document.getElementById('password'), document.getElementById('meter'));

      const ref = new URLSearchParams(location.search).get('ref');
      if (ref) {
        document.getElementById('invite').value = ref.toUpperCase();
        a.show('Invitation code applied — you are joining a verified member’s network.', 'ok');
      }
      document.getElementById('bonusAmt').textContent = UI.naira2(Store.setting('welcome_bonus'));

      form.addEventListener('submit', async e => {
        e.preventDefault(); a.hide();
        const capEl = document.getElementById('captcha');
        if (!Captcha.check(capEl.value)) {
          a.show('Captcha does not match. A fresh code has been generated.');
          Captcha.refresh(); capEl.value = '';
          const w = document.getElementById('capWrap');
          w.classList.add('err'); setTimeout(() => w.classList.remove('err'), 1600);
          return;
        }
        const btn = form.querySelector('button[type=submit]');
        busy(btn, true, 'Creating account…');
        try {
          const r = await Store.register({
            full_name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            invite: document.getElementById('invite').value.trim()
          });
          if (r.needsVerify) {
            a.show('Account created. Check ' + r.email + ' for your confirmation link, then sign in.', 'ok');
            busy(btn, false, 'Create Account'); form.reset(); Captcha.refresh();
          } else {
            a.show('Account created with a ' + UI.naira(Store.setting('welcome_bonus')) + ' welcome bonus. Taking you to sign in…', 'ok');
            setTimeout(() => location.replace('index.html'), 1100);
          }
        } catch (err) {
          a.show(err.message); Captcha.refresh(); document.getElementById('captcha').value = '';
          busy(btn, false, 'Create Account');
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
