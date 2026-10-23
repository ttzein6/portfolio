// Renders cv.html to ../assets/tamer-el-zein-cv.pdf as a tagged, text-based PDF.
// Usage: cd cv && npm install && npm run build
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'assets', 'tamer-el-zein-cv.pdf');

// Set CHROMIUM_PATH to use an existing Chromium instead of Playwright's download.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, 'cv.html')).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.evaluate(() => document.fonts.ready);
const pdf = await page.pdf({
  preferCSSPageSize: true,
  printBackground: true,
  tagged: true,
  outline: true,
});
await browser.close();

// Chromium only writes the title, so fill in the rest of the document properties.
const doc = await PDFDocument.load(pdf, { updateMetadata: false });
doc.setTitle('Tamer El Zein - CV', { showInWindowTitleBar: true });
doc.setAuthor('Tamer El Zein');
doc.setSubject('Curriculum vitae of Tamer El Zein, AI Lab Team Lead and Software Engineer');
doc.setKeywords(['Tamer El Zein', 'CV', 'Resume', 'AI Lab Team Lead', 'Software Engineer', 'Flutter', 'AI Agents', 'Multi-agent systems', 'Google ADK', 'Pydantic']);
doc.setLanguage('en');
doc.setCreator('cv/cv.html');
doc.setCreationDate(new Date());
doc.setModificationDate(new Date());
await writeFile(out, await doc.save({ useObjectStreams: false }));
console.log(`Wrote ${out}`);
