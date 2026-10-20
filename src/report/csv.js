import { status, SCANS_FROM, modelName } from './format.js';

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote, and defuse spreadsheet formulas in text cells.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const CSV_COLUMNS = [
  ['Provider', (r) => r.provider],
  ['Connection', (r) => r.connection],
  ['Organization', (r) => r.org],
  ['Repository', (r) => r.fullName],
  ['URL', (r) => r.webUrl],
  ['Default branch', (r) => r.branch || r.defaultBranch],
  ['Main language', (r) => r.mainLanguage],
  ['Lines of code', (r) => r.lines ?? r.loc],
  ['Files counted', (r) => r.files],
  ['Code lines', (r) => r.code],
  ['Comment lines', (r) => r.comment],
  ['Blank lines', (r) => r.blank],
  ['Commits in window', (r) => r.commits],
  ['Window (days)', (r) => r.windowDays],
  ['Commits per week', (r) => r.commitsPerWeek],
  ['Commits per month', (r) => r.commitsPerMonth],
  ['Active authors', (r) => r.authors],
  ['Developers (90 days)', (r) => r.devs90],
  ['Last commit', (r) => r.lastCommitAt],
  ['Change frequency', (r) => r.frequencyLabel],
  ['Criticality', (r) => r.criticality],
  ['Suggested Fusion scans', (r) => (r.included ? r.scans : '')],
  ['Scans set by', (r) => (r.included ? SCANS_FROM[r.scansFrom] || r.scansFrom : '')],
  ['10K units', (r) => (r.included ? r.units : '')],
  ['Fusion model', (r, rep) => (r.included ? modelName(rep, r.model) : '')],
  ['Credits per 10K LOC', (r) => (r.included ? r.rate : '')],
  ['Fusion credits', (r) => (r.included ? r.credits : '')],
  ['Status', (r) => status(r)],
];

export function toCsv(report) {
  const lines = [CSV_COLUMNS.map(([h]) => cell(h)).join(',')];
  for (const r of report.repos) lines.push(CSV_COLUMNS.map(([, f]) => cell(f(r, report))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Everyone who committed in the last 90 days (people, then bots), with their repositories. */
export function toContributorsCsv(report) {
  const head = ['Name', 'Email', 'Type', 'Repositories', 'Commits (90 days)', 'Last commit', 'Repository list'];
  const lines = [head.map(cell).join(',')];
  for (const c of report.contributors || []) lines.push([c.name, c.email, c.bot ? 'Bot' : 'Developer', c.repos.length, c.commits, c.lastCommitAt, c.repos.join('; ')].map(cell).join(','));
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}
