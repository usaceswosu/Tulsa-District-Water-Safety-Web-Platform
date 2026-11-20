# Tests

Playwright runs against the local server configured in `playwright.config.js` in Chromium, Firefox, and WebKit.

| File | Covers |
| --- | --- |
| `home.spec.js` | Metadata, language/title updates, theme, tips, filters, keyboard shortcuts, responsive layout, navigation |
| `library.spec.js` | Card rendering/filtering, preview reader, print actions, lifecycle recovery, TOC, catalog metadata |
| `game.spec.js` | Quiz flow, focus management, certificate print lifecycle |
| `accessibility.spec.js` | Axe scans, 320px reflow, dark-mode print, forced colors, poster print |
| `offline.spec.js` | Service-worker install, offline root, query-tolerant navigation, encoded thumbnails |
| `helpers.js` | Shared console/page-error collector |

Run everything:

```bash
npm test
```

Run one file, one browser, or grep a test:

```bash
npx playwright test tests/library.spec.js
npx playwright test --project=firefox
npx playwright test -g "offline shell"
```

If a failure only appears in CI, run with one worker and a fresh server:

```bash
CI=true npx playwright test --workers=1
```
