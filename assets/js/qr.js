/* ============================================================
   CSC APARTMENTS — self-contained QR encoder (byte mode, ECC L)
   No dependency, no network. Renders SVG + exports PNG.
   ============================================================ */
(function () {
  'use strict';

  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const ECPB  = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  const BLOCKS= [1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
  const ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]];

  function genPoly(deg) {
    let p = [1];
    for (let i = 0; i < deg; i++) {
      const n = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++) { n[j] ^= p[j]; n[j + 1] ^= mul(p[j], EXP[i]); }
      p = n;
    }
    return p;
  }
  function rsEncode(data, ecLen) {
    const gen = genPoly(ecLen), res = new Array(ecLen).fill(0);
    for (const d of data) {
      const f = d ^ res[0];
      res.shift(); res.push(0);
      if (f !== 0) for (let j = 0; j < ecLen; j++) res[j] ^= mul(gen[j + 1], f);
    }
    return res;
  }
  function fmtBits(mask) {
    const data = (1 << 3) | mask;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    return ((data << 10) | rem) ^ 0x5412;
  }
  function verBits(v) {
    let rem = v << 12;
    for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    return (v << 12) | rem;
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function penalty(m, n) {
    let p = 0;
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (m[r][c] === m[r - 1][c]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
    }
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  function build(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let version = 0;
    for (let v = 1; v <= 10; v++) {
      const cap = TOTAL[v - 1] - ECPB[v - 1] * BLOCKS[v - 1];
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) { version = v; break; }
    }
    if (!version) throw new Error('Text is too long for a QR code.');

    const nb = BLOCKS[version - 1], ecLen = ECPB[version - 1];
    const totalData = TOTAL[version - 1] - ecLen * nb;

    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const capBits = totalData * 8;
    for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    const pads = [0xec, 0x11];
    let pi = 0;
    while (cw.length < totalData) cw.push(pads[pi++ % 2]);

    const shortLen = Math.floor(totalData / nb), numLong = totalData % nb;
    const dBlocks = [], eBlocks = [];
    let off = 0;
    for (let b = 0; b < nb; b++) {
      const len = shortLen + (b >= nb - numLong ? 1 : 0);
      const d = cw.slice(off, off + len); off += len;
      dBlocks.push(d); eBlocks.push(rsEncode(d, ecLen));
    }
    const final = [];
    for (let i = 0; i < shortLen + 1; i++) dBlocks.forEach(d => { if (i < d.length) final.push(d[i]); });
    for (let i = 0; i < ecLen; i++) eBlocks.forEach(e => final.push(e[i]));

    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(0));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (r, c, v) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      m[r][c] = v ? 1 : 0; fn[r][c] = true;
    };

    const finder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        set(r, c, inRing);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (let i = 0; i < size; i++) {
      if (!fn[6][i]) set(6, i, i % 2 === 0);
      if (!fn[i][6]) set(i, 6, i % 2 === 0);
    }

    const ap = ALIGN[version - 1];
    for (const r of ap) for (const c of ap) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
        set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }

    for (let i = 0; i <= 8; i++) {
      if (i !== 6) { if (!fn[8][i]) set(8, i, 0); if (!fn[i][8]) set(i, 8, 0); }
    }
    for (let i = 0; i < 8; i++) {
      if (!fn[8][size - 1 - i]) set(8, size - 1 - i, 0);
      if (!fn[size - 1 - i][8]) set(size - 1 - i, 8, 0);
    }
    set(size - 8, 8, 1);

    if (version >= 7) {
      const vb = verBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = (vb >>> i) & 1, a = Math.floor(i / 3), b = i % 3;
        set(size - 11 + b, a, bit); set(a, size - 11 + b, bit);
      }
    }

    let bi = 0, up = true;
    const totalBits = final.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) {
        const row = up ? size - 1 - v : v;
        for (let j = 0; j < 2; j++) {
          const col = right - j;
          if (fn[row][col]) continue;
          m[row][col] = bi < totalBits ? ((final[bi >>> 3] >>> (7 - (bi & 7))) & 1) : 0;
          bi++;
        }
      }
      up = !up;
    }

    const placeFmt = (target, mask) => {
      const f = fmtBits(mask);
      for (let i = 0; i < 15; i++) {
        const bit = (f >>> i) & 1;
        if (i < 6) target[i][8] = bit;
        else if (i === 6) target[7][8] = bit;
        else if (i === 7) target[8][8] = bit;
        else if (i === 8) target[8][7] = bit;
        else target[8][14 - i] = bit;
        if (i < 8) target[8][size - 1 - i] = bit;
        else target[size - 15 + i][8] = bit;
      }
      target[size - 8][8] = 1;
    };

    let best = null, bestScore = Infinity;
    for (let k = 0; k < 8; k++) {
      const t = m.map(r => r.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
        if (!fn[r][c] && MASKS[k](r, c)) t[r][c] ^= 1;
      placeFmt(t, k);
      const s = penalty(t, size);
      if (s < bestScore) { bestScore = s; best = t; }
    }
    return { size, modules: best, version };
  }

  function svg(text, opts) {
    const o = Object.assign({ quiet: 4, dark: '#16233D', light: '#FFFFFF', scale: 8 }, opts || {});
    const q = build(text);
    const dim = (q.size + o.quiet * 2) * o.scale;
    let d = '';
    for (let r = 0; r < q.size; r++) {
      let c = 0;
      while (c < q.size) {
        if (q.modules[r][c]) {
          let len = 1;
          while (c + len < q.size && q.modules[r][c + len]) len++;
          d += `M${(c + o.quiet) * o.scale} ${(r + o.quiet) * o.scale}h${len * o.scale}v${o.scale}h-${len * o.scale}z`;
          c += len;
        } else c++;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges" role="img" aria-label="Referral QR code"><rect width="${dim}" height="${dim}" fill="${o.light}"/><path d="${d}" fill="${o.dark}"/></svg>`;
  }

  function downloadPNG(text, filename, size) {
    const px = size || 720;
    const markup = svg(text, { scale: 10 });
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      cv.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = filename || 'tranex-referral-qr.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); throw new Error('QR export failed.'); };
    img.src = url;
  }

  function downloadSVG(text, filename) {
    const blob = new Blob([svg(text)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'tranex-referral-qr.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  window.QR = { svg, downloadPNG, downloadSVG };
})();
