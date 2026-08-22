# SGP Survey Explorer specification package

This package defines a build-ready web application for exploring the supplied GEF SGP Knowledge and Learning Platform survey.

## Contents

- `PRODUCT_SPEC.md` — full product, interaction, visualization, data, privacy and acceptance specification.
- `question-manifest.json` — machine-readable configuration for all four stakeholder groups and 96 numbered questions.
- `CODEX_BUILD_PROMPT.md` — a direct build instruction that can be given to Codex with this folder and the source workbook.

## Source workbook

Place the workbook at:

```text
data/source/GEF_SGP_Survey_Responses_English.xlsx
```

The source contains:

| Worksheet | Respondents | Questions |
|---|---:|---:|
| Country Team | 38 | Q2–Q29 |
| Grantee Partners | 168 | Q30–Q63 |
| Implementing Agencies | 17 | Q64–Q71 |
| Steering Committee | 57 | Q72–Q97 |
| **Total** | **280** | **96** |

## Recommended starting order

1. Read `PRODUCT_SPEC.md` completely.
2. Load `question-manifest.json` as the source of truth for question grouping and chart compatibility.
3. Follow `CODEX_BUILD_PROMPT.md`.
4. Build and review the normalization QA report before accepting chart totals.

The source workbook should not be published directly. The compilation pipeline must remove timestamps and apply the privacy rules in the product specification.

## Run the explorer

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

The development server opens the public-data build by default. The workbook is compiled before every production build:

```bash
npm run build
npm run preview
```

Useful verification commands:

```bash
npm run compile:data
npm run validate:data
npm test
npm run lint
npm run test:e2e
```

## Publication modes

- `VITE_DATA_MODE=public npm run build` (default) ships no timestamps or source row identifiers. All qualitative responses in the supplied workbook are approved for publication and included. Any filtered base below `k=5` is suppressed in the chart, table, tooltip, and exports.
- `VITE_DATA_MODE=internal npm run build` includes the same approved qualitative answers and exact small counts. Deploy this mode only behind controlled access.
- Set `PUBLIC_K` while compiling to change the public disclosure threshold.

Generated public bundles live in `public/data/public/`. Internal bundles are generated locally under `public/data/internal/` and are git-ignored. Normalization details and alias counts are recorded in `data/qa/normalization-report.json`.

## Cloudflare Pages

Create a Pages project for this repository with:

- Build command: `VITE_DATA_MODE=public npm run build`
- Output directory: `dist`
- Node version: `22`

The included `public/_redirects` file provides the SPA fallback required for direct question URLs. Do not publish the source workbook or an internal-mode build.

## GitHub Pages

Every commit pushed to `main` automatically builds and deploys the public explorer through `.github/workflows/deploy-pages.yml`. The workflow reads the configured Pages base path from GitHub, validates the committed public data, creates a GitHub Pages fallback for direct question links, and publishes `dist/`.

For this repository, the site URL is:

```text
https://ben-keller.github.io/sgpsurvey/
```

In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions** once. Future commits to `main` require no manual deployment step. The workflow can also be run manually from the Actions tab.

The source workbook under `data/source/` is intentionally git-ignored and is never uploaded to GitHub Pages. When the survey data changes, compile and validate it locally, then commit the updated `public/data/public/`, `public/data/manifest.json`, `question-manifest.json`, and normalization report:

```bash
npm run compile:data
npm run validate:data
```

To reproduce the Pages build locally:

```bash
BASE_PATH=/sgpsurvey/ VITE_DATA_MODE=public npm run build:pages
```
