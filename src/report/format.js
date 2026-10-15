export const num = (n, digits = 0) =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const status = (r) => (r.error ? `failed: ${r.error}` : r.skip ? `skipped (${r.skip})` : r.empty ? 'empty' : r.analyzedAt ? 'measured' : 'not measured');

export const SCANS_FROM = { default: 'default', frequency: 'commit frequency', criticality: 'criticality', repo: 'repo override' };

export const modelName = (report, id) => {
  const m = report.settings?.fusion?.models?.find((x) => x.id === id);
  return m ? m.name || m.id : id || '';
};
