(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const EMAIL = 'nishant.ism@gmail.com';

/* split headings into masked words */
$$('[data-split]').forEach(el => {
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w';
        const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
        w.appendChild(s); frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else walk(n);
  });
  walk(el);
});

/* reveals */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px', threshold: .1});
const armReveals = () => $$('[data-split],.fade').forEach(el => { if (!el.closest('.hero')) io.observe(el); });

/* smooth scroll */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({lerp: .09, wheelMultiplier: 1, smoothWheel: true});
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
const goTo = sel => { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) return; lenis ? lenis.scrollTo(el, {duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4)}) : el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); };
$$('a[data-link]').forEach(a => a.addEventListener('click', e => { const h = a.getAttribute('href'); if (h && h[0] === '#') { e.preventDefault(); goTo(h === '#hero' ? document.body : h); } }));

/* preloader, then hero entrance */
function heroIn() {
  $$('.hero [data-split], .hero .fade').forEach(el => el.classList.add('in'));
  armReveals();
}
const loader = $('#loader');
if (root.classList.contains('seen') || reduce) { loader && loader.remove(); heroIn(); }
else {
  const lc = $('#lc'), lb = $('#lb'), t0 = performance.now(), D = 1500;
  const step = now => {
    const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
    lc.textContent = String(Math.round(e * 100)).padStart(3, '0'); lb.style.setProperty('--p', e);
    if (p < 1) requestAnimationFrame(step);
    else (window.NSParticles ? NSParticles.ready : Promise.resolve()).then(() => { loader.classList.add('out'); setTimeout(heroIn, 350); setTimeout(() => loader.remove(), 1200); try { sessionStorage.setItem('ns-seen', 1); } catch (e) {} });
  };
  requestAnimationFrame(step);
}

/* particle scenes follow the section in the middle of the screen */
const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && window.NSParticles) NSParticles.setScene(e.target.dataset.scene); }), {rootMargin: '-50% 0px -50% 0px'});
$$('[data-scene]').forEach(s => sio.observe(s));
/* background colour follows the section in the middle of the screen */
const rs = document.documentElement.style;
const wio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { rs.setProperty('--w', e.target.dataset.wash); rs.setProperty('--ws', e.target.dataset.ws || '.2'); } }), {rootMargin: '-50% 0px -50% 0px'});
$$('[data-wash]').forEach(s => wio.observe(s));

/* header: hide on scroll down, show on scroll up; mark active link */
const top = $('#top'); let lastY = 0;
const onScroll = () => {
  const y = scrollY;
  top.classList.toggle('hide', y > lastY && y > 200);
  top.classList.toggle('solid', y > 40);
  lastY = y;
  const mid = innerHeight / 2;
  $$('.top nav a').forEach(a => { const s = $(a.getAttribute('href')); if (!s) return; const r = s.getBoundingClientRect(); let on = r.top < mid && r.bottom > mid; if (a.getAttribute('href') === '#work') on = on || $$('.chapter').some(c => { const q = c.getBoundingClientRect(); return q.top < mid && q.bottom > mid; }); a.classList.toggle('on', on); });
  const tl = $('#tl'), r = tl.getBoundingClientRect(), p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
  $('#tlProg').style.transform = `scaleY(${p})`;
  $$('#tl li').forEach(li => { const q = li.getBoundingClientRect(); li.classList.toggle('lit', q.top + q.height / 2 < mid); });
};
addEventListener('scroll', onScroll, {passive: true}); onScroll();

