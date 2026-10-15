// The onboarding plan: Claude reads the sizing report and writes a phased plan for bringing every
// repository onto Fusion, within the credits the report works out. Optional: needs the Anthropic
// SDK (npm install @anthropic-ai/sdk) and an API key (ANTHROPIC_API_KEY, or `ant auth login`).
import { createHash } from 'node:crypto';

export const DEFAULT_MODEL = 'claude-opus-5-5';

const SYSTEM = `You are an application security programme lead planning the rollout of Checkmarx One Fusion (AI-driven code scanning) across an organisation's repositories.
You receive a sizing report produced by a tool that measured every repository: lines of code, commits on the default branch over a window, the change-frequency bucket derived from those commits, the Fusion scans suggested over the projection period, and the credits those scans cost.
Write a practical onboarding plan in Markdown for engineering and security leadership:
1. Executive summary: estate size, credits and bundles needed, the few numbers that matter.
2. Onboarding waves: which repositories go first and why (busy, large, business-critical by name), grouped into 3–4 waves with the credits each wave consumes. Name the repositories.
3. Credit budget: credits per month across the period, where the spend concentrates, and the levers to reduce it (scan frequency for slow-moving repos, excluding archived or dormant repos, model choice).
4. Risks and data gaps: failed or unmeasured repositories, repos with no commits in the window, anything that looks generated or vendored by its size, missing pricing.
5. Next steps, as a short checklist.
Base every number on the report; when you estimate, say so. Keep it under about 900 words, tables where they help.`;

function compact(report, { anonymize = false, top = 150 } = {}) {
  const alias = (s) => (anonymize ? `repo-${createHash('sha1').update(String(s)).digest('hex').slice(0, 8)}` : s);
  const orgAlias = (s) => (anonymize ? `org-${createHash('sha1').update(String(s)).digest('hex').slice(0, 6)}` : s);
  const rows = report.repos
    .filter((r) => r.analyzedAt || r.error)
    .slice(0, top)
    .map((r) => ({
      repo: alias(r.fullName),
      org: orgAlias(r.org),
      provider: r.provider,
      language: r.mainLanguage,
      loc: r.lines ?? r.loc ?? null,
      commits: r.commits ?? null,
      commitsPerWeek: r.commitsPerWeek ?? null,
      authors: r.authors ?? null,
      lastCommit: r.lastCommitAt?.slice(0, 10) ?? null,
      frequency: r.frequencyLabel,
      fusionScans: r.included ? r.scans : null,
      credits: r.included ? r.credits : null,
      status: r.error ? `failed: ${r.error}` : r.skip ? `skipped: ${r.skip}` : r.empty ? 'empty' : 'measured',
    }));
  return {
    generatedAt: report.generatedAt,
    windowDays: report.settings.windowDays,
    periodMonths: report.settings.fusion.periodMonths,
    models: report.settings.fusion.models,
    scansPerFrequency: Object.fromEntries(Object.entries(report.settings.fusion.byFrequency).map(([k, v]) => [k, v.scans])),
    counts: report.counts,
    totals: report.totals,
    credits: report.credits,
    byFrequency: report.byFrequency.filter((b) => b.repos),
    byOrg: report.byOrg.map((o) => ({ ...o, org: orgAlias(o.org) })),
    repositoriesShown: rows.length,
    repositoriesTotal: report.repos.length,
    repositories: rows,
  };
}

/** Ask Claude for the onboarding plan. Returns the Markdown text. */
export async function onboardingPlan(report, { model = DEFAULT_MODEL, anonymize = false, top = 150, effort = 'high', onText = null } = {}) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    throw new Error('the AI plan needs the Anthropic SDK: run "npm install @anthropic-ai/sdk" in the cloc-fusion folder');
  }
  const client = new Anthropic();
  const payload = compact(report, { anonymize, top });
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    // If a safety classifier declines, the API re-runs the request on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `Here is the sizing report as JSON:\n\n${JSON.stringify(payload)}\n\nWrite the onboarding plan.` }],
  });
  if (onText) stream.on('text', onText);
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error(`the model declined to write the plan${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ''}`);
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (message.stop_reason === 'max_tokens') return `${text}\n\n_(cut off at the output limit)_\n`;
  return text;
}
