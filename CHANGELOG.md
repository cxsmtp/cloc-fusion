# Changelog

All notable changes to cloc-fusion. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.1] - 2026-10-21

Security fixes from the Checkmarx One scans, a bill of materials with every release, and the security and performance report.

### Security
- The "create a token" link is only ever an http(s) URL, whatever the configured API address holds (Checkmarx).
- The setup wizard saves a pasted token to the owner-only `~/.cloc-fusion/credentials.json`, as the web app does, instead of the configuration file, so the configuration file can be shared (Checkmarx).
- The zip reader refuses a central directory over 256 MB before allocating for it (Checkmarx).
- Releases attach a CycloneDX bill of materials (`cloc-fusion-sbom.cdx.json`), and the release stops if `npm audit` reports a high or critical vulnerability.

### Added
- [Security and performance report](docs/SECURITY-REPORT.md): every Checkmarx One scan, every finding and what was done about it, the open-source components and their status, and the benchmark by version. A summary is at the top of the README.

### Fixed
- The benchmark's report sizes listed the contributors CSV in place of the report CSV.

### Verification
- **Checkmarx One** on 627c309 (SAST, SCA, KICS, secret detection, API security): 1 critical, 9 high, 10 medium, 14 low; no new findings, the two fixed findings gone, 0 SCA findings. Every remaining finding is by design ([report](docs/SECURITY-REPORT.md#by-design)).
- **Open-source components:** 0 known vulnerabilities.
- **Tests:** 66 passing.

## [1.3.0] - 2026-10-20

The web app, the standalone HTML page, browser sign-in, and choosing your Fusion models.

### Added
- **Contributors in the last 90 days, from the commit history.** Every person and bot who committed to a default branch in the last 90 days, with the repositories they contributed to:
  - each person once, by email (case-insensitive), with their name, commits and last commit; the developer count is unique across the estate and per organization;
  - bots (dependabot, renovate, github-actions, any `[bot]` account, plus any you name in `"bots": ["svc-*"]`) are listed as bots and not counted as developers;
  - in the HTML report (a headline tile, the summary, organization and repository columns, and a searchable *Contributors* section with a Developers/Bots filter), a `cloc-fusion-contributors.csv` next to the reports, the JSON, the Markdown summary, the console summary, the web app and the standalone page;
  - the same from the git engine (`git log`), the API engine and the browser.
- **The standalone page: `cloc-fusion.html`.** The whole tool in one HTML file that opens straight from disk, with no install, no Node.js and no hosting. Connections (GitHub, GitLab, Azure DevOps, Bitbucket Cloud and Data Center), Fusion pricing with models per frequency and criticality, scan settings and repository rules, the scan with live progress, and the full report (HTML, CSV, JSON), all in the page and on the same engine as the CLI.
  - Signs in with a token per connection (*Create a token* opens the platform's page with the scopes ticked); tokens stay in the page's memory only.
  - GitLab, Azure DevOps and Bitbucket are counted exactly. GitHub is exact when it lets the page download archives; otherwise lines are estimated from its language statistics and marked ≈ in the report.
  - Settings are remembered in the browser (never tokens) and export/import as `cloc-fusion.config.json`. Releases attach the page with its SHA-256; `node scripts/build-standalone.mjs` rebuilds it.
- **The web app.** `cloc-fusion` with no command (or `cloc-fusion ui`, or a double-click on the executable) opens a local page in your browser, in the next-gen look:
  - **Connections:** add GitHub, GitLab, Azure DevOps, Bitbucket or any Git; pick organizations from the ones found, or every one.
  - **Fusion pricing, scan settings and repository rules**, with the same options as the configuration file.
  - **Run the Fusion scan** with live progress, a stop button, and a credit estimate that follows every pricing change without rescanning. Reports open from the page.
  - Starts with these defaults when there is no configuration file: models *haiku* (1.5 credits per 10K LOC) and *opus 4.7* (2.5), 20% on top, bundles of 10,000, 365 days of commits, code + markup + IaC, archived repositories included, forks and merges excluded, and a GitHub connection through the GitHub CLI.
  - `--port` (default 4747) and `--no-open`.
- **Browser sign-in.** Every connection must be signed in before a scan, from its *Sign in* button: GitHub through `gh auth login --web` (one-time code, SSO / Okta included), Microsoft Entra ID through `az login`, the OAuth device flow on GitHub and GitLab when an app id is set, or the platform's token page opened with the right scopes and the token pasted once. Pasted and device tokens are kept in `~/.cloc-fusion/credentials.json` (owner-only), referenced from the settings as `"token": { "saved": true }`.
- **Choose the model per change frequency** in the app, next to the scans, as in the Cx Credits Calculator. The rules explain which model a repository gets: its own, else its frequency's (or criticality's), else the default.
- **Tune the plan in the HTML report.** A *Choose your Fusion models* section turns the report into a calculator: models and credits, a default model, scans and model per change frequency and per criticality, period, extra % and bundle size, and a criticality, scans and model picker on every repository row. The hero, tiles, cadence, organizations, models, table and CSV all follow; tested at 10,000 repositories. Choices are remembered per report in that browser, *Reset* goes back, and *Download settings* saves `cloc-fusion-settings.json`.
- **Import settings** in the app, and `cloc-fusion price --config <settings>`, read those downloaded settings.

### Changed
- **Checkmarx branding on the standalone page and the HTML report:** the Checkmarx logo replaces the cloc·fusion wordmark; the operating system's own typeface (San Francisco on macOS, Segoe UI on Windows), with no embedded fonts, so the page is about 175 KB; a calm, solid look with one brand colour and no gradients, glows or animated backgrounds; labels and figures in the same typeface, with aligned digits in tables and figures.
- The engine's shared parts (report builder, repository discovery rules, tar parser, commit statistics, token pages) are plain JavaScript modules, used by the CLI, the app and the standalone page alike. Line counting is faster (about 155 MB/s per core, from 110).
- `price` (CLI and app) applies repository rules (criticality, scans, model, lines) without a rescan.
- The report's repository table shows the plan first: change frequency, criticality, Fusion scans, model and credits, then the measurements. The CSV gains a Criticality column.
- `cloc-fusion` with no arguments starts the web app; `--help` shows the commands.

### Security
- **Checkmarx One scan of this release** (SAST, SCA, KICS, secret detection; 3 critical, 10 high, 11 medium, 15 low), every finding triaged. Fixed:
  - command injection on Windows: the GitHub host taken from the API address went to `gh` through the Windows shell, and a URL host may contain `&` or `$()`; only a plain host name is accepted now (critical);
  - prototype pollution: the web app and the standalone page keep per-connection state in prototype-free maps (high);
  - Content Security Policies: the web app's scripts run by a per-response nonce; the standalone page connects to https servers only (high/medium);
  - imported settings are taken key by key with type checks (high);
  - SHA-256 instead of SHA-1 for work-folder names, a validated `CLOC_FUSION_UPDATE_REPO`, and a constant-time key check (medium/low);
  - the test mock uses a random token and allows only a page opened from disk (critical/high, test code).
- By design, and documented in SECURITY.md: requests to the API and clone addresses you configure (SSRF), http for servers you configured as http, the `command` token source running your own command through your shell, tokens kept in owner-only files when you choose to store them, and the release download whose SHA-256 is checked before use. The secret-detection hit is a fake `user:token@` URL in the test that proves such URLs are refused.
- The web app listens on 127.0.0.1 only, checks the `Host` header, needs a per-run key on every call, accepts JSON only, and serves a strict Content Security Policy. See [SECURITY.md](SECURITY.md#the-web-app).

### Verification
- **Checkmarx One** (SAST, SCA, KICS, secret detection, API security; containers and AI supply chain on a later scan): the release scan found 1 critical, 10 high, 11 medium and 14 low, down from 3 critical and 15 low before the fixes listed under *Security*. Every finding is fixed or by design, with the reason in the [security and performance report](docs/SECURITY-REPORT.md).
- **Open-source components:** 0 known vulnerabilities (Checkmarx SCA, `npm audit`). No runtime dependencies; the optional Anthropic SDK and its 7 dependencies are listed in the [SBOM](docs/sbom.cdx.json).
- **Performance** (10,000 repositories, 4 CPUs): API engine 10,000 measured, **0 failed**, 47,451 requests with 681 injected errors, 44.5 s (225 repos/s, from 135), 299 MB; git engine 10,000 measured, **0 failed**, 5.2 min (from 9.3–12.7), 145 MB; report built in 0.12 s and written in 1.8 s; line counting 132 MB/s per core.
- **Tests:** 65 passing on Node 18 and 22, on Windows, macOS and Linux.

## [1.2.1] - 2026-10-15

### Fixed
- **`cloc-fusion update` downloads the release file itself.** In 1.2.0 the API client's default `Accept` header overrode the download's, so GitHub returned the file's metadata. The checksum check caught it and nothing was changed, but the update could not complete. 1.2.0 users: download 1.2.1 once from the Releases page; `update` works from then on.
- Standalone executables no longer print "Code cache data rejected" on machines whose CPU differs from the build machine's. The code cache is off; start-up is unchanged in practice.

### Changed
- Benchmark and test fault injection is deterministic: a share of URLs fail on their first attempt only. Retries are exercised on every run, and no run can exhaust them by chance (a CI run on Windows did).
- Verified end to end: a 1.1.9 executable updated itself to the published 1.2.0 release, and the installed file matches the release's SHA-256.

### Verification
- **Open-source components:** 0 known vulnerabilities in this version's lockfile (`npm audit`, checked 2026-10-20).
- **Checkmarx One:** not scanned at this version; see 1.3.0.
- **Performance:** measuring code unchanged since 1.1.0 (see its benchmark).

## [1.2.0] - 2026-10-15

The next-gen look, and always knowing which version you have.

### Added
- **Built-in version and history.** `cloc-fusion version` shows the version, the build (commit and date for standalone executables) and the platform, and says whether a newer release is out. `cloc-fusion changelog` prints this changelog from inside the tool: `--all` for every release, `--since <version>` for what changed after yours. Every report records the version that made it.
- **Self-update.** `cloc-fusion update` replaces a standalone executable with the latest release for this platform:
  - it checks the file against the release's `SHA256SUMS.txt` and runs it once before it switches over, and nothing changes if either check fails;
  - `update --check` only checks and exits with code 10 when an update is available;
  - private repositories use `GITHUB_TOKEN` or `gh auth login`.
- **Update notice.** `scan`, `list`, `doctor`, `price` and `init` check for a newer release at most once a day and print a one-line notice at the end. It never delays a command by more than about 2.5 s, is skipped in CI, and is turned off with `CLOC_FUSION_NO_UPDATE_CHECK=1`.
- **Version-controlled releases.** One version source (`src/version.js`), checked against `package.json` and the newest CHANGELOG entry by `test/version.test.js`. Pushing a new version to the default branch makes CI:
  - create the git tag `vX.Y.Z`;
  - build and smoke-test the executables (each must report that version);
  - publish the release with `SHA256SUMS.txt`, using the version's CHANGELOG section as the notes.

  A mismatched tag, version or changelog stops the release.
- **Next-gen report look**, from the Cx Detection Date Base Reminder app's design (`nextgen.css`):
  - **Themes and accents:** Obsidian (dark, the default) and Daylight, plus Auto. Five accents: indigo, cyan, emerald, violet and amber. The choice is remembered on each device.
  - **Surfaces:** glass panels over an ambient aurora glow, with the accent's indigo → cyan gradients. Plus Jakarta Sans and JetBrains Mono are embedded (SIL OFL 1.1, `assets/fonts`), so the report renders the same offline.
  - **Hero:** the credit total in a glowing readiness ring, a *Discovered → Measured → Planned → Ready for Fusion* journey, and a golden *Download the Fusion plan* button.
  - **Motion:** figures count up, cadence and language bars grow in, and sections ease in as you scroll. Hover glows and press feedback on every button; smooth theme cross-fades.
  - **Downloads and printing:** the whole plan or the current filtered view as CSV, straight from the page (formulas defused). The print view is clean.
  - **Accessibility:** honours *reduced motion*, keeps focus rings, and works at phone width.
- **Next-gen terminal look:** a gradient banner, a gradient progress bar, green ✓ and red ✗, and a closing *Ready for Fusion* line. Colour only on a terminal; `NO_COLOR` turns it off and `FORCE_COLOR` forces it.

### Changed
- Report title is now *Fusion Readiness Report*.
- Standalone executables carry their commit, build date and the full changelog.

### Fixed
- Piping output into a command that stops reading (`| head`) exits quietly instead of failing with EPIPE.

### Verification
- **Open-source components:** 0 known vulnerabilities in this version's lockfile (`npm audit`, checked 2026-10-20).
- **Checkmarx One:** not scanned at this version; see 1.3.0.
- **Performance:** measuring code unchanged since 1.1.0 (see its benchmark).

## [1.1.0] - 2026-10-15

Zero-install, hardened, and proven at 10,000 repositories.

### Added
- **Standalone executables** for Windows (x64), macOS (Apple silicon and Intel) and Linux (x64 and arm64). One file with Node.js built in: download it and run it. No Node.js, npm or git needed. Built by `scripts/build-binary.mjs` and the *Standalone executables* workflow, which publishes them on every `v*` tag with SHA-256 checksums.
- **Git-free API engine** (`--engine api`). It measures repositories through the platform APIs alone: the default branch's archive is streamed and counted in memory, and commits come from the commit API. GitHub, GitLab and Bitbucket send `.tar.gz` archives; Azure DevOps sends `.zip`.
- **Engine auto-selection** (`--engine auto`, the default). The git engine runs when git 2.31 or newer is installed, and the API engine runs otherwise. `doctor` reports which engine will run.
- Built-in **tar and zip readers** (`src/archive.js`) on Node's zlib, with long-name support (pax and GNU) and decompression limits.
- **Benchmark harness** (`bench/bench.js`) with a GitHub-compatible mock API (`bench/mock-github.js`). It has fault injection and a separate download host that must never see the token. The scenarios cover the API engine, the git engine, report generation and line counting. Results are in [docs/BENCHMARKS.md](docs/BENCHMARKS.md).
- **Security documentation and regression tests**: [SECURITY.md](SECURITY.md) and `test/security.test.js`.
- HTML report: paged repository table (250 rows at a time, *Show more* / *Show all*), a debounced filter, sparklines drawn as a single path each, and a cached collator for sorting. A 10,000-row report loads in about 0.6 s and sorts in about 0.3 s.
- New settings: `engine`, `discoveryConcurrency` (8), `repoTimeoutMinutes` (30), `maxArchiveBytes` (4 GB).
- CI: Node 18 and 22 on Windows, macOS and Linux; a benchmark job; least-privilege workflow permissions.

### Changed
- Default `concurrency` raised from 4 to 8.
- Organizations are listed in parallel (8 at a time), and Bitbucket Data Center default branches are looked up in parallel.
- Line counting is about 3× faster (about 35 → 90–110 MB/s per core). It now makes a single pass with no per-line strings, jumps over plain code with a regex, and caches comment ends, so the work stays linear even in huge files.
- File selection compiles exclude/include globs once per repository instead of once per file. Overrides are compiled once per scan.
- When the same repository is reached twice, the copy that is measured wins over a skipped one.
- The work folder is now a private random temp folder for each run, removed afterwards (`--work-dir` still overrides).

### Security
- **The API client only sends credentials to the configured API origin**, plus a short list of known hosts (Azure DevOps' profile service, bitbucket.org downloads). It refuses API calls or pagination links to other hosts. Redirects are followed by hand: without credentials to other hosts, and never from https down to http.
- **Git:** the auth header is scoped to the repository's own origin (`http.<origin>/.extraHeader`), and only the expected transports are allowed (`GIT_ALLOW_PROTOCOL`). Clone URLs must be https (or http/file for servers you configure). They must point to a host of that connection and are passed after `--`, so they can never be read as options. Branch names are validated. `GIT_SSH_COMMAND` and `GIT_CONFIG_PARAMETERS` are cleared for git's processes.
- **Bounded inputs:** API answers are capped at 64 MB, archives at `maxArchiveBytes` uncompressed, and files counted at `maxFileBytes`. Zip64 and malformed archives are refused.
- **Reports:** only http(s) repository links appear in the HTML report. Markdown cells are escaped. Accumulators built from report files are prototype-free, so a crafted `--resume` file cannot pollute prototypes.

- **Independent audit fixes:**
  - Git no longer follows redirects (`http.followRedirects=false`), so the auth header can't travel to a redirect's host.
  - Credentials are refused over plain http unless the connection itself is http.
  - Clone URLs with embedded credentials are rejected at load time.
  - Hostile inputs are bounded:
    - Globs compile to a linear form, and paths over 4,096 characters are skipped, which prevents regex backtracking.
    - Commit pagination is capped for Bitbucket, Bitbucket Data Center and Azure DevOps.
    - Zip reading has a total decompression budget and rejects entries that share data.
  - The CSV formula guard is no longer bypassable with numeric prefixes.
  - `gh` and `az` token helpers run without a shell.
  - Config files holding a token are written atomically as owner-only.
  - Terminal control characters are stripped from logged text.
  - `--anonymize` uses salted SHA-256.

### Fixed
- Archive downloads are allowed up to 30 minutes instead of the 60-second API timeout.
- Pagination tolerates a non-list page instead of throwing.

### Verification
- **Performance** (10,000 repositories, 4 CPUs, [benchmarks](docs/BENCHMARKS.md)): API engine 10,000 measured, **0 failed**, 47,525 requests with 755 injected errors, 74 s, 310 MB; git engine 10,000 measured, **0 failed**, 9.3–12.7 min, under 200 MB; report written in 3.3 s; line counting 77–110 MB/s per core; a 10,000-row HTML report loads in 0.57 s.
- **Open-source components:** 0 known vulnerabilities in this version's lockfile (`npm audit`, checked 2026-10-20).
- **Checkmarx One:** not scanned at this version; see 1.3.0.

## [1.0.0] - 2026-10-15

First release.

### Added
- **CLI** `cloc-fusion` with the commands `init`, `scan`, `list`, `price`, `ai-plan` and `doctor`.
- **Connections** to GitHub (github.com and Enterprise Server), GitLab (gitlab.com and self-managed), Azure DevOps (Services and Server), Bitbucket Cloud, Bitbucket Data Center, and any other Git server (a list of clone URLs). One configuration can hold many connections and organizations; each connection can scan a list of organizations or `all` of them.
- **Setup wizard** (`init`). It shows where to create a token and which scopes it needs for each platform, tests the connection, discovers organizations to pick from, and sets Fusion pricing. Sign-in options include personal access tokens, Atlassian API tokens, access tokens, the GitHub CLI (`gh auth login`) and Microsoft Entra ID via the Azure CLI (`az login`), which covers Okta/SAML SSO setups.
- **Secrets by reference**: an environment variable, a command such as a password manager CLI, or stored in the config file (written owner-only).
- **Git engine**: bare, blob-less, shallow clone of the default branch over the commit window. Only the files that count are fetched, in one batch, and read with `git cat-file --batch`. No working tree is written.
- **Line counting** like cloc: code, comment and blank lines for about 75 languages in 5 categories (code, markup, iac, data, docs). Dependencies, build output, generated and minified files are excluded. Results come within 0.4% of cloc on Express.
- **Commit activity**: commits on the default branch in the window (merges optional), active authors, last commit date and a 52-week series.
- **Fusion model**, the same arithmetic as the Cx Credits Calculator:
  - Commit frequency maps to change-frequency buckets: more than 5 commits a week gives one Fusion scan a week, and slower buckets step down to 1 a year.
  - Credits = 10K units (rounded up per repository) × scans × the model's credits per 10K LOC.
  - Optional per-repository criticality, overrides, multiple models, an extra % on top, and bundles.
- **Reports** in HTML (self-contained, sortable, light and dark), CSV, JSON and Markdown, plus a console summary.
- **`price`**: re-price a report with new settings without scanning again. **`--resume`**: continue from a partial report; a checkpoint is written every 30 seconds.
- **AI onboarding plan** (`ai-plan`, optional): Claude writes a phased Fusion onboarding plan from the report; `--anonymize` hashes names first.
- Proxy support (`HTTPS_PROXY`) and friendly errors for authentication, rate limits and sign-in pages.

### Verification
- **Open-source components:** 0 known vulnerabilities in this version's lockfile (`npm audit`, checked 2026-10-20).
- **Checkmarx One:** a scan was started but did not complete; see 1.3.0.
- **Performance:** not benchmarked at scale; see 1.1.0.

[Unreleased]: https://github.com/cxsmtp/cloc-fusion/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/cxsmtp/cloc-fusion/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/cxsmtp/cloc-fusion/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/cxsmtp/cloc-fusion/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/cxsmtp/cloc-fusion/compare/e4bc001...v1.2.0
[1.1.0]: https://github.com/cxsmtp/cloc-fusion/compare/17bd63c...e4bc001
[1.0.0]: https://github.com/cxsmtp/cloc-fusion/commit/17bd63c
