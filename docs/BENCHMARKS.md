# Benchmarks

**The target:** 10,000 repositories, tens of thousands of API requests, failures along the way, and
no repository lost.

**Result:** both engines measured all 10,000 repositories with **0 failures**. The API engine got
through 47,525 requests, 755 of them deliberately failed. Memory stayed under about 310 MB.

## Results

10,000 repositories per scenario, cloc-fusion 1.1.0, Node 22.22, 4 vCPUs, 16 GB RAM, Linux.

| Scenario | Repos measured | Failed | Time | Throughput | Peak memory |
|---|--:|--:|--:|--:|--:|
| **API engine**: discovery + commit history + archive per repo, 2% of requests failing (429/502) | 10,000 / 10,000 | **0** | 74 s | 135 repos/s · 644 requests/s | 310 MB |
| **Git engine**: blob-less shallow clone + history + file contents per repo | 10,000 / 10,000 | **0** | 9.3–12.7 min | 13–18 repos/s | 138–194 MB |
| **Report**: build, then write HTML + CSV + JSON + Markdown for 10,000 repos | | | 0.33 s build · 3.3 s total | | 179 MB |
| **Line counting** (one core, comment- and string-heavy JavaScript) | | | | 77–110 MB/s (about 3–4 M lines/s) | 96 MB |
| **HTML report** with 10,000 rows in Chromium | | | load 0.57 s · sort 0.28 s · filter 0.31 s | | |

**About the API engine run:**
- It made 47,525 HTTP requests: organization and repository listings, about 3 commit pages per
  repository, and an archive download through a redirect.
- 755 requests (1.6%) were answered 429 or 502 on purpose. Every one was retried, and no
  repository failed.
- The archive host received the token **0 times**. It is a separate origin, like codeload.github.com.

**About the git engine run:**
- It spawns about 7 git processes per repository, so it is CPU-bound on this 4-core machine.
  The spread between the two runs is contention from other work on the box.
- It ran with `concurrency` 8. On real networks, where waiting dominates, a higher concurrency
  (16–32) pays off.

**Output sizes for 10,000 repositories:** HTML 3.8 MB, CSV 1.9 MB, JSON 15.7 MB, Markdown 1.0 MB.

## What it means for a real estate

Your platform's API rate limit and network are the bottleneck, not cloc-fusion.

| Estate | Git engine | API engine |
|---|---|---|
| 500 repos | A few minutes | 1–2 minutes |
| 10,000 repos | About 15–60 minutes, depending on repository sizes and bandwidth | Bound by rate limits: GitHub allows 5,000 requests an hour per token, so 10,000 repos at about 4–5 requests each take several hours with one token |

**For estates of thousands of repositories, use the git engine** (the default when git is
installed): clones don't count against API rate limits. Use the API engine for quick runs on
machines without git, or split organizations across several tokens.

## How it's measured

Everything is reproducible: `node bench/bench.js` runs all scenarios at 10,000 repositories, and
`--repos 1000` makes a quicker run. No network is used:

- **`bench/mock-github.js`**: a GitHub-compatible API with any number of organizations and
  repositories.
  - It paginates like GitHub (Link headers) and serves commit lists.
  - Tarballs are served through a 302 redirect to a second origin that counts any `Authorization`
    header it receives (the benchmark fails if that count is above 0).
  - It answers a configurable share of requests with 429 (`Retry-After: 0`) or 502.
  - Repositories cycle through three profiles: busy (5 files, 7 commits a week), medium (12,000
    lines, 2 a week) and dormant. Totals are therefore predictable and checked in tests.
- **Git scenario:** three local repositories (300, 60 and 0 commits in the window; 30–100 files),
  exposed as 10,000 distinct `file://` remotes. Every one is cloned, its history read and its files
  counted.
- **Peak memory** is the process's RSS, sampled every 100 ms.

The CI workflow runs the benchmark at 1,000 repositories on every push and posts the table to the
run summary.

## Optimizations behind these numbers (1.1.0)

| Change | Effect |
|---|---|
| Single-pass line counter: no per-line strings, regex jump over plain code, cached comment ends | About 3× faster counting, linear in file size even for huge files |
| Blob-less shallow clones; only the files that count are fetched, in one batch | Downloads only the window's history plus the counted files, never the whole repository |
| Globs and overrides compiled once instead of per file or per repository | Removes per-file regex compilation |
| Organizations listed in parallel (8); Bitbucket Data Center default branches in parallel | Discovery scales with organization count |
| HTTP client: keep-alive, a per-client concurrency limit, retries with backoff and `Retry-After` | 644 requests/s through 1.6% injected failures |
| Archives streamed and parsed in memory (tar.gz), never extracted | No disk I/O for the API engine except Azure's zip |
| HTML table paged (250 rows) and sparklines drawn as one path each | 10,000-row report loads in 0.6 s and sorts in 0.3 s |
