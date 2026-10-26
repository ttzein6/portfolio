# tamerelzein.com

The source of my personal site: [tamerelzein.com](https://tamerelzein.com).

I'm Tamer El Zein, a builder and AI Lab Team Lead at Futurate. The site covers my work, the products I've shipped (Tadween, Visufit, Ma3ak, Graphics Atlas, the `animate_z_widget` Flutter package and more), the tools I use, and how to reach me.

## What's in it

The whole site is plain HTML, CSS and JavaScript. There is no framework, no bundler and no build step.

- **Preview mode.** The normal page: hero, work, education, shipped projects, toolbox and contact.
- **Dev mode.** A terminal that lets you browse the same content with `ls`, `cd`, `cat`, `open` and friends. It has tab completion and command history. Switch with the Preview / Dev toggle or press <kbd>t</kbd>. It reads its content straight from the page, so the two modes never drift apart.
- **For nerds.** Footer toggles borrowed from Flutter's debug tools:
  - <kbd>p</kbd> Debug paint, which outlines every box (like `debugPaintSizeEnabled`)
  - <kbd>s</kbd> Slow motion, which runs every animation 5x slower (like `timeDilation`)
  - <kbd>f</kbd> Performance, which shows frame times and FPS (like `showPerformanceOverlay`)
- The hero name animates letter by letter with the flip, rotate and scale effects from my `animate_z_widget` package.
- All motion respects `prefers-reduced-motion`.

## Layout

```
index.html        The page and all of its content
styles.css        All styles
main.js           Hero animations, mode switch and the "for nerds" toggles
terminal.js       Dev mode terminal
atlas-mark.js     Animated pen-plotter mark on the Graphics Atlas card
assets/           Portrait, app and skill logos, favicon and the CV PDF
cv/               Source of the CV and the script that renders it to PDF
```

## Run it locally

Any static file server works:

```bash
python3 -m http.server 8090
```

Then open http://localhost:8090.

## Rebuild the CV

The CV is written in HTML (`cv/cv.html`) and rendered to a tagged, text-based PDF with Playwright. The output goes to `assets/tamer-el-zein-cv.pdf`.

```bash
cd cv && npm install && npm run build
```

Set `CHROMIUM_PATH` to use a Chromium you already have instead of Playwright's download.

## Credits

- Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [Geist](https://vercel.com/font) (Geist license in `cv/fonts/LICENSE-Geist.txt`)
- Logos in `assets/skills/` belong to their respective owners

## License

The code is here for you to read and learn from. The content, my photo, the CV and the app artwork are mine, so please don't reuse them as your own.
