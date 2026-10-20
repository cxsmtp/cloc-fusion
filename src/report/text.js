// The console summary and the Markdown report.
import { num, status, modelName } from './format.js';

function creditsLine(report) {
  const c = report.credits;
  if (!c.known) return `Fusion credits: not priced — set "creditsPer10k" for your Fusion model(s) (10K-unit scans: ${num(report.totals.unitScans)})`;
  const extra = c.settings.extraPercent ? ` + ${num(c.settings.extraPercent, 2)}% extra = ${num(c.total, 1)}` : '';
  return `Fusion credits over ${report.settings.fusion.periodMonths} months: ${num(c.base, 1)}${extra} → ${num(c.bundles)} bundle(s) of ${num(c.settings.bundleCredits)}`;
}

function pad(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  return rows.map((r) => r.map((v, i) => (i === 0 ? String(v).padEnd(widths[i]) : String(v).padStart(widths[i]))).join('  ')).join('\n');
}

export function consoleSummary(report, { top = 15 } = {}) {
  const t = report.totals;
  const k = report.counts;
  const out = [];
  out.push('');
  out.push(`Repositories: ${num(k.discovered)} found, ${num(k.measured)} measured, ${num(k.skipped)} skipped, ${num(k.failed)} failed`);
  out.push(`Lines of code: ${num(t.lines)} in ${num(t.repos)} repositories (${num(t.units)} × 10K units)`);
  out.push(`Commits in the window: ${num(t.commits)}`);
  if (report.developers) out.push(`Contributing developers, last 90 days: ${num(report.developers.total)} (unique, bots excluded)`);
  out.push(`Suggested Fusion scans over ${report.settings.fusion.periodMonths} months: ${num(t.scans)} (${num(t.unitScans)} 10K-unit scans)`);
  out.push(creditsLine(report));
  out.push('');
  const freq = report.byFrequency.filter((f) => f.repos);
  if (freq.length) {
    out.push(pad([['Change frequency', 'Repos', 'LOC', 'Scans', 'Credits'], ...freq.map((f) => [f.label, num(f.repos), num(f.lines), num(f.scans), report.credits.known ? num(f.credits, 1) : '—'])]));
    out.push('');
  }
  const rows = report.repos.filter((r) => r.included && r.units).slice(0, top);
  if (rows.length) {
    out.push(`Busiest ${rows.length} repositories:`);
    out.push(pad([['Repository', 'LOC', 'Commits/wk', 'Scans', 'Credits'], ...rows.map((r) => [r.fullName.length > 50 ? '…' + r.fullName.slice(-49) : r.fullName, num(r.lines), num(r.commitsPerWeek, 1), num(r.scans), r.credits === null ? '—' : num(r.credits, 1)])]));
  }
  return out.join('\n');
}

const md = (s) =>
  String(s ?? '')
    .replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])
    .replace(/[|\\[\]*_`]/g, (c) => `\\${c}`)
    .replace(/[\r\n]+/g, ' ');

export function toMarkdown(report) {
  const t = report.totals;
  const k = report.counts;
  const f = report.settings.fusion;
  const L = [];
  L.push('# Fusion scan sizing report', '');
  L.push(`Generated ${report.generatedAt} by cloc-fusion ${report.version}. Commit window: ${report.settings.windowDays} days; projection: ${f.periodMonths} months.`, '');
  L.push('## Summary', '');
  L.push('| | |', '|---|---|');
  L.push(`| Repositories found / measured | ${num(k.discovered)} / ${num(k.measured)} (${num(k.skipped)} skipped, ${num(k.failed)} failed) |`);
  L.push(`| Lines of code | ${num(t.lines)} (${num(t.units)} × 10K units) |`);
  L.push(`| Commits in window | ${num(t.commits)} |`);
  if (report.developers) L.push(`| Contributing developers (90 days) | ${num(report.developers.total)} |`);
  L.push(`| Suggested Fusion scans | ${num(t.scans)} (${num(t.unitScans)} 10K-unit scans) |`);
  L.push(`| ${report.credits.known ? 'Fusion credits' : 'Fusion credits (not priced)'} | ${report.credits.known ? `${num(report.credits.total, 1)} → ${num(report.credits.bundles)} bundle(s)` : 'set credits per 10K LOC'} |`, '');
  L.push('## By change frequency', '');
  L.push('| Change frequency | Repos | LOC | Fusion scans each | Total scans | Credits |', '|---|--:|--:|--:|--:|--:|');
  for (const b of report.byFrequency) if (b.repos) L.push(`| ${b.label} | ${num(b.repos)} | ${num(b.lines)} | ${num(f.byFrequency[b.id]?.scans)} | ${num(b.scans)} | ${report.credits.known ? num(b.credits, 1) : '—'} |`);
  L.push('', '## By organization', '');
  L.push('| Connection | Organization | Repos | Measured | LOC | Commits | Devs (90 d) | Scans | Credits |', '|---|---|--:|--:|--:|--:|--:|--:|--:|');
  for (const o of report.byOrg) L.push(`| ${md(o.connection)} | ${md(o.org)} | ${num(o.repos)} | ${num(o.counted)} | ${num(o.lines)} | ${num(o.commits)} | ${num(o.devs90)} | ${num(o.scans)} | ${report.credits.known ? num(o.credits, 1) : '—'} |`);
  L.push('', '## Repositories', '');
  L.push('| Repository | Language | LOC | Commits | Commits/wk | Devs (90 d) | Frequency | Scans | Model | Credits | Status |', '|---|---|--:|--:|--:|--:|---|--:|---|--:|---|');
  for (const r of report.repos) {
    L.push(`| ${md(r.fullName)} | ${md(r.mainLanguage || '')} | ${num(r.lines ?? r.loc)} | ${num(r.commits)} | ${num(r.commitsPerWeek, 1)} | ${num(r.devs90)} | ${md(r.frequencyLabel || '')} | ${r.included ? num(r.scans) : ''} | ${r.included ? md(modelName(report, r.model)) : ''} | ${r.included && r.credits !== null ? num(r.credits, 1) : ''} | ${md(status(r))} |`);
  }
  if (report.problems?.length) {
    L.push('', '## Problems', '');
    for (const p of report.problems) L.push(`- ${md(p.connection)}${p.org ? ` / ${md(p.org)}` : ''}: ${md(p.error)}`);
  }
  return L.join('\n') + '\n';
}
