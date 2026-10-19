# cloc-fusion

**Size every repository you own for Checkmarx One Fusion in minutes.**

cloc-fusion connects to GitHub, GitLab, Azure DevOps and Bitbucket, across as many organizations as you have. For every repository it counts lines of code and recent commits. From the commit rate it suggests how often the repository needs a Fusion scan, then works out the credits your whole estate needs. The answer is an HTML, CSV, JSON and Markdown report.

- **Or just one HTML file.** Open `cloc-fusion.html` in your browser: no install, no hosting, no server. It signs in, scans and prices right in the page.
- **A web app, not a command line.** Run it and your browser opens: sign in through the browser, check the pricing, press *Run the Fusion scan*, and watch the credits add up.
- **On-premises.** It runs on your machine, next to your own GitHub Enterprise Server, GitLab, Azure DevOps Server or Bitbucket Data Center as well as the cloud platforms. Code, figures and tokens stay with you; there is no cloud service in between.
- **You choose the models.** Pick which Fusion model each repository gets by change frequency, criticality or one by one, in the app or right in the HTML report, and every total follows.
- **Nothing to install.** One file for Windows, macOS or Linux, with no runtime, git or packages needed.
- **Every platform, every organization**, picked in a guided setup that also handles SSO sign-in.
- **Built for scale:** benchmarked at 10,000 repositories, with 47,000+ API calls and injected failures, and 0 lost ([benchmarks](docs/BENCHMARKS.md)).
- **Secure by design:** tokens are never stored by default, never leave their host, and never appear in reports ([security](SECURITY.md)).
- **A report you'll want to show:** the next-gen Obsidian and Daylight look, with a glowing readiness ring, smooth motion and one-click CSV download of the plan.
- **Always current:** `cloc-fusion version` tells you what you have, and `cloc-fusion update` installs the latest release after checking its checksum.

## Quick start

