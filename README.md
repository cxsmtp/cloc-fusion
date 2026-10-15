# cloc-fusion

**Size every repository you own for Checkmarx One Fusion in minutes.**

cloc-fusion connects to GitHub, GitLab, Azure DevOps and Bitbucket, across as many organizations as you have. For every repository it counts lines of code and recent commits. From the commit rate it suggests how often the repository needs a Fusion scan, then works out the credits your whole estate needs. The answer is an HTML, CSV, JSON and Markdown report.

- **Nothing to install.** One file for Windows, macOS or Linux, with no runtime, git or packages needed.
- **Every platform, every organization**, picked in a guided setup that also handles SSO sign-in.
- **Built for scale:** benchmarked at 10,000 repositories, with 47,000+ API calls and injected failures, and 0 lost ([benchmarks](docs/BENCHMARKS.md)).
- **Secure by design:** tokens are never stored by default, never leave their host, and never appear in reports ([security](SECURITY.md)).

## Quick start

1. **Download** the file for your system from [Releases](../../releases), or from the *Standalone executables* workflow run's artifacts:
   `cloc-fusion-windows-x64.exe` · `cloc-fusion-macos-arm64` · `cloc-fusion-macos-x64` · `cloc-fusion-linux-x64` · `cloc-fusion-linux-arm64`
2. **Connect** your platforms:
   ```
   cloc-fusion init
   ```
3. **Scan** and open `cloc-fusion-output/cloc-fusion-report.html`:
   ```
   cloc-fusion scan
   ```

On macOS or Linux, run `chmod +x` on the file first. If you have Node.js 18+, you can also run it from source with `node bin/cloc-fusion.js`.

## What you get

This example is priced at 2 credits per 10K LOC; you set your own rate.

| Repository | LOC | Commits / week | Change frequency | Fusion scans / yr | Credits |
|---|--:|--:|---|--:|--:|
| payments-api | 182,400 | 9.4 | More than 5 a week | 52 | 1,976 |
| web-portal | 61,200 | 2.1 | 1 to 5 a week | 26 | 364 |
| legacy-batch | 23,900 | 0 | Not in the window | 1 | 6 |

The report also shows totals and the number of credit bundles you need. It breaks the estate down by change frequency, organization, Fusion model and language, and includes a 52-week activity sparkline per repository.

---

## Details

