# Codex build prompt

Build the complete **SGP Survey Explorer** web application described in `PRODUCT_SPEC.md`, using `question-manifest.json` as the machine-readable source of truth and `data/source/GEF_SGP_Survey_Responses_English.xlsx` as the input dataset.

## Required delivery

Produce a production-ready React + TypeScript application using Vite and Apache ECharts. It must build to static assets and deploy cleanly to Cloudflare Pages or another static host. Use a clean component architecture, strict TypeScript, automated tests and an explicit build-time Excel-to-JSON compilation pipeline.

Do not stop after scaffolding or a visual mockup. Implement the data compiler, all four stakeholder tabs, all 96 questions, question navigation, compatible chart cycling, filters, radar/matrix behavior, qualitative response reader, data tables, shareable URL state, exports, responsive behavior, accessibility, normalization QA and public/internal publication modes.

## Source-of-truth rules

1. Read `PRODUCT_SPEC.md` in full before editing.
2. Preserve the workbook and specification files.
3. Drive the interface from `question-manifest.json`; do not hardcode a separate question list in UI components.
4. Reconcile the compiled row totals to 38 Country Team, 168 Grantee Partner, 17 Implementing Agency and 57 Steering Committee responses.
5. Reconcile the manifest to exactly 96 numbered questions.
6. Keep Q14, Q17, Q65, Q67, Q86, Q94 and Q95 grouped as matrix questions with radar as the default chart.
7. Treat qualitative questions as searchable response readers, without word clouds or quantitative charts.
8. Never split multi-select cells blindly on commas. Implement question-specific option dictionaries and longest-match parsing because several valid option labels contain commas.
9. Generate `data/qa/normalization-report.json` and fail the production validation task if material unmatched categories remain.
10. Never ship timestamps in the public data bundle.

## Technical baseline

- React + TypeScript + Vite
- React Router or an equivalent accessible client-side router
- Apache ECharts with tree-shaken chart/component imports where practical
- A small explicit state layer; use URL parameters as the shareable state contract
- ExcelJS or another actively maintained Node reader used only in the build pipeline
- Vitest and Testing Library for unit/integration tests
- Playwright for end-to-end and representative visual tests
- ESLint and Prettier
- No runtime database for version 1

Use the current stable package versions compatible with each other. Commit a lockfile.

## Implementation checkpoints

### 1. Data compiler

- Read all four named sheets.
- Compile normalized tab-specific JSON bundles.
- Implement canonical aliases, ordinal scales, matrix scales, country codes, branch eligibility and denominator logic.
- Produce public and internal bundles separately.
- Add fixture-based tests for translated and punctuation variants.

### 2. App shell and routing

- Implement the four stakeholder tabs and direct routes.
- Add the sectioned question navigator and sticky previous/next controls.
- Restore question, filters and chart type from the URL.
- Persist the last visited question per tab in session storage.

### 3. Visualization adapters

- Implement a common chart adapter contract.
- Build ranked bar, ordered bar, lollipop, dot plot, donut, treemap, world map, radar, heatmap and diverging stacked charts plus the accessible data table.
- Enforce the question-specific compatibility sets from the manifest.
- Show count, percentage, denominator and scoring details in tooltips and tables.

### 4. Filters and qualitative reader

- Implement the tab-specific filters in the specification.
- Combine filters with AND across dimensions and OR within dimensions.
- Update chart, n, table and URL atomically.
- Build the response reader with search, sorting, density, pagination/virtualization, copy and approved CSV export.

### 5. Privacy, accessibility and QA

- Enforce `VITE_DATA_MODE=public|internal` at build time.
- Suppress all public outputs and exports when the filtered base falls below the configured k threshold.
- Reach WCAG 2.2 AA for primary flows.
- Provide keyboard operation and exact data for every chart.
- Run the acceptance criteria in `PRODUCT_SPEC.md` and document the results.

## Visual standard

Use the editorial research-dashboard direction, design tokens and responsive layout specified in `PRODUCT_SPEC.md`. The experience should feel polished and purpose-built, with generous spacing, strong question typography, restrained motion and legible long-label charts. Avoid generic admin-dashboard styling.

## Completion output

When complete, provide:

- working source code;
- a successful production build;
- a local/preview URL;
- normalization QA summary;
- test summary;
- deployment instructions for Cloudflare Pages;
- a short list of any unresolved data-owner decisions, especially ambiguous aliases or publication approval for qualitative responses.

