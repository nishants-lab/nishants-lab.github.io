/* Particle field: custom WebGL points with spring physics on the CPU.
   Particles morph between shapes sampled from an offscreen canvas and get pushed by the cursor. */
(() => {
  const canvas = document.getElementById('gl');
  const root = document.documentElement;
  const gl = canvas.getContext('webgl', {antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance'});
  if (!gl) { root.classList.add('no-gl'); window.NSParticles = {setScene() {}, ready: Promise.resolve()}; return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VS = `attribute vec2 aPos;attribute float aAlpha;attribute float aSize;attribute float aTint;
    uniform vec2 uRes;uniform float uDpr;uniform vec3 uColor;varying float vA;varying vec3 vC;
    void main(){gl_Position=vec4(aPos.x/uRes.x*2.-1.,1.-aPos.y/uRes.y*2.,0.,1.);gl_PointSize=aSize*uDpr;vA=aAlpha;vC=mix(uColor,vec3(1.),aTint);}`;
  const FS = `precision mediump float;varying float vA;varying vec3 vC;
    void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.05,d);gl_FragColor=vec4(vC,a*vA);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { root.classList.add('no-gl'); window.NSParticles = {setScene() {}, ready: Promise.resolve()}; return; }
  gl.useProgram(prog);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  const loc = n => gl.getAttribLocation(prog, n), uni = n => gl.getUniformLocation(prog, n);
  const uRes = uni('uRes'), uDpr = uni('uDpr'), uColor = uni('uColor');

  let W = 0, H = 0, dpr = 1, N = 0, mobile = false;
  let px, py, vx, vy, k, ph, alpha, ta, size, tint, pos, sx, sy, sz;
  const T = {};
  const buf = {pos: gl.createBuffer(), alpha: gl.createBuffer(), size: gl.createBuffer(), tint: gl.createBuffer()};
  const bind = (b, name, n, data, usage) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); const l = loc(name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); };

  const COLORS = {name: [.93, .93, .95], ff: [.66, .55, .98], airy: [.48, .64, 1], health: [.29, .87, .5], sphere: [.8, .8, .86]};
  let scene = 'name', color = COLORS.name.slice();

  function alloc(n) {
    const old = px ? {px, py, vx, vy, alpha} : null, oldN = N;
    N = n;
    px = new Float32Array(N); py = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
    k = new Float32Array(N); ph = new Float32Array(N); alpha = new Float32Array(N); ta = new Float32Array(N);
    size = new Float32Array(N); tint = new Float32Array(N); pos = new Float32Array(N * 2);
    sx = new Float32Array(N); sy = new Float32Array(N); sz = new Float32Array(N);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      if (old && i < oldN) { px[i] = old.px[i]; py[i] = old.py[i]; vx[i] = old.vx[i]; vy[i] = old.vy[i]; alpha[i] = old.alpha[i]; }
      else { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.max(W, H) * .7; px[i] = W / 2 + Math.cos(a) * r; py[i] = H / 2 + Math.sin(a) * r; alpha[i] = 0; }
      k[i] = reduce ? 1 : .012 + Math.random() * .026;
      ph[i] = Math.random() * 6.283;
      size[i] = (mobile ? 1.4 : 1.5) + Math.random() * (mobile ? 1.3 : 1.7);
      tint[i] = Math.random() < .12 ? .55 : Math.random() * .22;
      const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
      sx[i] = Math.cos(th) * rr; sy[i] = y; sz[i] = Math.sin(th) * rr;
    }
    bind(buf.size, 'aSize', 1, size, gl.STATIC_DRAW);
    bind(buf.tint, 'aTint', 1, tint, gl.STATIC_DRAW);
  }

  /* draw a shape offscreen and turn its pixels into N target points */
  const off = document.createElement('canvas'), ox = off.getContext('2d', {willReadFrequently: true});
  function sample(draw, step) {
    off.width = W; off.height = H; ox.clearRect(0, 0, W, H); ox.fillStyle = ox.strokeStyle = '#fff'; ox.lineCap = ox.lineJoin = 'round';
    draw(ox);
    const d = ox.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 120) pts.push(x, y);
    const out = new Float32Array(N * 2), m = pts.length / 2;
    if (!m) return out;
    const order = new Uint32Array(m); for (let i = 0; i < m; i++) order[i] = i;
    for (let i = m - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    for (let i = 0; i < N; i++) { const p = order[i % m] * 2, j = i >= m ? step * .9 : 0; out[i * 2] = pts[p] + (Math.random() - .5) * (step * .6 + j); out[i * 2 + 1] = pts[p + 1] + (Math.random() - .5) * (step * .6 + j); }
    return out;
  }
  const font = (w, s) => `${w} ${s}px 'Clash Display', ui-sans-serif, system-ui, sans-serif`;
  function fitText(c, text, weight, maxW, maxH) {
    let s = 400; c.font = font(weight, s); if ('letterSpacing' in c) c.letterSpacing = (-0.02 * s) + 'px';
    const w = c.measureText(text).width; s = Math.min(s * maxW / w, maxH); c.font = font(weight, s); if ('letterSpacing' in c) c.letterSpacing = (-0.02 * s) + 'px';
    return s;
  }
  function box() { return mobile ? {cx: W / 2, cy: H * .3, w: W * .82, h: H * .26} : {cx: W * .73, cy: H * .5, w: Math.min(W * .38, 600), h: Math.min(H * .56, 460)}; }

  function build() {
    const st = mobile ? 3 : 2;
    T.name = sample(c => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (mobile) { const s = fitText(c, 'Nishant', 600, W * .84, H * .2); c.fillText('Nishant', W / 2, H * .21); c.fillText('Sinha', W / 2, H * .21 + s * .92); }
      else { fitText(c, 'Nishant Sinha', 600, W * .8, H * .34); c.fillText('Nishant Sinha', W / 2, H * .41); }
    }, st);
    const b = box();
    T.ff = sample(c => {
      const n = 9, gap = b.w / n, base = b.cy + b.h / 2, hs = [.22, .3, .27, .42, .38, .55, .5, .72, .9];
      c.lineWidth = mobile ? 2.5 : 2;
      hs.forEach((h, i) => { const x = b.cx - b.w / 2 + i * gap + gap * .18, bw = gap * .64, bh = b.h * h * .78; c.beginPath(); c.roundRect ? c.roundRect(x, base - bh, bw, bh, 4) : c.rect(x, base - bh, bw, bh); c.stroke(); c.globalAlpha = .55; c.fillRect(x + 4, base - bh + 4, bw - 8, bh - 8); c.globalAlpha = 1; });
      c.lineWidth = mobile ? 4 : 3.2; c.beginPath();
      hs.forEach((h, i) => { const x = b.cx - b.w / 2 + i * gap + gap / 2, y = base - b.h * h * .78 - b.h * .1; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      hs.forEach((h, i) => { const x = b.cx - b.w / 2 + i * gap + gap / 2, y = base - b.h * h * .78 - b.h * .1; c.beginPath(); c.arc(x, y, mobile ? 5 : 6, 0, 7); c.fill(); });
      c.fillRect(b.cx - b.w / 2, base + 10, b.w, 2);
    }, st);
    T.airy = sample(c => {
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      const s = fitText(c, '777', 600, b.w * .74, b.h * .8);
      const w1 = c.measureText('777').width, y = b.cy + s * .36;
      const x0 = b.cx - (w1 + s * .42) / 2;
      c.fillText('777', x0, y);
      c.font = font(500, s * .28); if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.fillText('MB', x0 + w1 + s * .06, y);
      c.lineWidth = 2; c.globalAlpha = .9; c.beginPath(); c.moveTo(x0, y + s * .16); c.lineTo(x0 + w1 * .38, y + s * .16); c.stroke();
    }, st);
    T.health = sample(c => {
      const x0 = b.cx - b.w / 2, y0 = b.cy, u = b.w / 100, a = b.h * .42;
      const pts = [[0,0],[12,0],[15,-.12],[18,0],[24,0],[26,.1],[29,-1],[32,.45],[34,0],[42,0],[46,-.22],[51,0],[56,0],[59,-.1],[62,0],[66,0],[68,.1],[71,-1],[74,.45],[76,0],[84,0],[88,-.22],[93,0],[100,0]];
      c.lineWidth = mobile ? 5 : 4.5; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x0 + x * u, y0 + y * a) : c.moveTo(x0 + x * u, y0 + y * a)); c.stroke();
      c.lineWidth = 1.5; c.globalAlpha = .7; for (let i = 0; i <= 10; i++) { c.fillRect(x0 + i * 10 * u, y0 + a * .8, 1.5, 6); }
      c.fillRect(x0, y0 + a * .8 + 6, b.w, 1.5);
    }, st);
  }

  let mx = -9999, my = -9999, mvx = 0, mvy = 0, lastMove = 0;
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mvx = e.clientX - (mx < -9000 ? e.clientX : mx); mvy = e.clientY - (my < -9000 ? e.clientY : my); mx = e.clientX; my = e.clientY; lastMove = performance.now(); }, {passive: true});
  document.addEventListener('pointerleave', () => { mx = my = -9999; });
  addEventListener('pointerdown', e => {
    const R = 260;
    for (let i = 0; i < N; i++) { const dx = px[i] - e.clientX, dy = py[i] - e.clientY, d = Math.hypot(dx, dy); if (d < R && d > .1) { const f = (1 - d / R) * 26; vx[i] += dx / d * f; vy[i] += dy / d * f; } }
  }, {passive: true});

  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2); mobile = W < 820;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(uRes, W, H); gl.uniform1f(uDpr, dpr);
    const n = Math.round(Math.min(16000, Math.max(5000, W * H / 80)));
    alloc(n); build();
  }

  let t0 = performance.now(), running = true, rot = 0;
  function frame(now) {
    if (!running) return;
    step(now);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    bind(buf.pos, 'aPos', 2, pos, gl.DYNAMIC_DRAW);
    bind(buf.alpha, 'aAlpha', 1, alpha, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, N);
    requestAnimationFrame(frame);
  }
  function step(now) {
    const t = (now - t0) / 1000, dim = (mobile && scene !== 'name') ? .38 : 1;
    for (let c = 0; c < 3; c++) color[c] += (COLORS[scene][c] - color[c]) * .05;
    gl.uniform3f(uColor, color[0], color[1], color[2]);
    const R = mobile ? 0 : 120, R2 = R * R, F = 6.5;
    mvx *= .9; mvy *= .9;
    rot += reduce ? 0 : .0022;
    const sphere = scene === 'sphere', tg = T[scene];
    const cr = Math.cos(rot), sr = Math.sin(rot), tilt = .38, ct = Math.cos(tilt), st = Math.sin(tilt);
    const scx = W / 2, scy = H / 2, sR = Math.min(W, H) * (mobile ? .4 : .36);
    const shimmer = reduce ? 0 : 1;
    for (let i = 0; i < N; i++) {
      let tx, ty, a;
      if (sphere) {
        const x1 = sx[i] * cr - sz[i] * sr, z1 = sx[i] * sr + sz[i] * cr;
        const y2 = sy[i] * ct - z1 * st, z2 = sy[i] * st + z1 * ct;
        tx = scx + x1 * sR; ty = scy + y2 * sR; a = (.14 + (z2 + 1) * .26) * dim;
      } else {
        tx = tg[i * 2] + Math.sin(t * 1.3 + ph[i]) * 1.1 * shimmer; ty = tg[i * 2 + 1] + Math.cos(t * 1.1 + ph[i]) * 1.1 * shimmer;
        a = Math.min(1, .72 + tint[i] * .7) * dim;
      }
      if (reduce) { px[i] = tx; py[i] = ty; }
      else {
        vx[i] = (vx[i] + (tx - px[i]) * k[i]) * .86; vy[i] = (vy[i] + (ty - py[i]) * k[i]) * .86;
        if (R) { const dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > .01) { const d = Math.sqrt(d2); let f = 1 - d / R; f *= f; vx[i] += dx / d * f * F + mvx * f * .35; vy[i] += dy / d * f * F + mvy * f * .35; } }
        px[i] += vx[i]; py[i] += vy[i];
      }
      alpha[i] += (a - alpha[i]) * .06;
      pos[i * 2] = px[i]; pos[i * 2 + 1] = py[i];
    }
  }
  document.addEventListener('visibilitychange', () => { const r = !document.hidden; if (r && !running) { running = true; requestAnimationFrame(frame); } else running = r; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

  const ready = (document.fonts ? Promise.race([document.fonts.load(font(600, 100)), new Promise(r => setTimeout(r, 3000))]) : Promise.resolve()).then(() => { resize(); requestAnimationFrame(frame); });
  window.NSParticles = {ready, setScene(s) { if (T[s] || s === 'sphere') scene = s; },
    settle(n = 240) { const now = performance.now(); for (let i = 0; i < n; i++) step(now + i * 16); }, get scene() { return scene; }};
})();