- [How the calculation works](#how-the-calculation-works)
- [Connecting and signing in](#connecting-and-signing-in)
- [Commands](#commands)
- [How repositories are measured](#how-repositories-are-measured)
- [Reports](#reports)
- [Configuration](#configuration)
- [Scale and performance](#scale-and-performance)
- [Security](#security)
- [AI onboarding plan](#ai-onboarding-plan)
- [Building from source](#building-from-source)

### How the calculation works

Every commit to the default branch runs a pipeline, so commit frequency stands in for scan frequency. The rules are the same as the Cx Credits Calculator's Fusion page:

| Commits on the default branch | Fusion scans in 12 months |
|---|--:|
| More than 5 a week | 52 (weekly) |
| 1 to 5 a week | 26 |
| About once in 2 weeks | 12 |
| About once a month | 6 |
| About once in 2 months | 4 |
| About once in 3 months | 4 |
| About once in 6 months | 2 |
| About once a year, or none in the window | 1 |

**Credits = 10K units × Fusion scans × credits per 10K LOC.** A repository's 10K units are its lines of code ÷ 10,000, rounded up per repository (12,000 lines count as 2). The total can add an extra % for headroom and is rounded up to whole bundles.

You can change any of this:
- the projection period (`--period-months`);
- the scans for each bucket (`fusion.byFrequency`);
- several Fusion models, each with its own rate;
- a criticality from 1 to 5 per repository, which raises its scans through `fusion.byCriticality` (by default the higher of frequency and criticality wins);
- per-repository overrides that pin `scans`, a `model` or `loc`, or `exclude` the repository.

### Connecting and signing in

`cloc-fusion init` asks for the platform and sign-in method, explains where to create the token and which scopes it needs, tests it, and lists your organizations to choose from. You can pick several or `all`. Add as many connections as you need, for example github.com plus Enterprise Server plus Azure DevOps.

| Platform | Sign-in | Scopes |
|---|---|---|
| GitHub (.com, Enterprise Server) | Personal access token, or reuse `gh auth login` | `repo`, `read:org` (fine-grained: Metadata + Contents read) |
| GitLab (.com, self-managed) | Personal, group or project access token | `read_api`, `read_repository` |
| Azure DevOps (Services, Server) | Personal access token, or Microsoft Entra ID via `az login` | Code (Read), User Profile (Read) |
| Bitbucket Cloud | Atlassian API token with scopes (email + token), or a workspace/project access token | `read:repository`, `read:workspace`, `read:user` |
| Bitbucket Data Center | HTTP access token | Project read, Repository read |
| Any other Git | None, username + token, or bearer token | Read access to the clone URLs |

**Okta and other SSO.** No platform accepts an Okta token on its API directly: Okta signs you in to the platform, and the platform issues the credential the tool uses.
- **GitHub with SAML SSO:** authorize the token for each organization (*Configure SSO → Authorize*), or use `gh auth login`.
- **Azure DevOps with Entra ID federated to Okta:** choose `az login`. It opens your Okta sign-in, and the tool fetches a fresh token on every run.

**Where tokens come from:** an environment variable (recommended), a command such as `op read …` or `vault kv get …`, or the config file itself (written owner-only).

### Commands

| Command | What it does |
|---|---|
| `init` | Setup wizard: connections, organizations, Fusion pricing |
| `scan` | Discover, measure, price and write the reports |
| `list` | Show what a scan would cover, without measuring |
| `price` | Re-price an existing report (new rate, period or extra %) without rescanning |
| `doctor` | Check the engine and every connection's sign-in |
| `ai-plan` | Ask Claude for a phased onboarding plan (optional) |

Common options:
- `--credits-per-10k <n>`, `--period-months <n>`, `--extra-percent <n>`
- `--only <connection[/org]>`, `--limit <n>`
- `--engine auto|git|api`, `--concurrency <n>`, `--window-days <n>`
- `--resume <report.json>`, `--format html,csv,json,md`, `--out <dir>`

`cloc-fusion --help` lists them all.

### How repositories are measured

There are two engines, and both produce the same numbers. `--engine auto`, the default, picks git when it is installed.

| | Git engine | API engine |
|---|---|---|
| Needs | git 2.31+ | nothing |
| Lines of code | Bare, blob-less, shallow clone of the default branch. Only the files that count are fetched, in one batch. | The default branch's archive (.tar.gz, or .zip for Azure), streamed and counted in memory |
| Commits | `git log` over the window | The platform's commit API |
| Best for | Large estates: clones don't use API rate limits | Quick runs on machines without git |

Neither engine writes a working tree, and clones are deleted as soon as a repository is measured.

**Lines of code** means code lines only, with no blanks or comments, counted the way cloc counts them. About 75 languages are recognised, in 5 categories: code, markup, iac, data and docs. By default code, markup and IaC count. Dependencies (`node_modules`, `vendor`…), build output, minified and generated files, and lock files are excluded. Change this with `locBasis`, `countCategories` and `exclude`/`include` path globs. On Express, the counts come within 0.4% of cloc.

**Commits** means non-merge commits on the default branch within the window (365 days by default), plus active authors and the last commit date. A repository younger than the window uses its own age.

### Reports

Reports are written to `cloc-fusion-output/`:

- **HTML**: one self-contained file that works offline, in light or dark theme. It has the summary tiles, Fusion scans by change frequency, breakdowns by organization, model and language, and a sortable, filterable repository table that pages through 10,000+ rows smoothly.
- **CSV**: one row per repository, safe to open in Excel (formula injection is defused).
- **JSON**: everything, including per-language counts and settings. `price` and `--resume` read it back.
- **Markdown**: a summary for wikis and pull requests.

### Configuration

`cloc-fusion init` writes `cloc-fusion.config.json`. See [the annotated example](examples/cloc-fusion.config.example.json).

| Key | Default | Meaning |
|---|---|---|
| `engine` | `auto` | `auto`, `git` or `api` |
| `windowDays` | 365 | Commit history window |
| `concurrency` / `discoveryConcurrency` | 8 / 8 | Repositories measured / organizations listed in parallel |
| `includeArchived` / `includeForks` / `includeMerges` | false | |
| `locBasis` | `code` | `code`, `code+comments` or `all` |
| `countCategories` | code, markup, iac | Also available: `data`, `docs` |
| `exclude` / `include` | [] | Path globs inside repositories, e.g. `**/test/**` |
| `maxFileBytes` / `maxArchiveBytes` | 2 MB / 4 GB | Size limits |
| `repoTimeoutMinutes` | 30 | Per-repository limit |
| `connections[]` | | `name`, `provider`, `apiUrl`, `auth`, `orgs` (list or `all`), `include`/`exclude` (repository globs) |
| `fusion` | | `periodMonths`, `models[] {id, name, creditsPer10k}`, `byFrequency`, `byCriticality`, `combine` |
| `totals` | 0% / 10,000 | `extraPercent`, `bundleCredits` |
| `overrides` | | `{"<repo or glob>": {criticality, scans, model, loc, exclude}}` |

### Scale and performance

These results come from the mock-API and local-git [benchmarks](docs/BENCHMARKS.md), run on a 4-CPU machine:

- **API engine:** 10,000 repositories, 47,525 requests including 755 injected 429/502 errors. **0 failures**, 74 s, 310 MB peak memory.
- **Git engine:** 10,000 repositories cloned and measured. **0 failures**, 9–13 min on 4 CPUs, under 200 MB.
- **Line counting:** 77–110 MB/s per core (about 3–4 million lines a second).
- **Reports:** 10,000 repositories built in 0.3 s and written in about 3 s. The HTML report opens in 0.6 s.

**Built to survive long runs:**
- Retries with backoff on 429, 5xx and network errors; the GitHub rate-limit reset is honoured.
- One failing repository never stops a scan.
- A checkpoint is written every 30 seconds; `--resume` continues from it.

**Real-platform limits:** GitHub allows 5,000 API calls an hour per token. For estates over a few thousand repositories, use the git engine (clones don't count against the limit) or split organizations across tokens.

Reproduce the benchmarks with `node bench/bench.js` (or `--repos 1000`).

### Security

A summary; [SECURITY.md](SECURITY.md) has the threat model and every protection.

- **Tokens:**
  - Referenced, not stored, by default.
  - Sent only to the platform's own API origin; never to other hosts, through redirects, or in pagination links.
  - Passed to git through environment variables scoped to the repository's origin, never on a command line.
  - Never written into reports.
- **Git is locked down:** https only (file/http only for servers you configure), clone hosts checked against the connection, URLs and branches validated, and no option injection.
- **Hostile input is bounded:** API answers are capped at 64 MB, archives have decompression limits, archive entries are never written to disk, and report data is escaped (HTML, CSV and Markdown).
- **Small attack surface:** zero runtime dependencies; scanned with Checkmarx One and regression-tested in `test/security.test.js`.

### AI onboarding plan

```
cloc-fusion ai-plan --input cloc-fusion-output/cloc-fusion-report.json [--anonymize]
```

Claude (`claude-opus-5-5` by default) reads the report and writes `cloc-fusion-onboarding-plan.md`. The plan covers onboarding waves, a credit budget across the period, the levers to reduce spend, and data gaps. It needs an Anthropic API key (`ANTHROPIC_API_KEY`). The standalone executables include the SDK; from source, run `npm install @anthropic-ai/sdk` first. `--anonymize` replaces repository and organization names with hashes before anything is sent.

### Building from source

```
npm test                          # 44 tests: engines, providers, reports, security
node bench/bench.js --repos 1000  # benchmarks
node scripts/build-binary.mjs     # standalone executable for this OS → dist/
```

Every change is recorded in [CHANGELOG.md](CHANGELOG.md).
