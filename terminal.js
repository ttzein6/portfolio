(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const slugify = (str) => str.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ---------- Content: read from the page, so both modes stay in sync ---------- */
  const firstText = (el) => clean({ textContent: el.childNodes[0]?.textContent || el.textContent });

  const projects = [
    ...$$('.ship').map((a) => ({
      name: firstText($('.ship__name', a)),
      where: clean($('.ship__where', a)),
      desc: clean($('.ship__desc', a)),
      url: a.href,
    })),
    ...$$('.proj').map((li) => {
      const link = $('a.proj__link', li);
      return {
        name: clean($('.proj__name', li)),
        where: li.dataset.tags.split(' ').join(', '),
        desc: clean($('.proj__desc', li)),
        url: link ? link.href : null,
      };
    }),
  ].map((p) => ({ ...p, slug: slugify(p.name) }));

  const readTimeline = (section) => $$(`${section} .job`).map((li) => ({
    when: clean($('.job__when', li)),
    role: clean($('.job__role', li)),
    org: clean($('.job__org', li)),
    desc: clean($('.job__desc', li)),
  }));
  const work = readTimeline('#work');
  const education = readTimeline('#education');

  const skills = $$('.tools').map((g) => ({
    group: clean($('.tools__group', g)),
    items: $$('li', g).map(clean),
  }));

  const email = clean($('.email__addr'));
  const socials = $$('.socials a').map((a) => ({ label: clean(a), url: a.href }));
  const cvUrl = $('a[href$=".pdf"]')?.href;
  const about = {
    name: 'Tamer El Zein',
    role: clean($('.hero__role')),
    lede: clean($('.hero__lede')),
    where: clean($('.hero__portrait figcaption')),
  };

  const links = {
    cv: cvUrl,
    email: `mailto:${email}`,
    ...Object.fromEntries(socials.map((s) => [slugify(s.label.startsWith('+') ? 'phone' : s.label), s.url])),
  };

  /* ---------- File system ---------- */
  const DIRS = ['projects', 'work', 'education', 'skills', 'contact'];
  const FILES = ['about.txt', 'cv.pdf'];
  let cwd = '~';

  /* ---------- DOM ---------- */
  const root = $('#terminal');
  const screen = $('.term__screen', root);
  const out = $('.term__out', root);
  const form = $('.term__line', root);
  const input = $('.term__input', root);
  const promptLabel = $('.term__prompt', root);
  const title = $('.term__title', root);

  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const span = (cls, text) => node('span', cls, text);
  const link = (url, text) => {
    const a = node('a', null, text || url.replace(/^(mailto:|tel:|https?:\/\/(www\.)?)/, '').replace(/\/$/, ''));
    a.href = url;
    if (/^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  };
  const line = (...parts) => {
    const p = node('p');
    parts.flat().forEach((x) => p.append(typeof x === 'string' ? document.createTextNode(x) : x));
    return p;
  };
  const block = (...children) => {
    const div = node('div', 't-block');
    children.flat().forEach((c) => c && div.append(c));
    out.append(div);
    return div;
  };
  const table = (rows) => {
    const t = node('div', 't-table');
    rows.forEach(([a, b]) => t.append(a instanceof Node ? a : span(null, a), b instanceof Node ? b : span(null, b)));
    return t;
  };
  const cmdButton = (cmd) => {
    const b = node('button', 't-cmd', cmd);
    b.type = 'button';
    b.addEventListener('click', () => run(cmd));
    return b;
  };
  const suggestions = (...cmds) => {
    const row = node('div', 't-cmds');
    cmds.forEach((c) => row.append(cmdButton(c)));
    return row;
  };
  const shownPath = () => (cwd === '~' ? '~' : `~/${cwd}`);
  const promptParts = () => [span('t-user', 'tamer@portfolio'), span('t-dim', ':'), span('t-path', shownPath()), span('t-dim', '$')];
  const renderPrompt = () => {
    promptLabel.replaceChildren(...promptParts());
    title.textContent = `tamer@portfolio: ${shownPath()}`;
  };
  const scrollDown = () => { screen.scrollTop = screen.scrollHeight; };

  /* ---------- Path helpers ---------- */
  const resolveDir = (arg) => {
    if (!arg || arg === '~' || arg === '/' || arg === '~/') return '~';
    if (arg === '..') return '~';
    if (arg === '.') return cwd;
    const name = arg.replace(/^~\//, '').replace(/\/$/, '');
    return DIRS.includes(name) ? name : null;
  };
  const findProject = (arg) => {
    const slug = slugify(arg.replace(/^(~\/)?projects\//, ''));
    return projects.find((p) => p.slug === slug) || projects.find((p) => p.slug.startsWith(slug));
  };

  /* ---------- Output for each directory ---------- */
  const listing = {
    '~': () => block(line(
      ...DIRS.map((d) => [span('t-dir', `${d}/`), '  ']),
      ...FILES.map((f) => [span(null, f), '  ']),
    )),
    projects: () => block(
      line(span('t-dim', `${projects.length} projects, newest first. Use `), span('t-ok', 'cat <name>'), span('t-dim', ' or '), span('t-ok', 'open <name>'), span('t-dim', '.')),
      table(projects.map((p) => [span('t-name', p.slug), `${p.where}. ${p.desc}`])),
    ),
    work: () => block(table(work.map((j) => [span('t-dim', j.when), line(span('t-name', j.role), ` at ${j.org}`, j.desc ? `\n${j.desc}` : '')]))),
    education: () => block(table(education.map((j) => [span('t-dim', j.when), line(span('t-name', j.role), `\n${j.org}`)]))),
    skills: () => block(...skills.map((g) => line(span('t-head', g.group), '\n  ', g.items.join(', ')))),
    contact: () => block(table([
      [span('t-name', 'email'), link(`mailto:${email}`, email)],
      ...socials.map((s) => [span('t-name', s.label.startsWith('+') ? 'phone' : s.label.toLowerCase()), link(s.url)]),
    ])),
  };

  const showProject = (p) => block(
    line(span('t-head', p.name), span('t-dim', `  (${p.where})`)),
    line(p.desc),
    p.url ? line(span('t-dim', 'link  '), link(p.url)) : line(span('t-dim', 'No public link.')),
    p.url ? suggestions(`open ${p.slug}`) : null,
  );

  const showAbout = () => block(
    line(span('t-head', about.name)),
    line(about.role),
    line(span('t-dim', about.where)),
    line('\u00a0'),
    line(about.lede),
  );

  /* ---------- Commands ---------- */
  const HELP = [
    ['help', 'Show this list'],
    ['whoami', 'Who I am, in short'],
    ['ls [dir]', 'List a directory: projects, work, education, skills, contact'],
    ['cd <dir>', 'Move into a directory. cd .. goes back'],
    ['cat <name>', 'Read a project or file, like cat tadween or cat about.txt'],
    ['open <name>', 'Open a project, cv, email, github, linkedin or x in a new tab'],
    ['contact', 'How to reach me'],
    ['pwd', 'Print the current directory'],
    ['history', 'Commands you have run'],
    ['clear', 'Clear the screen (or Ctrl+L)'],
    ['exit', 'Back to preview mode'],
  ];

  const history = [];
  let historyIndex = 0;

  const commands = {
    help: () => block(
      line(span('t-head', 'Commands')),
      table(HELP.map(([c, d]) => [span('t-ok', c), d])),
      line('\u00a0'),
      line(span('t-dim', 'Try one:')),
      suggestions('ls projects', 'cat tadween', 'ls skills', 'open cv', 'exit'),
      line(span('t-dim', 'Tab completes names. Up and down arrows walk through history.')),
    ),
    whoami: showAbout,
    about: showAbout,
    ls: (args) => {
      const target = args[0] ? resolveDir(args[0]) : cwd;
      if (target === null) {
        if (FILES.includes(args[0])) return block(line(args[0]));
        return block(line(span('t-err', `ls: ${args[0]}: no such directory`)));
      }
      return listing[target]();
    },
    cd: (args) => {
      const target = resolveDir(args[0]);
      if (target === null) return block(line(span('t-err', `cd: ${args[0]}: no such directory`)));
      cwd = target;
      renderPrompt();
      return null;
    },
    pwd: () => block(line(cwd === '~' ? '/home/tamer' : `/home/tamer/${cwd}`)),
    cat: (args) => {
      const arg = args.join(' ');
      if (!arg) return block(line(span('t-err', 'cat: tell me what to read, like cat tadween')));
      const file = arg.replace(/^~\//, '');
      if (file === 'about.txt' || file === 'about') return showAbout();
      if (file === 'cv.pdf' || file === 'cv') return block(line('cv.pdf is a PDF. '), suggestions('open cv'));
      if (DIRS.includes(file.replace(/\/$/, ''))) return block(line(span('t-err', `cat: ${file}: is a directory. Try ls ${file}`)));
      const p = findProject(arg);
      if (p) return showProject(p);
      return block(line(span('t-err', `cat: ${arg}: no such file. Try ls projects`)));
    },
    open: (args) => {
      const arg = (args[0] || '').toLowerCase();
      if (!arg) return block(line(span('t-err', 'open: tell me what to open, like open cv or open tadween')));
      const url = links[arg] || findProject(arg)?.url;
      if (!url) {
        const p = findProject(arg);
        if (p) return block(line(span('t-err', `open: ${p.name} has no public link`)));
        return block(line(span('t-err', `open: ${arg}: not found. Try ls projects`)));
      }
      window.open(url, /^https?:/.test(url) ? '_blank' : '_self', 'noopener');
      return block(line(span('t-ok', 'Opening '), link(url)));
    },
    contact: () => listing.contact(),
    history: () => block(...history.map((h, i) => line(span('t-dim', String(i + 1).padStart(3, ' ')), `  ${h}`))),
    clear: () => { out.replaceChildren(); return null; },
    exit: () => { setMode('preview'); return null; },
    preview: () => { setMode('preview'); return null; },
    sudo: () => block(line(span('t-err', 'Permission denied. Nice try, though.'))),
    echo: (args) => block(line(args.join(' '))),
  };

  const echoCommand = (raw) => block(line(...promptParts(), ' ', raw)).classList.add('t-echo');

  function run(raw) {
    const text = raw.trim();
    echoCommand(text);
    if (text) {
      history.push(text);
      historyIndex = history.length;
      const [name, ...args] = text.split(/\s+/);
      const fn = commands[name.toLowerCase()];
      if (fn) fn(args);
      else block(line(span('t-err', `command not found: ${name}`), span('t-dim', '. Type '), cmdButton('help'), span('t-dim', ' to see what you can do.')));
    }
    input.value = '';
    scrollDown();
    input.focus({ preventScroll: true });
  }

  /* ---------- Tab completion ---------- */
  const candidatesFor = (cmd) => {
    const slugs = projects.map((p) => p.slug);
    switch (cmd) {
      case 'ls': case 'cd': return DIRS;
      case 'cat': return [...FILES, ...slugs];
      case 'open': return [...Object.keys(links), ...projects.filter((p) => p.url).map((p) => p.slug)];
      default: return [];
    }
  };
  const complete = () => {
    const value = input.value;
    const parts = value.split(/\s+/);
    const isCommand = parts.length === 1;
    const word = parts[parts.length - 1].toLowerCase();
    const pool = isCommand ? Object.keys(commands).filter((c) => !['about', 'preview', 'sudo', 'echo'].includes(c)) : candidatesFor(parts[0].toLowerCase());
    const matches = pool.filter((c) => c.startsWith(word));
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0];
      input.value = parts.join(' ') + (isCommand ? ' ' : '');
    } else if (matches.length > 1) {
      echoCommand(value);
      block(line(matches.join('  ')));
      const common = matches.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
      parts[parts.length - 1] = common;
      input.value = parts.join(' ');
      scrollDown();
    }
  };

  /* ---------- Input events ---------- */
  form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) input.value = history[--historyIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); commands.clear(); }
  });
  // Clicking anywhere in the terminal focuses the prompt, unless you're selecting text or using a control
  screen.addEventListener('click', (e) => {
    if (e.target.closest('a, button') || getSelection().toString()) return;
    input.focus({ preventScroll: true });
  });

  /* ---------- Welcome ---------- */
  let welcomed = false;
  const welcome = () => {
    if (welcomed) return;
    welcomed = true;
    block(
      line(span('t-head', 'Tamer El Zein'), span('t-dim', '  '), about.role),
      line(span('t-dim', 'You are in dev mode: the same site, as a terminal.')),
      line(span('t-dim', 'Type '), span('t-ok', 'help'), span('t-dim', ' for the commands, or start here:')),
      suggestions('help', 'ls', 'ls projects', 'cat tadween', 'whoami', 'contact'),
    );
  };

  /* ---------- Mode switch ---------- */
  const html = document.documentElement;
  const buttons = $$('.mode__btn');

  function setMode(mode, { save = true, focus = true } = {}) {
    const dev = mode === 'dev';
    html.classList.toggle('is-dev', dev);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (save) { try { localStorage.setItem('mode', mode); } catch {} }
    if (dev) {
      welcome();
      renderPrompt();
      scrollDown();
      if (focus) input.focus({ preventScroll: true });
    }
  }

  /* ---------- Phones: keep the terminal above the on-screen keyboard ----------
     The keyboard overlays the page without resizing it, so size the terminal to the
     visual viewport (the part you can actually see) and keep the prompt scrolled in. */
  const vv = window.visualViewport;
  const syncViewport = () => {
    if (!vv) return;
    html.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
    html.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    if (html.classList.contains('is-dev')) scrollDown();
  };
  if (vv) {
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    syncViewport();
  }
  // The keyboard animates in after focus; scroll again once it has settled
  input.addEventListener('focus', () => {
    scrollDown();
    setTimeout(() => { syncViewport(); scrollDown(); }, 350);
  });

  buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  setMode(html.classList.contains('is-dev') ? 'dev' : 'preview', { save: false, focus: false });
})();
