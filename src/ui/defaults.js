// The web app's starting settings when there is no configuration file yet: the configuration the
// team shared (engine, scan window, Fusion models and pricing, a GitHub connection signed in through
// the browser). Everything is editable on the page and saved to cloc-fusion.config.json.
export const UI_DEFAULTS = {
  "engine": "auto",
  "windowDays": 365,
  "concurrency": 8,
  "discoveryConcurrency": 8,
  "repoTimeoutMinutes": 30,
  "maxArchiveBytes": 4294967296,
  "includeArchived": true,
  "includeForks": false,
  "includeMerges": false,
  "maxFileBytes": 2097152,
  "locBasis": "code",
  "countCategories": [
    "code",
    "markup",
    "iac"
  ],
  "exclude": [],
  "include": [],
  "fusion": {
    "periodMonths": 12,
    "combine": "higher",
    "defaultScans": 1,
    "models": [
      {
        "id": "model-1",
        "name": "haiku",
        "creditsPer10k": 1.5
      },
      {
        "id": "model-2",
        "name": "opus 4.7",
        "creditsPer10k": 2.5
      }
    ],
    "byFrequency": {},
    "byCriticality": {}
  },
  "totals": {
    "extraPercent": 20,
    "bundleCredits": 10000
  },
  "overrides": {},
  "connections": [
    {
      "provider": "github",
      "auth": {
        "method": "gh-cli"
      },
      "name": "cxsmtp-git",
      "orgs": [
        "@me"
      ]
    }
  ]
};
