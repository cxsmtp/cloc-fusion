# Security and performance report

What has been checked in cloc-fusion, with what, and what was found. Updated with every release;
the [CHANGELOG](../CHANGELOG.md) has the same status per version, and [SECURITY.md](../SECURITY.md)
has the threat model and every protection.

**Status for 1.3.1, the current release:**

| Check | Result |
|---|---|
| Checkmarx One SAST, SCA, IaC (KICS), secret detection, API security, containers, AI supply chain | No open finding that is exploitable: every finding is fixed, or triaged as by design with the reason below |
| Open-source components (Checkmarx SCA and `npm audit`) | **0 known vulnerabilities** in 8 components, every version since 1.0.0 |
| Runtime dependencies of the npm package and the standalone page | **None** |
| Tests | 66 passing, on Node 18 and 22, on Windows, macOS and Linux (CI) |
| Benchmark | **10,000 repositories, 0 failures**, through 681 injected API errors |

## Checkmarx One scans

Scanned with every engine Checkmarx One offers for this code: SAST, SCA, KICS (IaC and CI
workflows), secret detection, API security, containers and AI supply chain security (AISC). About
10,300 lines of code.

| Date | Code | Engines | Critical | High | Medium | Low | Total | Outcome |
|---|---|---|--:|--:|--:|--:|--:|---|
| 2026-10-15 | 1.0.0 | SAST, SCA, KICS | | | | | | The scan did not complete |
| 2026-10-20 | 1.3.0 candidate | SAST, SCA, KICS | 3 | 10 | 11 | 15 | 39 | Every finding triaged; the exploitable ones fixed in 1.3.0 |
| 2026-10-20 | 1.3.0 release | + API security | 1 | 10 | 11 | 14 | 36 | Both fixed criticals gone; 1 new finding fixed after release |
| 2026-10-20 | Between releases | + containers, AISC | 1 | 9 | 12 | 14 | 36 | No new findings; 2 confirmed findings fixed after |
| 2026-10-20 | **1.3.1** (627c309; later commits change only documentation and the release workflow) | SAST, SCA, KICS, secrets, API security | **1** | **9** | **10** | **14** | **34** | **No new findings; the 2 fixed findings gone; 0 SCA findings. Every remaining finding is by design (below)** |

Counts are what the scanner reports, by design findings included: a static analyser flags every
place where a configured address is requested or a token is stored, and those are what the tool
is for. What matters is the outcome column and the triage below.

### Fixed

| Severity | Finding | Fix |
|---|---|---|
| Critical | Command injection on Windows: the GitHub host taken from the API address reached `gh` through the Windows shell | Only a plain host name is accepted (1.3.0) |
| Critical | A fixed token in the test mock API | A random token per run (1.3.0, test code) |
| High | Prototype pollution in the web app's and the standalone page's per-connection state | Prototype-free maps (1.3.0) |
| High | Settings import took any key | Known keys only, type-checked, 1 MB limit (1.3.0) |
| High / medium | Content Security Policies | The web app runs only its own script, by a per-response nonce; the standalone page connects to https servers only (1.3.0) |
| High / medium | The "create a token" link built from the configured API address | Only ever an http(s) URL (1.3.1) |
| Medium | The setup wizard wrote a pasted token into the configuration file | Saved to the owner-only credentials file instead (1.3.1) |
| Medium | The zip reader sized a buffer from the archive's own header | Bounded before allocating (1.3.1) |
| Medium / low | SHA-1 for work-folder names; the update repository override; the web app key comparison | SHA-256; validated `owner/name`; constant-time comparison (1.3.0) |

### By design

Each is what the tool is configured to do, protected as described in [SECURITY.md](../SECURITY.md):

