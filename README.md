# Bobber the Water Safety Dog — Tulsa District

[Live site](https://usaceswosu.github.io/Tulsa-District-Water-Safety-Web-Platform/)

A responsive, static website that brings together Bobber the Water Safety Dog resources and water safety information for the U.S. Army Corps of Engineers Tulsa District. It consolidates the Bobber program page and cartoons/graphics library into one searchable, accessibility-minded experience.

New maintainers: read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the runtime design and [`CONTRIBUTING.md`](CONTRIBUTING.md) for change recipes. [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md) tracks the remaining external reviews.

## Run locally

Requires Node 22+ for the dev server and tests. There is no build step: the repository is the deployable site.

```bash
npm ci
npm run serve
# http://127.0.0.1:4173/
```

The reader, offline shell, and GitHub Pages behavior are designed for a real HTTP origin, so use the local server rather than opening `index.html` from disk.

The links to YouTube, USACE, Recreation.gov, and other official sources are outbound only; the site itself does not need them to render. Video playback and live lake information require visiting those sources.

## Quality checks

```bash
npm run check       # versions, globals, content, translations, metadata, URL/schema/sitemap, QR/pack, HTML, CSS/budgets, partials, precache, PDFs
npm test            # Chromium, Firefox, WebKit + Pixel/iPhone mobile smoke tests
npm run check:live  # post-deploy smoke test against the public URL
```

The catalog/link integrity check is cross-platform (`npm run check:site`). CI also runs `scripts/check-site.ps1` with PowerShell as a second opinion, alongside Lighthouse, a live deployment smoke test, and a scheduled link check.

## Asset versions

Every local stylesheet/script uses a shared `?v=` value. Do not edit those values by hand:

```bash
npm run bump:version -- 20261121a
```

The command updates both pages, the classroom-pack link, `sitemap.xml`, and `precache.json`, then verifies consistency. Run `npm run check` afterward.

## Change the public URL

`site.config.json` is the source of truth for the public base URL. When the site moves to a custom domain or another path:

```bash
npm run update:site-url -- https://example.gov/bobber
npm run bump:version -- 20261121a
```

The first command rewrites metadata, robots, poster URLs, README links, sitemap, QR codes, and the classroom pack, then verifies consistency. The version bump refreshes client caches for the regenerated QR/pack assets.

## Publish with GitHub Pages

1. Push the site files to the GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder, then choose **Save**.

GitHub Pages serves the files directly. Internal links are relative to the project root; the final address depends on the publishing account and repository name (project pages usually follow `https://<owner>.github.io/<repository>/`).

## Project structure

- `index.html` — kid-facing home: safety reminders, cartoons, AR, game, printable library, reader.
- `grown-ups.html` — lake planning, the district app, classroom materials, reader.
- `accessibility.html` / `poster.html` / `404.html` — self-contained statement, QR poster, and not-found pages.
- `partials/` — shared header, footer, and reader markup copied into both main pages.
- `styles.css` — design tokens, components, responsive layouts, dark theme, and print rules (section map at the top).
- `data/resources.js` — printable catalog, Spanish display titles, and optional reviewed metadata.
- `data/resource-review.csv` — district review template for languages, grades, and bilingual descriptions.
- `data/pdf-meta.js` — generated page counts, print sizes, preview paths, and preview sizes.
- `data/content.js` — home-page tips, pal cards, checklist feedback, and quiz questions.
- `data/translations.js` — Spanish interface dictionary.
- `scripts/main.js` — page controller: library, language/theme, navigation, PWA banners, game/certificate.
- `scripts/pdf-reader.js` — in-page reader, fallback viewer, TOC, zoom, and print.
- `sw.js` + `precache.json` — versioned offline shell and runtime caching.
- `site.config.json` — single source of truth for the public site URL.
- `scripts/` — maintenance, validation, versioning, URL/schema/sitemap, QR/pack, preview, and live-smoke tools.
- `tests/` — Playwright suites by feature, run in Chromium, Firefox, and WebKit.
- `.github/workflows/` — static checks, Lighthouse, live deployment smoke test, and scheduled link check.
- `assets/` — artwork, thumbnails, self-hosted PDFs, previews, QR codes, and the classroom ZIP.

## Updating resources

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full recipe. In short: add the print PDF and thumbnail, add a `data/resources.js` entry and Spanish title, run `npm run update:pdf-meta`, optionally generate a reader preview, then bump the version and run the checks.

Reviewed language, grade, and bilingual description metadata is optional until district approval. Fill `data/resource-review.csv`, copy approved values into `data/resources.js`, and run `npm run check:metadata`. Badges and language/grade filters appear automatically once values exist.

External video and official program links point to YouTube and USACE websites. The safety reminders are educational and do not replace local rules, adult supervision, or professional guidance.

## Before official publication

The Spanish interface and water-safety content are draft translations and need review by a fluent Spanish speaker and a district water-safety reviewer. The resource titles are translated for navigation, but linked PDFs remain the original files. See [CONTENT_REVIEW.md](CONTENT_REVIEW.md) for the content, link, branding, and accessibility review checklist. This site has not yet had a formal Section 508 / WCAG conformance review.
