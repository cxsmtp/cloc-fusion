import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { toCsv, toContributorsCsv } from './csv.js';
import { toHtml } from './html.js';
import { toMarkdown, consoleSummary } from './text.js';

export { consoleSummary };

export const FORMATS = ['html', 'csv', 'json', 'md'];

/** Write the report in each format; returns the paths written. */
export async function writeReports(report, outDir, formats = FORMATS, base = 'cloc-fusion-report') {
  await mkdir(outDir, { recursive: true });
  const written = [];
  const put = async (ext, text) => {
    const p = join(outDir, `${base}.${ext}`);
    await writeFile(p, text);
    written.push(p);
  };
  for (const f of formats) {
    if (f === 'json') await put('json', JSON.stringify(report, null, 2));
    else if (f === 'csv') {
      await put('csv', toCsv(report));
      if (report.contributors) {
        const p = join(outDir, `${base.replace(/-report$/, '')}-contributors.csv`);
        await writeFile(p, toContributorsCsv(report));
        written.push(p);
      }
    }
    else if (f === 'html') await put('html', toHtml(report));
    else if (f === 'md') await put('md', toMarkdown(report));
    else throw new Error(`unknown format "${f}" (expected ${FORMATS.join(', ')})`);
  }
  return written;
}
