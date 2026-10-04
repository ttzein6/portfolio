(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    el.addEventListener('animationend', () => el.classList.remove(el.dataset.effect), { once: true });
  };

  name.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.w');
    if (el) play(el);
  });

  /* Wave: every letter jumps and flips / tilts / squashes in turn.
     Runs on page load and on every hot reload. */
  let waveTimers = [];
  const wave = () => {
    if (reducedMotion) return;
    waveTimers.forEach(clearTimeout);
    waveTimers = letters.map((el, i) => setTimeout(() => play(el), i * 90));
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
    if (e.key === 'r') hotReload();
    if (e.key === 'p') debugBtn.click();
  });

  /* ---------- Debug paint ---------- */
  const debugBtn = $('.debug-toggle');
  debugBtn.addEventListener('click', () => {
    const on = document.documentElement.classList.toggle('debug-paint');
    debugBtn.setAttribute('aria-pressed', String(on));
    showToast(on ? 'debugPaintSizeEnabled = true' : 'debugPaintSizeEnabled = false', 1600);
  });

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
