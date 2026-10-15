# cloc-fusion

Count the lines of code and the commit activity of **every repository in every organization** you
can reach on GitHub, GitLab, Azure DevOps, Bitbucket or any other Git server. From that, suggest how
often each repository should get a **Checkmarx One Fusion** scan and work out the **credits** that
takes. The credit arithmetic is the same as the Cx Credits Calculator's Fusion page.

Runs on Windows, macOS and Linux. It needs **Node.js 18+** and **git 2.31+**, and nothing else: no
npm dependencies, no Docker, no database.

```text
$ cloc-fusion init          # wizard: connect platforms, pick organizations, set Fusion pricing
$ cloc-fusion scan          # discover → clone → count LOC + commits → suggest scans → price → report
$ cloc-fusion ai-plan       # optional: Claude writes a phased onboarding plan from the report
```

## What you get

A report in HTML, CSV, JSON and Markdown, written to `./cloc-fusion-output/`:

| Column | Meaning |
|---|---|
| Repository, organization | Every repo found, across all connections and organizations |
| Lines of code | Code lines (no blanks or comments) in code, markup and IaC files. Dependencies, build output and generated files are excluded. |
| Commits in window | Non-merge commits on the default branch in the last 365 days (configurable), plus active authors and a 52-week activity spark line |
| Commits / week | Commits over the window (a repo younger than the window uses its own age) |
| Change frequency | Bucket from commit frequency, below |
| Suggested Fusion scans | Fusion scans over the projection period (default 12 months) |
| 10K units | LOC ÷ 10,000, rounded up per repository |
| Credits | 10K units × Fusion scans × the model's credits per 10K LOC |

Totals add an optional extra % on top and round up to bundles, as the calculator does.

### Commit frequency → Fusion scans

Every commit to the default branch runs a pipeline, so commit frequency stands in for scan
frequency. A repo with more than 5 commits a week runs more than 5 pipelines a week, and gets one
Fusion scan a week.

| Commits on the default branch | Fusion scans in 12 months |
|---|--:|
| More than 5 a week | 52 (weekly) |
| 1 to 5 a week | 26 (every 2 weeks) |
| About once in 2 weeks | 12 (monthly) |
| About once a month | 6 |
| About once in 2 months | 4 |
| About once in 3 months | 4 |
| About once in 6 months | 2 |
| About once a year | 1 |
| None in the window | 1 (a baseline scan) |

The table scales with `--period-months`, and you can change any row in the wizard or in
`fusion.byFrequency`. A per-repository **criticality** (1–5, from `overrides`) can raise the
count through `fusion.byCriticality`. By default the higher of the two wins, as in the calculator.
A repo override can also pin `scans`, a `model`, a `loc` figure, or `exclude: true`.

## Install

```bash
git clone https://github.com/cxsmtp/cloc-fusion && cd cloc-fusion
npm link            # puts `cloc-fusion` on your PATH (or run: node bin/cloc-fusion.js …)
```

Windows works the same in PowerShell or cmd, with Node.js and Git for Windows installed.

## Connecting: authentication by platform

The wizard (`cloc-fusion init`) asks which platform you use and how you want to sign in. It shows
where to create the token and which scopes it needs. It then tests the connection, lists your
organizations, and lets you pick several or `all`. You can add as many connections as you like,
for example github.com plus an Enterprise Server, or Azure DevOps plus Bitbucket.

| Platform | Sign-in options | Scopes / permissions |
|---|---|---|
| **GitHub** (.com / Enterprise Server) | Personal access token (classic or fine-grained), or **reuse `gh auth login`** (browser sign-in) | Classic: `repo`, `read:org`. Fine-grained: Metadata + Contents read, all repositories |
| **GitLab** (.com / self-managed) | Personal, group or project access token | `read_api`, `read_repository` (Reporter+) |
| **Azure DevOps** (Services / Server) | Personal access token, or **Microsoft Entra ID via `az login`** (browser sign-in) | Code (Read); User Profile (Read) to list organizations; PAT scoped to *All accessible organizations* |
| **Bitbucket Cloud** | Atlassian **API token with scopes** (email + token), workspace/project access token, or legacy app password | `read:user:bitbucket`, `read:workspace:bitbucket`, `read:repository:bitbucket` |
| **Bitbucket Data Center** | HTTP access token | Project read, repository read |
| **Any other Git** (Gitea, Gerrit, CodeCommit…) | None (uses your git credentials), username + token, or bearer token | Read access to the listed clone URLs |