**The quickest way: one HTML file.** Download [`cloc-fusion.html`](cloc-fusion.html) (also attached to every release) and double-click it. Add your connections, paste a token for each (*Create a token* opens the right page with the right permissions ticked), and press *Run the Fusion scan*. See [the standalone page](#the-standalone-page-one-html-file) for what it can and can't do compared with the app.

**The full app:**

1. **Download** the file for your system from [Releases](../../releases), or from the *Standalone executables* workflow run's artifacts:
   `cloc-fusion-windows-x64.exe` · `cloc-fusion-macos-arm64` · `cloc-fusion-macos-x64` · `cloc-fusion-linux-x64` · `cloc-fusion-linux-arm64`
2. **Run it.** Double-click the file, or run `cloc-fusion` with no arguments. The web app opens in your browser at `http://127.0.0.1:4747`, already set up with sensible defaults (two Fusion models, 20% headroom, bundles of 10,000 credits, the last 365 days of commits).
3. **Sign in** to each connection with the *Sign in* button: GitHub through your browser, Microsoft Entra ID for Azure DevOps, or a token page opened with the right permissions ticked.
4. **Run the Fusion scan.** Progress and the credit estimate update live; open the full report when it is done.

On macOS or Linux, run `chmod +x` on the file first. If you have Node.js 18+, you can also run it from source with `node bin/cloc-fusion.js`. Prefer the terminal? `cloc-fusion init` and `cloc-fusion scan` do the same without a browser.

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

- [The standalone page (one HTML file)](#the-standalone-page-one-html-file)
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
- [Versions and updates](#versions-and-updates)

### The standalone page (one HTML file)

`cloc-fusion.html` is the whole tool in one file that opens straight from disk: no Node.js, no executable, no server. It uses the same engine as the app (same discovery, line counting, commit rules, Fusion pricing and report), compiled for the browser.

| | Standalone page | App (`cloc-fusion` / executable) |
|---|---|---|
| Install | None: open the file | None (single executable) or Node.js 18+ |
| Sign-in | A token per connection, kept in the page's memory only | Browser sign-in (GitHub CLI, Microsoft Entra ID, device flow) or a token |
| GitHub | Exact lines when GitHub allows the page to download archives; otherwise **estimated** from GitHub's language statistics (about 45 bytes a line), and marked ≈ in the report | Always exact (git clones or archives) |
| GitLab, Azure DevOps, Bitbucket Cloud | Exact (archives) | Exact |
| Bitbucket Data Center, self-hosted servers | Works when the server allows cross-origin requests (CORS) | Always |
| Generic Git servers | Not available (needs git) | Yes |
| Scale | Hundreds to a few thousand repositories per run (browser memory) | 10,000+ |
| Saved | Settings in this browser (never tokens); export/import as `cloc-fusion.config.json` | Settings file, tokens in your keychain/env |

Results are the full report: open it from the page, or download it as HTML, CSV or JSON. Settings files move freely between the page, the app and the CLI.

**Branding:** the page and the HTML report carry the Checkmarx logo and use the operating system's own typeface (San Francisco on macOS, Segoe UI on Windows), so nothing is embedded and the files stay small.

Rebuild it after changing the code with `node scripts/build-standalone.mjs` (esbuild at build time only; the page itself has no dependencies). Releases rebuild and attach it with its SHA-256.

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

**Which model a repository gets**, as in the Cx Credits Calculator: the model picked for that repository, else the model of its change frequency (its criticality's first when criticality decides), else the default model. So you can put the busiest repositories on one model, the most critical on another, and everything else on the default.

**Tune the plan in the report.** The HTML report has the same controls in its *Choose your Fusion models* section: models and their credits, scans and model per change frequency and per criticality, the projection period, the extra % and the bundle size, plus a criticality, scans and model picker on every row of the repository table. Every figure on the page follows instantly, even with 10,000 repositories. Choices are remembered in that browser; *Download settings* saves them as `cloc-fusion-settings.json`, which the web app imports (*Import settings*) and `cloc-fusion price --config cloc-fusion-settings.json` reads.

### Connecting and signing in

**In the web app**, each connection has a *Sign in* button. A connection must be signed in before a scan can start, and the app checks every sign-in when it opens. The methods it offers depend on the platform and on what is installed:

| Method | How it works |
|---|---|
| Sign in with GitHub | Runs `gh auth login --web`: the page shows a one-time code and opens GitHub, where you approve it (SAML SSO / Okta included). |
| Sign in with Microsoft | Runs `az login`: the Microsoft sign-in opens in your browser (Entra ID, including Okta federation). |
| Sign in in the browser | OAuth device flow on GitHub or GitLab, when an OAuth app id is set (`oauth.clientId`, or `CLOC_FUSION_GITHUB_CLIENT_ID` / `CLOC_FUSION_GITLAB_CLIENT_ID`). |
| Create a token in the browser | Opens the platform's token page with the right scopes ticked where the platform allows it. Paste the token once: it is kept in `~/.cloc-fusion/credentials.json` (owner-only), never in the settings file. |

**In the terminal**, `cloc-fusion init` asks for the platform and sign-in method, explains where to create the token and which scopes it needs, tests it, and lists your organizations to choose from. You can pick several or `all`. Add as many connections as you need, for example github.com plus Enterprise Server plus Azure DevOps.

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
| `ui` | The web app (the default when no command is given). `--port <n>`, `--no-open` |
| `init` | Setup wizard: connections, organizations, Fusion pricing |
| `scan` | Discover, measure, price and write the reports |
| `list` | Show what a scan would cover, without measuring |
| `price` | Re-price an existing report (new rate, period, extra %, models or repository rules) without rescanning; `--config` also takes settings downloaded from a report |
| `doctor` | Check the engine and every connection's sign-in |
| `ai-plan` | Ask Claude for a phased onboarding plan (optional) |
| `version` | This copy's version and build, and whether a newer release is out |
| `changelog` | What changed (`--all`, or `--since <version>`) |
| `update` | Install the latest release, checksum-verified (`--check` only checks) |

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

- **HTML**: one self-contained file that works offline, in the next-gen look (from the Cx Detection Date Base Reminder app's design):
  - **Themes:** Obsidian (dark, the default), Daylight or Auto, with five accents; the choice is remembered on each device.
  - **Overview:** a hero with the credit total in a readiness ring, the *Discovered → Measured → Planned → Ready for Fusion* journey, and summary tiles.
  - **Detail:** Fusion cadence bars, breakdowns by organization, model and language, and a sortable, filterable repository table that pages through 10,000+ rows smoothly.
  - **Motion:** figures count up and sections ease in. It respects reduced motion and prints cleanly.
  - **Tune the plan:** choose models, scans and pricing on the page; every figure and the CSV follow (see [How the calculation works](#how-the-calculation-works)).
  - **Download** the whole plan, or the current view, as CSV in one click.
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
- **The web app is local only:** it listens on 127.0.0.1, refuses any other `Host` (no DNS rebinding), requires a random per-run key on every call, and serves a strict Content Security Policy.
- **Small attack surface:** zero runtime dependencies; scanned with Checkmarx One and regression-tested in `test/security.test.js`.

### AI onboarding plan

```
cloc-fusion ai-plan --input cloc-fusion-output/cloc-fusion-report.json [--anonymize]
```

Claude (`claude-opus-5-5` by default) reads the report and writes `cloc-fusion-onboarding-plan.md`. The plan covers onboarding waves, a credit budget across the period, the levers to reduce spend, and data gaps. It needs an Anthropic API key (`ANTHROPIC_API_KEY`). The standalone executables include the SDK; from source, run `npm install @anthropic-ai/sdk` first. `--anonymize` replaces repository and organization names with hashes before anything is sent.

### Building from source

```
npm test                          # 60 tests: engines, providers, reports, web app, standalone page, security, versioning
node bench/bench.js --repos 1000  # benchmarks
node scripts/build-binary.mjs     # standalone executable for this OS → dist/
```

### Versions and updates

The version lives in one place (`src/version.js`). Tests keep it in step with `package.json` and the newest [CHANGELOG.md](CHANGELOG.md) entry.

**Releasing:** bump the version, add its CHANGELOG entry, and push to the default branch. CI then tags the commit `vX.Y.Z`, builds the five executables, and publishes the release with `SHA256SUMS.txt`, using that changelog entry as the notes. Pushing a `v*` tag yourself works too.

```
cloc-fusion version        # e.g. 1.2.0 · standalone executable · built 2026-10-15 from 1a2b3c4d5e6f
cloc-fusion changelog      # what's new; --since 1.1.0 for everything after yours
cloc-fusion update         # download the latest release, verify its SHA-256, swap it in
```

Long-running commands also print a one-line notice when a newer release is out. They check once a day, never in CI; turn it off with `CLOC_FUSION_NO_UPDATE_CHECK=1`. For a private repository, set `GITHUB_TOKEN` or sign in with `gh auth login`.

Every change is recorded in [CHANGELOG.md](CHANGELOG.md).
