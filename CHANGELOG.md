# Changelog

All notable changes to cloc-fusion. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.1] - 2026-10-15

### Fixed
- **`cloc-fusion update` downloads the release file itself.** In 1.2.0 the API client's default `Accept` header overrode the download's, so GitHub returned the file's metadata. The checksum check caught it and nothing was changed, but the update could not complete. 1.2.0 users: download 1.2.1 once from the Releases page; `update` works from then on.
- Standalone executables no longer print "Code cache data rejected" on machines whose CPU differs from the build machine's. The code cache is off; start-up is unchanged in practice.

### Changed
- Benchmark and test fault injection is deterministic: a share of URLs fail on their first attempt only. Retries are exercised on every run, and no run can exhaust them by chance (a CI run on Windows did).
- Verified end to end: a 1.1.9 executable updated itself to the published 1.2.0 release, and the installed file matches the release's SHA-256.

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

[Unreleased]: https://github.com/cxsmtp/cloc-fusion/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/cxsmtp/cloc-fusion/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/cxsmtp/cloc-fusion/compare/e4bc001...v1.2.0
[1.1.0]: https://github.com/cxsmtp/cloc-fusion/compare/17bd63c...e4bc001
[1.0.0]: https://github.com/cxsmtp/cloc-fusion/commit/17bd63c