**Okta and other SAML/OIDC SSO.** None of these platforms accepts an Okta token on its API
directly. Okta signs you in to the platform, and the platform then issues the credential the tool
uses:

- **GitHub with SAML SSO:** create the token, then click *Configure SSO → Authorize* for each
  organization. Or run `gh auth login`, which goes through your Okta sign-in in the browser, and
  choose the *GitHub CLI* option.
- **Azure DevOps backed by Entra ID federated with Okta:** choose *Microsoft Entra ID via Azure
  CLI*. `az login` opens the Okta sign-in, and the tool asks `az` for a fresh token on every run.
- **GitLab / Bitbucket with SAML SSO:** sign in once through SSO, then create the token as usual.

**Where tokens live.** The wizard asks where each token comes from: an environment variable
(recommended), a command such as a password manager CLI (`op read …`, `vault kv get …`), or the
config file itself (written owner-only). Tokens reach git through `GIT_CONFIG_*` environment
variables, never on a command line, and are never written into reports.

## Running a scan

```bash
cloc-fusion scan                                   # everything in cloc-fusion.config.json
cloc-fusion scan --credits-per-10k 2.5             # price it (sets the first model's rate)
cloc-fusion scan --only github/acme --limit 25     # a try-out on one organization
cloc-fusion list                                   # what would be scanned, no cloning
cloc-fusion doctor                                 # check git, Node and every sign-in
```

**How a repository is measured.** Each repository gets a bare, *blob-less, shallow* clone of its
default branch covering only the commit window. That gives commit counts, authors and dates
without file contents. Then only the files worth counting at HEAD are fetched in a single batch
and read straight from git's object store. No working tree is written, so long Windows paths and
odd file names don't matter, and the clone is deleted afterwards. A 10-million-line estate costs
about one shallow clone of each repository.

Large estates:

- `--concurrency 8` measures more repositories in parallel.
- A checkpoint (`cloc-fusion-partial.json`) is written every 30 seconds. Run again with
  `--resume cloc-fusion-output/cloc-fusion-partial.json` to skip repositories already measured.
- Behind a corporate proxy, set `HTTPS_PROXY` (git and the tool both use it). Custom CAs go in
  `NODE_EXTRA_CA_CERTS` and in git's `http.sslCAInfo`.

**Re-price without rescanning:**

```bash
cloc-fusion price --input cloc-fusion-output/cloc-fusion-report.json --period-months 6 --credits-per-10k 3 --extra-percent 15
```

## AI onboarding plan (optional)

```bash
npm install @anthropic-ai/sdk           # once
export ANTHROPIC_API_KEY=sk-ant-…        # or: ant auth login
cloc-fusion ai-plan --input cloc-fusion-output/cloc-fusion-report.json
```

Claude (`claude-opus-5-5` by default; change it with `--model`) reads the report and writes
`cloc-fusion-onboarding-plan.md`. The plan covers onboarding waves by business value and change
rate, a credit budget across the period, the levers to reduce spend, and data gaps such as failed
or dormant repositories. Add `--anonymize` to replace repository and organization names with
hashes before anything is sent.

## Configuration reference

See [`examples/cloc-fusion.config.example.json`](examples/cloc-fusion.config.example.json). Main keys:

| Key | Default | |
|---|---|---|
| `windowDays` | 365 | Commit history window |
| `includeArchived` / `includeForks` | false | |
| `includeMerges` | false | Count merge commits too (for merge-triggered pipelines) |
| `locBasis` | `code` | `code`, `code+comments` or `all` |
| `countCategories` | `code, markup, iac` | Also available: `data` (JSON/YAML/XML), `docs` |
| `exclude` / `include` | [] | Path globs inside repositories, e.g. `**/test/**` |
| `connections[].orgs` | `all` | A list, or `all` (add `includePersonal: true` for your own repos) |
| `connections[].include` / `exclude` | | Repository full-name globs |
| `fusion.models[]` | | `{ id, name, creditsPer10k }` |
| `fusion.byFrequency` / `byCriticality` / `combine` | | As in the calculator (`higher`, `frequency`, `criticality`) |
| `totals.extraPercent` / `bundleCredits` | 0 / 10000 | |
| `overrides` | | `{ "<full name or glob>": { criticality, scans, model, loc, exclude } }` |

## Development

```bash
npm test     # node:test. The scan tests build real git repositories locally; no network needed.
```
