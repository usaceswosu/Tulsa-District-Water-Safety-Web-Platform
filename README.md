https://usaceswosu.github.io/Tulsa-District-Water-Safety-Web-Platform/

# Bobber the Water Safety Dog — Tulsa District

A responsive, static website that brings together Bobber the Water Safety Dog resources and water safety information for the U.S. Army Corps of Engineers Tulsa District. It consolidates the Bobber program page and cartoons/graphics library into one searchable, accessibility-minded experience.

## Run locally

No build tools or server-side code are required. Open `index.html` in a browser, or serve this folder with any static web server. Styles, scripts, fonts (system fonts), artwork, and PDFs load from the repository; there are no CDN or hosted font dependencies.

The links to YouTube, USACE, Recreation.gov, and other official sources are outbound links only. The site itself does not need those services to load; video playback and live lake information do require visiting the respective source.

## Publish with GitHub Pages

1. Push the site files to the GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder, then choose **Save**.

The site has no build step. GitHub Pages serves these files and folders directly. Internal asset links are relative to the project root. The final Pages address depends on the publishing account and repository name; find it under **Settings → Pages** (project pages usually follow `https://<owner>.github.io/<repository>/`).

## Project structure

- `index.html` — semantic page structure and script/style loading order.
- `styles.css` — design tokens, components, responsive layouts, and light/dark themes.
- `data/resources.js` — resource metadata and Spanish display titles. Keep the official filenames exactly as stored in `assets/`.
- `data/translations.js` — Spanish interface copy, separated from page behavior.
- `scripts/main.js` — resource rendering, search/filter behavior, language/theme controls, navigation, and the keyboard easter egg.
- `scripts/check-site.ps1` — verifies resource files, local links, duplicate IDs, and key accessibility hooks.
- `.github/workflows/site-checks.yml` — runs the static integrity check for pushes and pull requests.
- `assets/bobber-logo.png` — site brand image.
- `assets/graphics/` — official thumbnail artwork and retained source graphics.
- `assets/pdfs/` — self-hosted original resource and program PDFs.

## Updating resources

Add a PDF to `assets/pdfs/` and its preview image to `assets/graphics/`, then add a record to `resources` in `data/resources.js` with a `pdfs/`-prefixed file path. Add its Spanish display title to `resourceTitlesEs` there if needed. Keep source filenames intact; the app URL-encodes spaces and punctuation when creating links. Put page-interface translations in `data/translations.js` and interactions in `scripts/main.js`.

To run the integrity check locally on Windows: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-site.ps1`.

External video and official program links point to YouTube and USACE websites. The safety reminders are educational and do not replace local rules, adult supervision, or professional guidance.

## Before official publication

The Spanish interface and water-safety content are draft translations and need review by a fluent Spanish speaker and a district water-safety reviewer. The resource titles are translated for navigation, but linked PDFs remain the original files. See [CONTENT_REVIEW.md](CONTENT_REVIEW.md) for the content, link, branding, and accessibility review checklist. This site has not yet had a formal Section 508 / WCAG conformance review.
