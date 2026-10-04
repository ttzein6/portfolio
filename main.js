(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero background: live size label on the portrait ---------- */
  const portrait = $('.hero__portrait');
  const portraitImg = $('img', portrait);
  new ResizeObserver(() => {
    const w = Math.round(portraitImg.getBoundingClientRect().width);
    portrait.dataset.size = `${w} \u00d7 ${w}`;
  }).observe(portraitImg);

  /* ---------- Hero letters: AnimateZWidget's flip / rotate / scale ---------- */
  const name = $('.hero__name');
  const letters = $$('.w', name);
  const effects = ['is-anim-flip', 'is-anim-rotate', 'is-anim-scale'];

  letters.forEach((el, i) => {
    el.dataset.effect = effects[i % effects.length];
  });

  const play = (el) => {
    if (reducedMotion || el.classList.contains(el.dataset.effect)) return;
    el.classList.add(el.dataset.effect);
    // Apply Slow motion right away instead of waiting for the animationstart event
    if (timeDilation !== 1) el.getAnimations().forEach((a) => { a.playbackRate = 1 / timeDilation; });
    el.addEventListener('animationend', () => el.classList.remove(el.dataset.effect), { once: true });
  };

  name.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.w');
    if (el) play(el);
  });

  /* Wave: every letter jumps and flips / tilts / squashes in turn.
     Runs on page load and on every hot reload. */
  let waveTimers = [];
  let timeDilation = 1; // raised by the Slow motion tool
  const wave = () => {
    if (reducedMotion) return;
    waveTimers.forEach(clearTimeout);
    waveTimers = letters.map((el, i) => setTimeout(() => play(el), i * 90 * timeDilation));
  };

  // Start once the display font is in (at most 800ms) so letters don't swap typeface mid-jump
  const fontReady = document.fonts
    ? document.fonts.load('800 1em "Bricolage Grotesque"')
    : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 800))])
    .catch(() => {})
    .then(() => {
      setTimeout(wave, 250);
      startLoop();
    });

  /* Loop the wave every few seconds, but only while the name is on screen,
     the tab is visible and the cursor isn't already playing with the letters */
  const WAVE_EVERY = 6000;
  let nameOnScreen = true;
  let pointerOnName = false;
  name.addEventListener('pointerenter', () => { pointerOnName = true; });
  name.addEventListener('pointerleave', () => { pointerOnName = false; });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { nameOnScreen = entry.isIntersecting; }).observe(name);
  }
  function startLoop() {
    if (reducedMotion) return;
    setInterval(() => {
      if (nameOnScreen && !pointerOnName && !document.hidden) wave();
    }, WAVE_EVERY);
  }

  /* ---------- Toast ---------- */
  const toast = $('.toast');
  let toastTimer;
  const showToast = (text, ms = 2600) => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), ms);
  };

  /* ---------- Hot reload (press r) ---------- */
  const hotReload = () => {
    const t0 = performance.now();
    document.body.classList.remove('is-reloading');
    void document.body.offsetWidth;
    document.body.classList.add('is-reloading');
    setTimeout(() => document.body.classList.remove('is-reloading'), 700);
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    wave();
    const ms = Math.round(performance.now() - t0 + 120 + Math.random() * 120);
    showToast(`Performing hot reload...\nReloaded 1 of 1 libraries in ${ms}ms.`);
  };

  $('.reload').addEventListener('click', hotReload);

  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
    if (document.documentElement.classList.contains('is-dev')) return; // the terminal owns the keyboard
    const shortcuts = { r: hotReload, p: () => debugBtn.click(), s: () => slowBtn.click(), f: () => perfBtn.click(), t: () => termBtn.click() };
    shortcuts[e.key]?.();
  });

  /* ---------- Debug paint (debugPaintSizeEnabled) ---------- */
  const debugBtn = $('.debug-toggle');
  debugBtn.addEventListener('click', () => {
    const on = document.documentElement.classList.toggle('debug-paint');
    debugBtn.setAttribute('aria-pressed', String(on));
    showToast(`debugPaintSizeEnabled = ${on}`, 1600);
  });

  /* ---------- Slow motion (timeDilation) ---------- */
  const SLOW = 5;
  const slowBtn = $('.slow-toggle');
  const dilate = (el) => el.getAnimations?.().forEach((a) => { a.playbackRate = 1 / timeDilation; });
  // New animations and transitions start at normal speed, so slow each one as it begins
  ['animationstart', 'transitionrun'].forEach((type) =>
    document.addEventListener(type, (e) => { if (timeDilation !== 1) dilate(e.target); }, true));
  slowBtn.addEventListener('click', () => {
    timeDilation = timeDilation === 1 ? SLOW : 1;
    const on = timeDilation !== 1;
    document.getAnimations().forEach((a) => { a.playbackRate = 1 / timeDilation; });
    slowBtn.setAttribute('aria-pressed', String(on));
    showToast(`timeDilation = ${timeDilation.toFixed(1)}`, 1600);
    if (on) wave();
  });

  /* ---------- Performance overlay (showPerformanceOverlay) ---------- */
  const perfBtn = $('.perf-toggle');
  const perf = $('.perf');
  const canvas = $('.perf__graph');
  const stats = $('.perf__stats');
  const ctx = canvas.getContext('2d');
  const FRAMES = 120;
  const BUDGET = 1000 / 60;
  const SCALE_MS = BUDGET * 3;
  const frames = [];
  let perfRaf = 0;
  let lastFrame = 0;
  let lastStats = 0;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = 240 * dpr;
  canvas.height = 72 * dpr;
  ctx.scale(dpr, dpr);

  const drawPerf = (now) => {
    if (lastFrame) {
      frames.push(now - lastFrame);
      if (frames.length > FRAMES) frames.shift();
    }
    lastFrame = now;

    ctx.clearRect(0, 0, 240, 72);
    const barW = 240 / FRAMES;
    frames.forEach((dt, i) => {
      const h = Math.min(dt / SCALE_MS, 1) * 72;
      ctx.fillStyle = dt <= BUDGET * 1.15 ? '#2BC48A' : dt <= BUDGET * 2 ? '#FFB020' : '#FF6B6B';
      ctx.fillRect(i * barW, 72 - h, Math.max(barW - .5, 1), h);
    });
    // The 16.7ms line: frames above it missed 60fps
    const budgetY = 72 - (BUDGET / SCALE_MS) * 72;
    ctx.fillStyle = 'rgba(230, 237, 245, .55)';
    ctx.fillRect(0, budgetY, 240, 1);

    if (now - lastStats > 250 && frames.length) {
      lastStats = now;
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      const worst = Math.max(...frames);
      const janky = frames.filter((dt) => dt > BUDGET * 1.15).length;
      stats.textContent = `${Math.round(1000 / avg)} fps   avg ${avg.toFixed(1)}ms   worst ${worst.toFixed(1)}ms\n${janky} of ${frames.length} frames over budget`;
    }
    perfRaf = requestAnimationFrame(drawPerf);
  };

  perfBtn.addEventListener('click', () => {
    const on = !perf.classList.contains('is-on');
    perf.classList.toggle('is-on', on);
    perfBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      frames.length = 0;
      lastFrame = 0;
      perfRaf = requestAnimationFrame(drawPerf);
    } else {
      cancelAnimationFrame(perfRaf); // no work at all while it's hidden
    }
    showToast(`showPerformanceOverlay = ${on}`, 1600);
  });

  /* ---------- Terminal shortcut ---------- */
  const termBtn = $('.term-open');
  termBtn.addEventListener('click', () => $('.mode__btn[data-mode="dev"]').click());

  /* ---------- Project filters ---------- */
  const chips = $$('.chip');
  const projects = $$('.proj');
  const empty = $('.projects__empty');

  chips.forEach((chip) => chip.addEventListener('click', () => {
    const tag = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    let shown = 0;
    projects.forEach((p) => {
      const match = tag === 'all' || p.dataset.tags.split(' ').includes(tag);
      const wasHidden = p.hidden;
      p.hidden = !match;
      if (match) {
        shown++;
        if (wasHidden && !reducedMotion) {
          p.classList.remove('is-entering');
          void p.offsetWidth;
          p.classList.add('is-entering');
        }
      }
    });
    empty.hidden = shown > 0;
  }));

  /* ---------- Copy email ---------- */
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Press Ctrl+C';
      const range = document.createRange();
      range.selectNodeContents($('.email__addr'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  }));

  /* ---------- Contact form: compose a mailto ---------- */
  const form = $('.form');
  const error = $('.form__error');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();

    const missing = [];
    form.elements.name.setAttribute('aria-invalid', String(!name));
    form.elements.message.setAttribute('aria-invalid', String(!message));
    if (!name) missing.push('your name');
    if (!message) missing.push('a message');
    if (missing.length) {
      error.textContent = `Add ${missing.join(' and ')} before writing the email.`;
      error.hidden = false;
      (name ? form.elements.message : form.elements.name).focus();
      return;
    }
    error.hidden = true;

    const subject = `Hello from ${name}`;
    const body = `${message}\n\n${name}${email ? `\n${email}` : ''}`;
    window.location.href = `mailto:ttzein6@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  /* ---------- Footer year ---------- */
  $('[data-year]').textContent = new Date().getFullYear();
})();