/* cursor, preview and magnetic buttons */
if (fine && !reduce) {
  root.classList.add('has-cursor');
  const cur = $('#cur'), ring = $('#ring'), prev = $('#preview');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, qx = x, qy = y;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, {passive: true});
  const loop = () => {
    rx += (x - rx) * .2; ry += (y - ry) * .2; qx += (x - qx) * .12; qy += (y - qy) * .12;
    cur.style.transform = `translate(${x}px,${y}px)`; ring.style.transform = `translate(${rx}px,${ry}px)`;
    prev.style.left = qx + 'px'; prev.style.top = qy + 'px';
    requestAnimationFrame(loop);
  }; loop();
  document.addEventListener('pointerover', e => {
    const v = e.target.closest('[data-cursor="view"]'), l = e.target.closest('a,button,input');
    ring.classList.toggle('view', !!v); ring.classList.toggle('link', !v && !!l);
  });
  $$('.row a').forEach(a => {
    a.addEventListener('mouseenter', () => { prev.classList.add('on'); $$('img', prev).forEach(i => i.classList.toggle('on', i.dataset.p === a.dataset.p)); });
    a.addEventListener('mouseleave', () => prev.classList.remove('on'));
  });
  $$('.mag').forEach(m => {
    m.addEventListener('pointermove', e => { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .28}px,${(e.clientY - r.top - r.height / 2) * .38}px)`; });
    m.addEventListener('pointerleave', () => { m.style.transform = ''; });
  });
  const hint = $('#hintMove'); let moved = 0;
  addEventListener('pointermove', () => { if (++moved > 60) hint.classList.add('gone'); }, {passive: true});
} else { const h = $('#hintMove'); if (h) { h.textContent = 'Touch the name'; let n = 0; addEventListener('touchmove', () => { if (++n > 25) h.classList.add('gone'); }, {passive: true}); } }

/* count-up stats */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const b = e.target, to = +b.dataset.count, sup = b.querySelector('sup'), supH = sup ? sup.outerHTML : '';
  if (reduce) return;
  const t0 = performance.now(), D = 1600;
  const step = now => { const p = Math.min(1, (now - t0) / D), v = Math.round(to * (1 - Math.pow(2, -10 * p))); b.innerHTML = (p < 1 ? v : to).toLocaleString('en-IN') + supH; if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), {threshold: .6});
$$('[data-count]').forEach(b => cio.observe(b));

/* clock */
const fmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false});
const tick = () => { $('#clock').textContent = fmt.format(new Date()) + ' IST'; }; tick(); setInterval(tick, 15000);
$('#yr').textContent = new Date().getFullYear();

/* live status from GitHub */
const rel = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago'; if (s < 86400) { const h = Math.round(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); } const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : d + ' days ago'; };
const dfmt = iso => new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
async function cached(url) {
  const key = 'ns:' + url;
  try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < 6e5) return c.v; } catch (e) {}
  const r = await fetch(url, {headers: {Accept: 'application/vnd.github+json'}}); if (!r.ok) throw new Error(r.status);
  const v = await r.json(); try { sessionStorage.setItem(key, JSON.stringify({t: Date.now(), v})); } catch (e) {} return v;
}
(async () => {
  try {
    const [repos, rel1] = await Promise.all([cached('https://api.github.com/users/nishants-lab/repos?per_page=100'), cached('https://api.github.com/repos/nishants-lab/airy/releases/latest').catch(() => null)]);
    const by = Object.fromEntries(repos.map(r => [r.name, r]));
    if (by.fairfund) $('#st-ff').textContent = 'updated ' + rel(by.fairfund.pushed_at);
    if (rel1 && rel1.tag_name) $('#st-airy').textContent = rel1.tag_name + ', ' + dfmt(rel1.published_at);
    if (by['health-dashboard-demo']) $('#st-health').textContent = 'updated ' + rel(by['health-dashboard-demo'].pushed_at);
    $('#logState').textContent = 'just now';
  } catch (e) { $('#logState').textContent = 'saved copy'; }
})();

/* FairFund fund count, read live from FairFund when available */
(async () => {
  try {
    const r = await fetch('https://nishants-lab.github.io/fairfund/', {cache: 'no-cache'}); if (!r.ok) return;
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const m = doc.body.textContent.match(/([\d,]+) funds in (\d+) categories/); if (!m) return;
    const f = $('#p-ff [data-count="1022"]'), c = $('#p-ff [data-count="20"]');
    f.dataset.count = m[1].replace(/,/g, ''); f.textContent = m[1]; c.dataset.count = m[2]; c.textContent = m[2];
  } catch (e) {}
})();

/* copy email */
async function copyMail() {
  let ok = true;
  try { await navigator.clipboard.writeText(EMAIL); } catch (e) { const t = document.createElement('textarea'); t.value = EMAIL; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); }
  const el = $('#toast'); el.textContent = ok ? 'Copied to clipboard' : 'Copy failed, select the address above'; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2200);
}
$('#copyMail').addEventListener('click', copyMail);

/* jump menu */
const cmds = [
  {l: 'About', h: 'Section', go: '#about'}, {l: 'FairFund', h: 'Section', go: '#p-ff'}, {l: 'Airy', h: 'Section', go: '#p-airy'}, {l: 'Health Dashboard', h: 'Section', go: '#p-health'},
  {l: 'Timeline', h: 'Section', go: '#timeline'}, {l: 'Contact', h: 'Section', go: '#contact'},
  {l: 'Open FairFund', h: 'Site', url: 'https://nishants-lab.github.io/fairfund/'}, {l: 'Open Airy', h: 'Site', url: 'https://nishants-lab.github.io/airy/'}, {l: 'Open the Health Dashboard demo', h: 'Site', url: 'https://nishants-lab.github.io/health-dashboard-demo/'},
  {l: 'Download Airy', h: 'GitHub', url: 'https://github.com/nishants-lab/airy/releases'}, {l: 'GitHub profile', h: 'GitHub', url: 'https://github.com/nishants-lab'}, {l: 'Follow on X', h: 'X', url: 'https://x.com/NishantSinha_1'}, {l: 'Follow on Instagram', h: 'Instagram', url: 'https://www.instagram.com/nishantsinha_1/'},
  {l: 'Copy email address', h: 'Action', run: copyMail}
];
const dlg = $('#k'), inp = $('#kInput'), list = $('#kList'); let shown = [], sel = 0;
function render() {
  const q = inp.value.trim().toLowerCase();
  shown = cmds.filter(c => !q || c.l.toLowerCase().includes(q) || c.h.toLowerCase().startsWith(q));
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  list.innerHTML = shown.length ? shown.map((c, i) => `<li role="option" id="k${i}" aria-selected="${i === sel}" class="${i === sel ? 'sel' : ''}" data-i="${i}"><span>${c.l}</span><small class="mono">${c.h}</small></li>`).join('') : '<li class="k-empty" aria-disabled="true">Nothing matches that.</li>';
  if (shown.length) inp.setAttribute('aria-activedescendant', 'k' + sel); else inp.removeAttribute('aria-activedescendant');
  const s = list.querySelector('.sel'); if (s) s.scrollIntoView({block: 'nearest'});
}
function run(c) { dlg.close(); if (!c) return; if (c.go) goTo(c.go); else if (c.url) location.href = c.url; else c.run(); }
function openK() { inp.value = ''; sel = 0; render(); dlg.showModal(); lenis && lenis.stop(); inp.focus(); }
dlg.addEventListener('close', () => lenis && lenis.start());
$('#kOpen').addEventListener('click', openK);
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : openK(); }
  else if (e.key === '/' && !dlg.open && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openK(); }
});
inp.addEventListener('input', () => { sel = 0; render(); });
inp.addEventListener('keydown', e => {
  if (!shown.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % shown.length; render(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; render(); }
  else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); }
});
list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) run(shown[+li.dataset.i]); });
list.addEventListener('mousemove', e => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); } });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();