| Finding | Why it stays |
|---|---|
| Command injection (`config.js`) | The `command` token source runs the command *you* write in your configuration (a password manager, a vault CLI), through your shell. Nothing from a platform or a repository reaches it. |
| Server-side request forgery (`http.js`, `git.js`) | Requests go to the API and clone addresses you configure; that is the job. Tokens never leave the API origin, through redirects or pagination links included. |
| Cleartext transmission (`git.js`) | Only for a server you configured with an `http://` address. Everything else is https only. |
| Download without integrity check (`update.js`) | The release file's SHA-256 is checked against the release's checksums before it is used. |
| Cleartext storage (`credentials.js`, `config.js`, `wizard.js`) | Tokens are referenced, not stored, by default. When you choose to store one, it is written atomically to an owner-only file (`0600`). |
| Permissive or weak Content Security Policy (`cloc-fusion.html`, `ui/server.js`) | The report opened from the standalone page needs inline scripts (a page opened from disk cannot use a nonce); connections are https only. The web app allows only inline styles. |
| Cross-site scripting (`report/html.js`) | False positive: the report's embedded data is escaped so it cannot close its script element. |
| Sensitive query string, error messages (`ui/server.js`, `config.js`, `scan.js`) | The web app listens on 127.0.0.1 only and needs a random per-run key; error messages say where a token is missing, never the token. |
| Unchecked loop input, missing HSTS (`bench/mock-github.js`) | The local test mock, not shipped. |
| Secret detection | A fake `user:token@` URL in a test, which proves such URLs are refused. |
| Unpinned GitHub Actions (KICS, low) | Official `actions/*` and one release action at major versions; workflow permissions are least-privilege. |

## Open-source components (SBOM)

The npm package, the web app and the standalone page have **no runtime dependencies**. The one
optional package, the Anthropic SDK, is used only by the optional AI onboarding plan (`ai-plan`)
and is bundled into the standalone executables. The full bill of materials, in CycloneDX 1.5, is
[sbom.cdx.json](sbom.cdx.json); every release attaches it as `cloc-fusion-sbom.cdx.json`.

| Component | Version | License | Used by | Known vulnerabilities |
|---|---|---|---|---|
| @anthropic-ai/sdk | 0.134.0 | MIT | Optional AI plan | **None** |
| @babel/runtime | 7.29.10 | MIT | SDK dependency | **None** |
| @opentelemetry/api | 1.9.1 | Apache-2.0 | SDK dependency | **None** |
| @stablelib/base64 | 1.0.1 | MIT | SDK dependency | **None** |
| fast-sha256 | 1.3.0 | Unlicense | SDK dependency | **None** |
| json-schema-to-ts | 3.1.1 | MIT | SDK dependency | **None** |
| standardwebhooks | 1.1.1 | MIT | SDK dependency | **None** |
| ts-algebra | 2.0.0 | MIT | SDK dependency | **None** |

**Inside the executables:** the Node.js 22 runtime (the latest 22.x release when the executable is
built, so Node security releases are picked up by every build).

**Build-time only, not shipped:** esbuild 0.25.10 (bundling) and postject 1.0.0-alpha.6 (making
the executables), both **0 known vulnerabilities**; GitHub Actions `actions/checkout`,
`actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact` (v4) and
`softprops/action-gh-release` (v2).

**How it is checked:** Checkmarx One SCA on every scan above (0 findings), and `npm audit` on
each release's own lockfile (0 vulnerabilities in 1.0.0, 1.1.0, 1.2.0, 1.2.1, 1.3.0 and
1.3.1). From now on the release workflow runs `npm audit` and stops the release on any
high or critical vulnerability.

## Performance

10,000 repositories per scenario, on a 4-vCPU, 16 GB Linux machine with Node 22.22, against the
GitHub-compatible mock API (no network). Reproduce with `node bench/bench.js`; the method is in
[BENCHMARKS.md](BENCHMARKS.md).

| Scenario | 1.1.0 | 1.3.0 |
|---|--:|--:|
| API engine: repositories measured / failed | 10,000 / **0** | 10,000 / **0** |
| API engine: requests (deliberately failed) | 47,525 (755) | 47,451 (681) |
| API engine: time | 74 s | **44.5 s** |
| API engine: throughput | 135 repos/s | **225 repos/s** |
| API engine: peak memory | 310 MB | 299 MB |
| Token sent to the download host | 0 times | 0 times |
| Git engine: repositories measured / failed | 10,000 / **0** | 10,000 / **0** |
| Git engine: time | 9.3–12.7 min | **5.2 min** (32 repos/s) |
| Git engine: peak memory | 138–194 MB | 145 MB |
| Report: build / write all formats | 0.33 s / 3.3 s | **0.12 s / 1.8 s** |
| Line counting, one core | 77–110 MB/s | **132 MB/s** |
| HTML report with 10,000 rows in Chromium | loads in 0.57 s | loads in 0.57 s (not re-measured) |

1.0.0 was not benchmarked at this scale; 1.2.0 and 1.2.1 changed no measuring code.
