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
      rain();
    });

  /* ---------- Bio rain: letters fall into place behind a lightning storm ---------- */
  const lede = $('.hero__lede');
  const ledeHTML = lede.innerHTML;
  const hero = $('.hero');
  const storm = $('.hero-bg__storm');
  const sctx = storm.getContext('2d');
  let rainPending = false;
  let rainRun = 0; // bumped on every run so a restarted rain cancels the old one
  hero.addEventListener('animationend', (e) => {
    if (e.animationName === 'thunder') hero.classList.remove('is-thunder');
  });

  // Wrap every letter in a span, and every word in a nowrap span so words never break mid-rain
  const splitInto = (from, to) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { to.append(' '); return; }
          const word = document.createElement('span');
          word.className = 'rw';
          [...part].forEach((ch) => {
            const c = document.createElement('span');
            c.className = 'rc';
            c.textContent = ch;
            word.append(c);
          });
          to.append(word);
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const copy = node.cloneNode(false);
        splitInto(node, copy);
        to.append(copy);
      }
    });
  };

  const prepareRain = () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = ledeHTML;
    const letters = document.createElement('span');
    letters.setAttribute('aria-hidden', 'true');
    splitInto(tmp, letters);
    const text = document.createElement('span');
    text.className = 'sr-only';
    text.textContent = tmp.textContent.replace(/\s+/g, ' ').trim();
    lede.replaceChildren(text, letters);
    lede.classList.add('is-waiting');
    lede.classList.remove('is-raining');
    document.documentElement.classList.remove('rain-pending');
    rainPending = true;
  };

  const drawStorm = (run) => {
    const box = storm.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = box.width, H = box.height;
    storm.width = Math.round(W * dpr);
    storm.height = Math.round(H * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = matchMedia('(prefers-color-scheme: dark)').matches
      ? document.documentElement.dataset.theme !== 'light'
      : document.documentElement.dataset.theme === 'dark';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0175C2';

    const drops = Array.from({ length: Math.round(W / 9) }, () => ({
      x: Math.random() * W * 1.2,
      y: Math.random() * -H,
      len: 14 + Math.random() * 22,
      v: 900 + Math.random() * 700,
    }));

    // A jagged bolt from the top right with one or two forks
    const bolt = [];
    const fork = (x, y, endY, spread) => {
      const pts = [[x, y]];
      while (y < endY) {
        y += 18 + Math.random() * 26;
        x += (Math.random() - .5) * spread;
        pts.push([x, y]);
        if (bolt.length < 3 && Math.random() < .12) fork(x, y, y + H * .2, spread * .8);
      }
      bolt.push(pts);
    };
    fork(W * (.62 + Math.random() * .25), 0, H * (.55 + Math.random() * .15), 46);

    // Two flashes 240ms apart (well under three per second)
    const flashAt = [380, 620];
    const END = 4000;
    const intensity = (t) => Math.min(1, t / 450) * Math.max(0, Math.min(1, (END - t) / 1200));
    const flash = (t) => flashAt.reduce((m, f) => Math.max(m, t < f ? 0 : Math.exp(-(t - f) / 90)), 0);

    let t = 0;
    let last = performance.now();
    const frame = (now) => {
      t += (now - last) / timeDilation;
      last = now;
      const k = intensity(t);
      const fl = flash(t);
      sctx.clearRect(0, 0, W, H);

      // The sky darkens while it rains
      sctx.fillStyle = dark ? `rgba(0, 0, 0, ${.35 * k})` : `rgba(12, 27, 51, ${.16 * k})`;
      sctx.fillRect(0, 0, W, H);
      if (fl > .01) {
        sctx.fillStyle = `rgba(255, 255, 255, ${(dark ? .22 : .5) * fl})`;
        sctx.fillRect(0, 0, W, H);
      }

      // Rain streaks, slanted a little by the wind
      sctx.strokeStyle = accent;
      sctx.globalAlpha = (dark ? .55 : .4) * k;
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      drops.forEach((d) => {
        d.y += d.v * (1 / 60);
        d.x -= d.v * (1 / 60) * .18;
        if (d.y > H) { d.y = -d.len; d.x = Math.random() * W * 1.2; }
        sctx.moveTo(d.x, d.y);
        sctx.lineTo(d.x + d.len * .18, d.y - d.len);
      });
      sctx.stroke();
      sctx.globalAlpha = 1;

      // The bolt glows with the flash and leaves a short afterimage
      const glow = Math.max(fl, t > flashAt[0] && t < flashAt[1] + 380 ? .25 : 0);
      if (glow > .02) {
        sctx.save();
        sctx.lineJoin = 'round';
        sctx.shadowColor = dark ? '#3FC4FF' : '#13B9FD';
        sctx.shadowBlur = 24;
        sctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, glow * 1.4)})`;
        bolt.forEach((pts, i) => {
          sctx.lineWidth = i === bolt.length - 1 ? 3 : 1.5;
          sctx.beginPath();
          pts.forEach(([x, y], j) => (j ? sctx.lineTo(x, y) : sctx.moveTo(x, y)));
          sctx.stroke();
        });
        sctx.restore();
      }

      if (run !== rainRun) return;
      if (t < END) requestAnimationFrame(frame);
      else sctx.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  };

  const startRain = () => {
    if (!rainPending) return;
    rainPending = false;
    const run = rainRun;
    const chars = $$('.rc', lede);
    const n = chars.length;
    const fall = Math.max(window.innerHeight * .32, 220);
    chars.forEach((c, i) => {
      c.style.setProperty('--delay', `${600 + (i / n) * 1600 + Math.random() * 600}ms`);
      c.style.setProperty('--dur', `${950 + Math.random() * 400}ms`);
      c.style.setProperty('--dy', `${-(fall + Math.random() * 160)}px`);
      c.style.setProperty('--dx', `${(Math.random() - .3) * 40}px`);
    });
    // Put the plain text back once every letter has landed, so kerning and selection are normal again
    let landed = 0;
    const onEnd = (e) => {
      if (run !== rainRun) { lede.removeEventListener('animationend', onEnd); return; }
      if (!e.target.classList.contains('rc') || ++landed < n) return;
      lede.removeEventListener('animationend', onEnd);
      lede.innerHTML = ledeHTML;
      lede.classList.remove('is-raining');
    };
    lede.addEventListener('animationend', onEnd);
    lede.classList.remove('is-waiting');
    lede.classList.add('is-raining');

    drawStorm(run);
    setTimeout(() => {
      hero.classList.remove('is-thunder');
      void hero.offsetWidth;
      hero.classList.add('is-thunder');
    }, 850 * timeDilation);
  };

  // Rain once the bio scrolls into view (it can start below the fold on phones)
  const rain = () => {
    if (reducedMotion) return;
    rainRun++;
    prepareRain();
    if (!('IntersectionObserver' in window)) { startRain(); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      startRain();
    }, { threshold: .4 });
    io.observe(lede);
  };

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
    rain();
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
