// The report object from measured repositories: change frequency, Fusion scans and credits, and
// the breakdowns. Pure (no Node APIs), so the CLI, the web app and the standalone HTML page share it.
import { VERSION } from '../version.js';
import { frequencyOf, frequencyLabel, fusionEstimate, creditSummary } from '../fusion.js';
import { globToRegExp } from '../languages.js';

/** The configuration as it may appear in reports: no secrets, only what identifies a connection. */
export function redactConfig(cfg) {
  return {
    ...cfg,
    connections: (cfg.connections || []).map((c) => ({
      name: c.name,
      provider: c.provider,
      apiUrl: c.apiUrl,
      orgs: c.orgs,
      authMethod: c.auth?.method,
    })),
  };
}

/** The configured overrides, compiled once: (repo) → the override settings that apply to it. */
export function overrideMatcher(cfg) {
  const rules = Object.entries(cfg.overrides || {}).map(([pattern, o]) => [globToRegExp(pattern), o]);
  return (repo) => {
    const out = {};
    for (const [re, o] of rules) if (re.test(repo.fullName) || re.test(`${repo.connection}:${repo.fullName}`)) Object.assign(out, o);
    return out;
  };
}

/** Frequency, Fusion scans and credits for measured repositories; the report object. */
export function buildReport(cfg, repos, problems = [], { started = Date.now(), partial = false } = {}) {
  const rows = repos.map((r) => {
    const measured = r.analyzedAt && !r.error;
    const windowDays = r.windowDays || cfg.windowDays;
    const f = frequencyOf(r.commits ?? 0, windowDays);
    return {
      ...r,
      frequency: measured ? f.id : null,
      frequencyLabel: measured ? frequencyLabel(f.id) : null,
      commitsPerWeek: measured ? Math.round(f.perWeek * 100) / 100 : null,
      commitsPerMonth: measured ? Math.round(((r.commits ?? 0) / windowDays) * 30.44 * 10) / 10 : null,
      included: measured && !r.skip,
    };
  });
  const estimate = fusionEstimate(rows, cfg.fusion);
  // Credits are known once every counted repository's model has a rate; until then, 10K-unit scans.
  const known = estimate.totals.units > 0 ? estimate.totals.unknownRate === 0 : true;
  const summary = { ...creditSummary(known ? estimate.totals.credits : NaN, cfg.totals), known };
  const measured = estimate.rows.filter((r) => r.analyzedAt && !r.error);
  const languages = Object.create(null);
  for (const r of measured) {
    for (const [name, t] of Object.entries(r.languages || {})) {
      const l = (languages[name] ||= { category: t.category, repos: 0, files: 0, code: 0, comment: 0, blank: 0 });
      l.repos++;
      l.files += t.files;
      l.code += t.code;
      l.comment += t.comment;
      l.blank += t.blank;
    }
  }
  return {
    tool: 'cloc-fusion',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    partial,
    durationSeconds: Math.round((Date.now() - started) / 1000),
    settings: {
      ...redactConfig(cfg),
      fusion: estimate.settings,
    },
    counts: {
      discovered: rows.length,
      skipped: rows.filter((r) => r.skip).length,
      measured: measured.length,
      failed: rows.filter((r) => r.error).length,
      empty: rows.filter((r) => r.empty).length,
    },
    totals: estimate.totals,
    credits: summary,
    byFrequency: estimate.byFrequency,
    byModel: estimate.byModel,
    byOrg: estimate.byOrg,
    languages,
    problems,
    repos: estimate.rows,
  };
}

/** Re-price an existing report with (new) settings, without measuring again. */
export function reprice(report, cfg) {
  let repos = report.repos;
  // New repository rules (criticality, scans, model, lines) apply without a rescan; skipping needs one.
  if (cfg.overrides) {
    const match = overrideMatcher(cfg);
    repos = repos.map((r) => {
      const o = match(r);
      return { ...r, criticality: o.criticality ?? null, scansOverride: o.scans ?? null, modelOverride: o.model ?? null, locOverride: o.loc ?? null };
    });
  }
  return buildReport({ ...report.settings, ...cfg, fusion: cfg.fusion ?? report.settings.fusion, totals: cfg.totals ?? report.settings.totals, overrides: cfg.overrides ?? report.settings.overrides }, repos, report.problems || []);
}
