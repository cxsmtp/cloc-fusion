# Security

cloc-fusion reads source code metadata with your platform tokens, so it is built to keep those
tokens safe. It also treats everything that comes back from a platform as untrusted: API answers,
archives, repository contents, and report files fed back in with `--resume` or `price`.

**Report a vulnerability** by opening a private security advisory on this repository
(*Security → Report a vulnerability*). Don't open a public issue.

## What it does and doesn't do

- It **reads**: it lists organizations and repositories, downloads the default branch (a shallow
  clone or an archive), and reads commit metadata. It never writes to your platforms, never pushes,
  and never changes settings.
- It **estimates**: it counts lines and commits and works out Fusion credits. It does not scan code
  for vulnerabilities and runs no code from the repositories it reads.
- It **keeps data local**: reports are files on your machine. The only optional outbound call
  besides your platforms is `ai-plan`, which sends report data to the Anthropic API when you run it.
  Use `--anonymize` to replace names with salted hashes first.

## Protections

### Tokens
| Protection | Where |
|---|---|
| Tokens are referenced by default (an environment variable or a password manager command), not written to disk. A token stored in the config file is written to a new owner-only file that is then renamed into place. | `src/config.js` |
| The API client sends credentials only to the connection's API origin, plus a short list of known hosts: Azure DevOps' profile service and bitbucket.org downloads. API calls or pagination links to any other host are refused. | `src/http.js` `send()` |
| Redirects are followed by hand. Credentials are dropped on any redirect to another host (e.g. GitHub's archive download host), and https → http downgrades are refused. | `src/http.js` |
| Git gets the token through `GIT_CONFIG_*` environment variables, never on a command line (`ps`). The header is scoped to the repository's own origin (`http.<origin>/.extraHeader`), and git is told not to follow redirects, so the header can't travel with one. | `src/git.js` `gitEnv()` |
| Credentials are never sent over plain http unless you configured an http server yourself. | `src/git.js` |
| Clone URLs with embedded credentials (`https://user:token@…`) are rejected at load time, so they can't reach reports or process lists. | `src/config.js` |
| Reports and checkpoints carry no secrets: settings are written through `redactConfig`, and error messages never include URLs with credentials. | `src/config.js`, `src/scan.js` |
| The built-in sign-in helpers (`gh auth token`, `az account get-access-token`) run without a shell. | `src/config.js` |

### Git
| Protection | Where |
|---|---|
| Clone URLs must parse as https (or http/file for servers you configure). They are passed after `--`, so a URL can never be read as an option such as `--upload-pack`. | `src/git.js` |
| Clone hosts must belong to the connection: github.com or your Enterprise Server host, your GitLab host, dev.azure.com / *.visualstudio.com / your server, bitbucket.org / your Data Center host. | `src/scan.js` `allowedHostsOf()` |
| `GIT_ALLOW_PROTOCOL` allows https only (file for local, http for http servers), so `ext::`, ssh and other transports are blocked. `GIT_SSH_COMMAND` and `GIT_CONFIG_PARAMETERS` are cleared, and prompts are disabled. | `src/git.js` |
| Branch names from APIs are validated: no leading `-`, `..`, control characters or other characters git rejects. | `src/git.js` `safeBranch()` |
| Clones are bare, with no checkout and no hooks, so nothing from a repository is executed. They live in a private random temp folder for each run and are deleted afterwards. | `src/git.js`, `src/scan.js` |

### Hostile input
| Protection | Where |
|---|---|
| API answers are capped at 64 MB and pages per list are bounded (no endless pagination). | `src/http.js`, providers |
| Archives are never extracted to disk; entry names are only text. Decompression is bounded by `maxArchiveBytes` for tar.gz and zip. Zip entries that share data, too many entries, bad offsets and zip64 are refused. Metadata entries are capped at 1 MB. | `src/archive.js` |
| Files over `maxFileBytes`, binaries and paths over 4,096 characters are skipped. Globs compile to a linear form, so hostile paths can't trigger regex backtracking. | `src/loc.js`, `src/languages.js` |
| HTML report: all data is escaped, embedded JSON escapes `<`, and only http(s) links are rendered (no `javascript:`). No external resources are loaded. | `src/report/html.js` |
| CSV: cells starting with `= + - @` are defused unless they are plain numbers. Markdown: cells are escaped. | `src/report/csv.js`, `src/report/text.js` |
| Accumulators fed from report files are prototype-free, so a crafted `--resume` file can't pollute prototypes. | `src/scan.js`, `src/loc.js` |
| Text from APIs and git is printed without terminal control characters. | `bin/cloc-fusion.js` |

### Supply chain
- **Zero runtime dependencies.** The tool uses only Node's standard library. The Anthropic SDK is optional, used only by `ai-plan`, and bundled into the standalone executables.
- The standalone executables are built in CI from this repository, and releases publish SHA-256 checksums.
- Workflows run with `contents: read`; only the release job can write, to publish the release.

## Verification

- `test/security.test.js` and `test/apiengine.test.js` pin every protection above with a
  regression test. They cover option injection, disallowed hosts and transports, redirect and
  http leaks, prototype pollution, escaping, response caps, decompression bombs and hostile paths.
  CI runs them on Windows, macOS and Linux.
- The mock API in `bench/` serves archives from a second "download" origin and fails the
  benchmark if that origin ever receives a token.
- Version 1.1.0 was reviewed by hand and by an independent audit. Every confirmed finding was
  fixed (see [CHANGELOG.md](CHANGELOG.md#security)). It is also scanned with Checkmarx One
  (SAST, SCA, KICS and secret detection).

## Accepted risks

- **Your configuration file is trusted.** A `"command"` token source runs the command you wrote,
  through your shell. Treat a configuration file from someone else like a script and read it first.
- **On Windows, the config file's owner-only mode isn't enforced** by the file system. Prefer
  environment variables or a command there.
- **Azure DevOps Services clones may go to any `*.visualstudio.com` host**, which is Microsoft's
  infrastructure for organizations.
- **`ai-plan` sends repository names** (or salted hashes with `--anonymize`) and figures to the
  Anthropic API. It never sends tokens or code.
