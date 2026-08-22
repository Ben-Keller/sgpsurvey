# SGP Survey Explorer

## Build-ready product specification

**Working title:** SGP Survey Explorer  
**Source dataset:** `GEF_SGP_Survey_Responses_English (3).xlsx`  
**Dataset shape:** 280 respondents, four stakeholder groups, 96 numbered questions  
**Primary use:** Explore every survey question sequentially, change compatible visualizations, filter responses, and review qualitative answers in one coherent web application.

---

## 1. Product definition

SGP Survey Explorer is a responsive, public-web-ready survey analysis application. It converts the four worksheets in the source workbook into four stakeholder tabs:

1. Country Teams — Q2–Q29, 38 responses
2. Grantee Partners — Q30–Q63, 168 responses
3. Implementing Agencies — Q64–Q71, 17 responses
4. Steering Committees — Q72–Q97, 57 responses

Within a tab, the user advances through questions one at a time. Each question has a purpose-built presentation:

- categorical and multiple-choice questions use ranked visual comparisons;
- ordered questions preserve the intended response order;
- matrix questions remain grouped and use a radar chart by default;
- qualitative questions use a searchable response reader instead of a chart;
- every quantitative question exposes its underlying counts, percentages, valid response base and compatible alternative chart types.

The interface should feel like reading a guided analytical report with the flexibility of a dashboard. It should avoid the density and visual fragmentation of a conventional business-intelligence dashboard.

### Core product promise

> Select a stakeholder group, move question by question, and immediately understand the distribution of responses without manipulating the original spreadsheet.

---

## 2. Goals and exclusions

### Goals

- Make all 96 questions accessible without presenting 96 charts at once.
- Preserve the four distinct respondent journeys represented by the workbook tabs.
- Select a statistically appropriate default chart for every question type.
- Let users cycle through other compatible chart forms without allowing misleading combinations.
- Support filtering by response language and the relevant profile dimensions available within each stakeholder group.
- make denominators, missing responses and branching behavior transparent.
- Keep matrix questions together as one analytical unit.
- Make open-text responses easy to scan, search, filter and export.
- Support static hosting, fast loading, shareable URLs and reproducible builds from the workbook.
- Provide a controlled public-data mode that prevents accidental disclosure of sensitive or identifying response combinations.

### Out of scope for version 1

- Editing survey responses in the browser.
- Writing changes back to Google Forms or the Excel workbook.
- Automatic generative-AI summaries of qualitative responses.
- User accounts, comments or collaborative annotations.
- Cross-survey time-series analysis.
- A general-purpose survey builder.
- Uploading arbitrary workbooks through the production UI.

The data compiler should remain modular enough to support a future workbook-upload workflow, but that workflow should not delay the first release.

---

## 3. Users and principal tasks

### Primary users

- SGP global and country programme teams reviewing consultation findings.
- UNDP, FAO and Conservation International stakeholders.
- Platform designers translating findings into Knowledge and Learning Platform requirements.
- Researchers and consultants preparing analytical summaries.
- Decision-makers who need a legible question-level view without handling raw data.

### Principal tasks

1. Select one of the four stakeholder groups.
2. Understand how many people responded and which filters are active.
3. Advance to the next or previous question.
4. Jump directly to a question from a sectioned question navigator.
5. Interpret the default visualization and exact underlying values.
6. Cycle through appropriate alternative chart types.
7. Filter the current tab by language, country, agency or relevant respondent characteristics.
8. Reset filters and restore the full response base.
9. Review all available qualitative answers together.
10. Copy a shareable link that opens the same tab, question, filters and chart.
11. Download the current question data as CSV or the current chart as PNG/SVG.

---

## 4. Information architecture

### Routes

- `/` redirects to `/country-teams/q2`
- `/country-teams/q2`
- `/grantee-partners/q30`
- `/implementing-agencies/q64`
- `/steering-committees/q72`
- `/about` explains the survey, denominators, methods and privacy treatment

The route carries the selected tab and question. Query parameters carry chart and filter state:

```text
/grantee-partners/q43?chart=treemap&language=French&country=Togo
```

Use readable slugs for public links. When a filter value contains spaces or punctuation, encode it normally in the URL. Invalid or unavailable filters should be ignored gracefully and identified through a non-blocking notice.

### Main screen hierarchy

1. **Global header**
   - product title;
   - “About the survey” link;
   - “Share view” action;
   - optional SGP/partner brand lockup supplied later.
2. **Stakeholder tab bar**
   - four tabs with respondent counts;
   - persists at the top during vertical scrolling.
3. **Context and filter bar**
   - active respondent base;
   - filter button/drawer;
   - active-filter chips;
   - reset action.
4. **Question workspace**
   - question navigator;
   - question header and metadata;
   - visualization or response reader;
   - exact-data panel;
   - chart switcher and export actions.
5. **Sticky question navigation**
   - previous question;
   - progress, such as `8 of 28`;
   - next question.

### Desktop layout

- 240–280 px left question navigator.
- Flexible central content column, max width approximately 1,200 px.
- Main chart area at least 680 px wide when the navigator is open.
- Question navigator can collapse to an icon rail.
- Filters open in a right-side drawer so the chart remains visible.

### Tablet and mobile layout

- Stakeholder tabs become a horizontally scrollable tab bar.
- Question navigator opens as a full-height drawer.
- Filters open as a bottom sheet or full-screen panel.
- Chart switcher becomes a compact dropdown with previous/next chart arrows.
- Radar charts should use shorter axis labels with an accessible item list underneath.
- Response-reader cards use one column.
- Sticky previous/next controls remain reachable above the mobile safe area.

---

## 5. Question navigation

### Sequential behavior

- Opening a stakeholder tab loads its first question.
- Previous and Next actions update the route without a full reload.
- Left/right arrow keys navigate questions unless focus is inside a form control, data table or qualitative response.
- When the question changes, scroll the question workspace to the top and move focus to the question heading.
- Preserve filters when moving between questions inside one stakeholder tab.
- When switching stakeholder tabs, retain only filters that exist in the destination tab. Response language may persist across all four tabs.
- Remember the last question visited in each tab for the current browser session.

### Question navigator

Group questions into the following collapsible sections:

| Stakeholder group | Sections |
|---|---|
| Country Teams | Profile and access; Proposal development and review; Implementation support and knowledge sources; Learning and knowledge sharing |
| Grantee Partners | Profile and proposal experience; Proposal development; Project implementation; Closure and learning |
| Implementing Agencies | Profile; Content, processes and platform features; Resources, adoption and sustainability |
| Steering Committees | Profile and working arrangements; Proposal review and country strategy; Monitoring, capacity and governance; Platform content and features |

Each navigator row shows the question number and a truncated prompt. Use a small icon to distinguish:

- categorical question;
- multi-select question;
- ordered question;
- grouped matrix question;
- qualitative response question.

The active question receives a strong visual marker. Completed/visited styling is optional and should remain subtle because the user is exploring rather than completing a form.

---

## 6. Question workspace

### Question header

Display:

- section label;
- question number;
- full question text;
- question-type label, such as “Multiple selection” or “Rating matrix”;
- `n = valid responses`;
- `base = eligible respondents` when a branch condition applies;
- a short note when percentages can exceed 100%;
- active-filter summary.

Examples:

```text
Q43 · Proposal development
Which types of information support might have helped you better prepare or refine your proposal more easily?
Multiple selection · n=163 valid responses · 168 respondents in filtered group
Respondents could select more than one option; percentages may total more than 100%.
```

### Empty and suppressed states

- If the filtered result has zero valid responses, show a clear empty state and a Reset filters action.
- In public mode, any filter combination below the disclosure threshold displays “Insufficient responses for this filtered view.” Do not render counts, percentages, raw rows or tooltips.
- If a question has no responses because of branching, explain the branch condition.
- Never treat blank cells as zero, “No,” or “Never.”

---

## 7. Visualization grammar

Every question configuration declares one default visualization and a limited set of compatible alternatives. The chart switcher cycles only through that set. The selected chart type is stored in the URL.

### A. Single-choice categorical questions

Examples: GEF agency, device, proposal status, sector affiliation.

**Default:** ranked horizontal bar.  
**Alternatives:** donut, lollipop, treemap, data table.  
**Rules:**

- Show count and percentage together in labels or tooltips.
- Sort descending unless the answer options have a meaningful order.
- Use “Other” as a real category when present.
- Do not use a donut when there are more than seven categories; keep the option visible but disabled with an explanation, or omit it from that question’s compatible set at runtime.
- Group very small categories into “Other responses” only as an optional display setting; exact data must remain available.

### B. Multi-select questions

Examples: difficult proposal-development tasks, implementation challenges, useful support, desired content.

**Default:** ranked horizontal bar.  
**Alternatives:** lollipop, dot plot, treemap, data table.  
**Rules:**

- Denominator is the number of respondents who answered the question, not the number of selections.
- Display `respondents selecting option`, `percentage of valid respondents`, and optionally `selection share` in the data table.
- State that percentages may exceed 100%.
- Do not offer pie or donut charts because selections are non-exclusive.
- Default sort is percentage descending.

### C. Ordered or ordinal questions

Examples: years of experience, Internet reliability, confidence, clarity and review time.

**Default:** ordered horizontal bar.  
**Alternatives:** diverging bar when a natural negative-to-positive scale exists, lollipop, donut, data table.  
**Rules:**

- Preserve semantic order through explicit configuration; never alphabetize these options.
- Use a sequential color scale from weaker/lower to stronger/higher.
- Keep “Not applicable,” “Unsure” and “I don’t know” neutral and visually separated.

### D. Country distributions

**Default:** ranked horizontal bar.  
**Alternatives:** world map, treemap, data table.  
**Rules:**

- A map is an optional alternative because the response counts are often small and uneven.
- Normalize country names to ISO 3166-compatible display names before map matching.
- Always retain the bar view because it communicates exact differences more clearly.

### E. Matrix questions

The following groups must remain single questions:

- Q14 — 14 sources informing Country Team proposal review/guidance
- Q17 — 14 sources informing Country Team implementation support
- Q65 — 10 content-value ratings from Implementing Agencies
- Q67 — 9 platform-feature ratings from Implementing Agencies
- Q86 — 9 information sources informing NSC work
- Q94 — 8 content-value ratings from Steering Committees
- Q95 — 7 platform-feature ratings from Steering Committees

**Default:** radar.  
**Alternatives:** ranked horizontal bar, heatmap, diverging stacked distribution.  

#### Radar behavior

- One axis per matrix item.
- Plot the normalized mean score for the active filtered population.
- Use a 0–100 visual scale derived from the canonical 1–4 response scale:

  `normalized score = ((mean score - 1) / 3) × 100`

- Tooltip shows full item label, normalized score, original mean, valid rating count and distribution.
- Place short axis labels on the chart and show full labels in tooltips and an accessible list below.
- Maximum radius should remain constant at 100 so filtered views remain comparable.
- Do not connect an item with no scored responses as if its value were zero; show a gap/disabled axis treatment and label it “No scored responses.”
- “I don’t know,” “Not sure,” and “Inaccessible/unavailable” remain visible in distributions but are excluded from the mean score.

#### Canonical scale mappings

| Matrix family | Score 1 | Score 2 | Score 3 | Score 4 | Unscored |
|---|---|---|---|---|---|
| Frequency | Never | Rarely | Sometimes | Frequently / Often | Inaccessible, unavailable, unsure, don’t know |
| Value | Not important | Moderately valuable | Valuable | Highly / Extremely valuable | Unsure, don’t know |
| Importance | Not important | Moderately important | Important | Very important | Unsure, don’t know |

#### Alternative matrix views

- **Ranked bar:** one bar per matrix item, ordered by normalized mean. This is the clearest comparison view and should be the first alternative after radar.
- **Heatmap:** rows are matrix items; columns are the canonical response categories; cells show percentage of valid answers.
- **Diverging stacked:** response distribution by item, with weak ratings left, strong ratings right and neutral/unscored values separated.

Q67 currently contains a few composite values such as “Very important, Important.” Treat these as data-quality exceptions. Resolve them through a reviewed alias map where possible; otherwise classify them as invalid/unscored and expose their count in the method panel.

### F. Language-needs questions

Q6, Q31 and Q76 are free-form language answers but should behave as normalized multi-select questions.

**Default:** ranked horizontal bar.  
**Alternatives:** lollipop, treemap, data table.  
**Rules:**

- Match language names case-insensitively from a controlled dictionary.
- Accept separators such as comma, slash, ampersand and the words “and” or “or.”
- Preserve regional/local languages such as Khmer, Tetum, Setswana and Thimbukushu.
- Keep an “Unclassified text” bucket during data QA, but hide it from the public view once all material values are reviewed.

### G. Qualitative questions

**Default:** response reader.  
**Alternative:** compact response table.  
**No quantitative chart switcher is shown.**

The response reader contains:

- search across response text;
- active stakeholder filters;
- optional country and response-language labels when disclosure rules permit;
- sort by original workbook order, country or response language;
- Comfortable and Compact density controls;
- pagination or virtualized rendering, 20 responses per page by default;
- Expand all / Collapse all;
- Copy response action;
- CSV export of the filtered, approved qualitative responses;
- a visible count of responses and respondents with blank answers;
- no timestamps or respondent identifiers in the public client dataset.

Do not add word clouds or machine-generated themes in version 1. They obscure nuance and create an additional methodological claim. A later release may add a reviewed thematic-coding layer stored in a separate human-editable file.

---

## 8. Chart controls and interactions

### Chart switcher

Place the chart switcher above the visualization on the right. It contains:

- previous chart icon button;
- current chart name and icon;
- next chart icon button;
- dropdown listing all compatible charts;
- keyboard shortcut `C` to cycle chart types when focus is not in an input.

When changing chart type:

- animate between compatible states using restrained 200–350 ms transitions;
- retain filters, sort state and selected question;
- update the URL without reloading;
- announce the new chart type to screen readers;
- preserve consistent colors for the same categories.

### Tooltips

Every tooltip should show:

- full answer or matrix-item label;
- count;
- valid-response percentage;
- denominator;
- for matrices, mean score and distribution;
- a note when values are suppressed or excluded from scoring.

Tooltips must be reachable by keyboard and should not be the only place exact numbers appear.

### Exact-data panel

Place a collapsible `View data` panel below every quantitative chart. It contains an accessible table with:

- response option/item;
- count;
- percentage of valid respondents;
- missing/invalid values where relevant;
- matrix mean and normalized score where relevant.

Provide Download CSV and Copy table actions. The table should reflect filters and chart sorting while retaining a “Restore canonical order” action for ordered questions.

---

## 9. Filters

### Common filter

`Original response language` is available in all four tabs. Current counts are:

| Stakeholder group | Available response languages |
|---|---|
| Country Teams | English 26, French 7, Spanish 5 |
| Grantee Partners | French 86, English 64, Russian 8, Spanish 7, Portuguese 2, Arabic 1 |
| Implementing Agencies | English 13, French 2, Spanish 1, Arabic 1 |
| Steering Committees | English 33, French 18, Spanish 3, Russian 3 |

### Country Team filters

- Original response language
- Country
- Role
- Years with SGP
- GEF agency
- Internet reliability
- Primary device

### Grantee Partner filters

- Original response language
- Country
- Internet reliability
- Number of proposals submitted
- Most recent proposal status
- Implementation experience
- Most recent project status

### Implementing Agency filters

- Original response language
- Agency: UNDP, Conservation International, FAO

### Steering Committee filters

- Original response language
- Country
- Sector/organizational affiliation
- NSC tenure
- GEF agency
- Internet reliability
- Primary device

### Filter behavior

- Filters are multi-select with search when more than ten values exist.
- Show result count beside every filter option where practical.
- Filters combine with AND across dimensions and OR within one dimension.
- Disable options that would yield zero results, but allow users to remove active values.
- Active filters appear as removable chips above the question.
- `Reset all` returns to the complete stakeholder group.
- Changing filters updates the chart, table, valid n and URL immediately.
- Filter values must use canonicalized categories, while the method panel can disclose alias consolidation.
- A response-language filter refers to the language in which the original response was submitted, not the language requested for future learning materials.

---

## 10. Data model and compilation

### Recommended deployment model

Build the initial application as a static React + TypeScript application using Vite. Compile the Excel workbook into normalized JSON before the production build. The site requires no runtime database or server for this dataset and can deploy to Cloudflare Pages, GitHub Pages, Netlify or comparable static hosting.

Vite’s production build emits static assets suitable for static hosting, and its official deployment guidance includes Cloudflare Pages. Apache ECharts supports the required radar, heatmap, bar, treemap and other interactive chart families and provides animated data transitions.

Reference documentation:

- https://vite.dev/guide/build
- https://vite.dev/guide/static-deploy
- https://echarts.apache.org/
- https://echarts.apache.org/handbook/en/how-to/animation/transition/

### Suggested repository structure

```text
sgp-survey-explorer/
├── data/
│   ├── source/GEF_SGP_Survey_Responses_English.xlsx
│   ├── config/question-manifest.json
│   ├── config/aliases.json
│   ├── config/ordinal-scales.json
│   └── qa/normalization-report.json
├── public/data/
│   ├── manifest.json
│   ├── country-team.json
│   ├── grantee-partners.json
│   ├── implementing-agencies.json
│   └── steering-committee.json
├── scripts/
│   ├── compile-survey.ts
│   ├── validate-survey.ts
│   └── redact-public-data.ts
├── src/
│   ├── app/
│   ├── components/
│   │   ├── charts/
│   │   ├── filters/
│   │   ├── qualitative/
│   │   └── navigation/
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── vite.config.ts
└── README.md
```

### Normalized response shape

```ts
type StakeholderKey =
  | "country_team"
  | "grantee_partners"
  | "implementing_agencies"
  | "steering_committee";

interface NormalizedRespondent {
  id: string; // generated, non-reversible; never the timestamp
  stakeholder: StakeholderKey;
  dimensions: Record<string, string | string[] | null>;
  answers: Record<string, NormalizedAnswer>;
}

type NormalizedAnswer =
  | { kind: "single"; value: string | null; raw?: string }
  | { kind: "multi"; values: string[]; raw?: string }
  | { kind: "matrix"; values: Record<string, string | null> }
  | { kind: "text"; value: string | null };
```

Do not include source timestamps in the production payload. Generate stable respondent IDs from tab name and row sequence for internal joins, then strip or randomize them for public mode.

### Question manifest

The supplied `question-manifest.json` is the canonical app configuration. Each question records:

- stakeholder group and question number;
- section and full prompt;
- source workbook columns;
- question kind;
- matrix items;
- unfiltered response count;
- branch/eligibility rule;
- default and alternative chart types;
- denominator and export behavior.

The UI must be driven by the manifest rather than a long chain of question-specific conditional statements.

---

## 11. Data normalization requirements

The workbook combines translated answer labels from several language versions. Semantically identical categories therefore appear with punctuation, capitalization and wording differences. The compiler must canonicalize them before aggregation.

### General pipeline

1. Read each of the four named worksheets.
2. Preserve the original cell value for QA only.
3. Normalize Unicode punctuation, whitespace and non-breaking spaces.
4. Apply case-insensitive exact aliases from `aliases.json`.
5. Apply question-specific controlled-option matching.
6. Classify unmatched values as `other` or `unclassified`, never silently discard them.
7. Write a QA report listing every canonical category, alias, unmatched value and affected row count.
8. Fail the production build when new unmatched values exceed a configured threshold.

### Examples requiring consolidation

- `Botswana`, `Botswana ` → `Botswana`
- `TOGO`, `Togo` → `Togo`
- `Programme Assistant`, `Program Assistant` → one configured display label
- `Computer`, `Laptop or desktop computer` → `Laptop or desktop computer`
- `Mobile telephone`, `Mobile phone` → `Mobile phone`
- `Country Team / Country Program`, `Country Team / Country Programme` → one label
- punctuation variants of proposal status, confidence and lessons-learned options
- `Often` in Q86 → `Frequently`
- `Extremely valuable` in Q94 → `Highly valuable`, subject to data-owner confirmation

### Multi-select parsing

Do not split every value on commas. Some legitimate option labels contain commas, such as “Unrealistic work plan, timeframe,” and translated options have inconsistent punctuation.

Use this method:

1. Define the canonical option dictionary for each multi-select question.
2. Sort aliases by descending text length.
3. Match known complete option phrases using boundary-aware longest matching.
4. Remove matched phrases and accepted separators.
5. Send remaining text to `unclassifiedSegments` in the QA report.
6. Require manual alias review for material unmatched segments.

### Country normalization

- Trim and title-case values through an explicit country alias table.
- Map `Timor Leste` to `Timor-Leste`.
- Preserve official display names such as `Saint Kitts and Nevis`.
- Attach ISO alpha-3 codes for optional world-map rendering.
- Never infer a country from free text when confidence is low.

### Denominators

For each filtered question calculate:

- total respondents in filtered stakeholder group;
- eligible respondents based on branch rules;
- respondents with a valid answer;
- blank responses;
- invalid/unclassified responses;
- for multi-select questions, total selections.

The primary percentage uses valid respondents unless the question explicitly requires the eligible base. Show both figures when they differ materially.

### Branching rules

- Country Team Q15 follows selection of “Other” in Q14.
- Country Team Q18 follows selection of “Other” in Q17.
- Grantee Q41 follows a revision request in Q40.
- Grantee Q53 follows a reported change in Q52.
- Grantee Q47–Q63 apply to organizations reporting implementation experience in Q46.

Blank answers outside a respondent’s survey branch are `not_eligible`, not missing.

---

## 12. Privacy and publication modes

A public static site exposes every value embedded in client-side JSON, even when the interface does not visibly display it. Privacy treatment must therefore happen during compilation.

### `internal` mode

- Includes approved qualitative responses.
- Allows all filters.
- Shows exact small counts.
- Appropriate only for controlled access or an authenticated environment.

### `public` mode

- Excludes timestamps and source row identifiers.
- Includes qualitative text only after explicit human review and redaction.
- Suppresses results when the filtered respondent base is below a configurable threshold, default `k = 5`.
- Prevents exports from bypassing suppression.
- Avoids displaying country and several profile dimensions together beside an individual qualitative response.
- Includes a build-time report of excluded or redacted fields.

Set deployment mode with an environment variable such as `VITE_DATA_MODE=public`. The public build must never import the internal JSON bundle.

---

## 13. Visual design system

### Design direction

The product should feel editorial, calm and analytical. Use generous space, strong typography and controlled color. The interface should evoke a contemporary research publication rather than a dense corporate dashboard.

### Suggested palette

| Token | Suggested value | Use |
|---|---:|---|
| Ink | `#17212B` | Primary text |
| Muted ink | `#5D6B78` | Metadata and secondary text |
| Canvas | `#F5F7F5` | Application background |
| Surface | `#FFFFFF` | Cards, charts and drawers |
| Forest | `#146B5D` | Primary actions and selected state |
| Teal | `#2D9C88` | Primary data series |
| Lime | `#B6D76A` | Positive/high values |
| Ochre | `#D9A441` | Midpoint/warning values |
| Coral | `#D66A5E` | Low/negative values |
| Border | `#DCE3DF` | Dividers and outlines |

Use the stakeholder groups as navigation accents, not as competing categorical colors:

- Country Teams: teal
- Grantee Partners: deep blue
- Implementing Agencies: ochre
- Steering Committees: violet

Charts should continue to use semantic or ordered scales appropriate to the question.

### Typography

- Interface and body: `Inter`, `Source Sans 3` or another open, highly legible sans serif.
- Question heading: 30–40 px desktop, 24–30 px mobile, semibold.
- Body: 16–18 px.
- Metadata: 13–14 px.
- Numeric chart labels: tabular numerals.

### Components

- 10–14 px corner radius on surfaces.
- Light 1 px borders; minimal shadow.
- Strong focus rings meeting WCAG expectations.
- Minimum 44 × 44 px interactive targets.
- Skeleton states only during initial data loading; question-to-question navigation should be immediate after the bundle is loaded.

### Motion

- 200–350 ms chart transitions.
- 150–200 ms control feedback.
- Respect `prefers-reduced-motion` and replace transitions with immediate updates.
- Avoid decorative parallax or continuous animation.

---

## 14. Accessibility

- Target WCAG 2.2 AA.
- Provide semantic tab, heading, navigation, button and table structures.
- Every chart needs an accessible title, description and exact-data table.
- Color must never be the only representation of meaning.
- Maintain at least 4.5:1 contrast for normal text.
- Support keyboard use for question navigation, chart selection, filters, tooltips and drawers.
- Preserve visible focus.
- Announce filter-result and chart-type changes through a polite live region.
- Do not force horizontal scrolling for essential mobile content; allow data tables to scroll within a labelled region.
- Use patterns or labels to distinguish diverging scale categories when necessary.

---

## 15. Performance and reliability

- Target under 200 KB compressed for initial application JavaScript excluding the chart library; lazy-load ECharts and non-default chart adapters if this materially improves first load.
- Split data by stakeholder tab and load only the active tab initially.
- Prefetch the adjacent tab or question bundle during idle time.
- Keep all current-tab aggregations below 100 ms on a typical laptop and below 250 ms on a mid-range mobile device.
- Debounce filter search input, not filter selection.
- Virtualize qualitative lists over 100 responses.
- Cache normalized JSON with content hashes.
- Provide a clear fatal-data error screen if the manifest and data bundle versions do not match.

---

## 16. Analytics and observability

If privacy and organizational policy allow, collect only product-usage events:

- stakeholder tab opened;
- question opened;
- chart type changed;
- filter applied or cleared;
- data table expanded;
- chart or CSV exported;
- share link copied.

Do not transmit response contents or active filter values that could reveal sensitive respondent characteristics. Analytics must be optional and disabled by default in the first build.

---

## 17. Testing requirements

### Unit tests

- Header-to-question grouping produces 96 questions.
- Workbook row counts reconcile to 38, 168, 17 and 57.
- Matrix groups contain 14, 14, 10, 9, 9, 8 and 7 items respectively.
- Alias normalization consolidates known capitalization, punctuation and translation variants.
- Multi-select parsing never splits configured option labels containing commas.
- Ordered scales remain in configured semantic order.
- Matrix unscored values do not enter mean calculations.
- Percentage calculations use valid respondent denominators.
- Branching distinguishes not-eligible from blank.
- Public suppression applies to chart, tooltip, table and export.

### Integration tests

- Changing stakeholder tab loads the correct question range and filters.
- Previous/Next preserves valid filters.
- Chart cycling exposes only compatible chart types.
- URL state restores selected question, chart and filters on reload.
- Qualitative search respects active filters.
- Downloaded CSV matches the visible filtered data.
- Reset filters restores the unfiltered n.

### End-to-end tests

- Complete keyboard journey through all primary controls.
- Mobile journey through tab switch, filter, question change and qualitative reader.
- Direct links to representative categorical, multi-select, matrix and qualitative questions.
- Public-mode small-cell suppression.
- 404/invalid question redirects to the first valid question in the requested tab.

### Visual regression cases

- Long answer labels in horizontal bars.
- Fourteen-axis radar charts.
- Small `n=17` Implementing Agency views.
- Empty filtered view.
- Qualitative responses containing long paragraphs.
- Narrow mobile viewport at 320 px.
- Reduced-motion mode.

---

## 18. Acceptance criteria

The first release is complete when:

1. The application imports the supplied workbook through a reproducible compile command.
2. All four stakeholder tabs display the correct respondent counts.
3. All 96 numbered questions are present in workbook order.
4. The seven matrix questions appear as seven grouped experiences, not 71 independent subquestions.
5. Every quantitative question has a default chart and exact-data table.
6. Users can cycle only through compatible chart types.
7. Radar is the default for every grouped matrix question.
8. Multi-select questions use respondent-based percentages and display the multiple-selection note.
9. Qualitative questions show a searchable, filterable response reader with no quantitative chart.
10. Filters update visual, data table, response base and URL consistently.
11. Language filtering works across all four stakeholder tabs.
12. Country and answer aliases eliminate material duplicate categories.
13. The compiler produces a normalization QA report with no unreviewed material values.
14. The application is usable at 320 px width and fully keyboard navigable.
15. The public build does not ship timestamps or unapproved raw qualitative content.
16. Automated tests cover calculations, navigation, filters, branching and disclosure controls.
17. The production build deploys successfully as a static site.

---

## 19. Implementation sequence

### Phase 1 — Data foundation

- Create the Vite/React/TypeScript project.
- Import the supplied question manifest.
- Build the workbook compiler and normalized response model.
- Create alias, scale and country dictionaries.
- Generate and review the QA report.
- Add internal/public data modes.

### Phase 2 — Core explorer

- Build routes, stakeholder tabs and question navigator.
- Implement URL-backed app state.
- Add filter engine and denominator calculations.
- Build question header, metadata and exact-data table.

### Phase 3 — Visualization system

- Add chart adapter interface.
- Implement ranked bar, ordered bar, radar, heatmap and diverging stacked views first.
- Add lollipop, donut, treemap, dot plot and world map alternatives.
- Add chart switcher, transitions and export.

### Phase 4 — Qualitative and responsive experience

- Build response reader, search, density modes and export.
- Add drawers/bottom sheets for mobile.
- Complete accessibility and keyboard flows.

### Phase 5 — QA and deployment

- Reconcile every question’s valid n against the workbook.
- Run unit, integration, end-to-end and visual tests.
- Complete the privacy review.
- Deploy to preview, obtain stakeholder approval and promote the approved build.

---

## 20. Future extensions

- Reviewed qualitative theme coding with human-editable tags.
- Compare mode for pinning two compatible questions or stakeholder groups.
- Executive-story view with curated findings and annotations.
- Additional survey waves and trend comparisons.
- Secure workbook upload and compilation interface.
- Saved views and report collections.
- CMS-managed introductory and methodological copy.
- Private authenticated mode for unsuppressed internal analysis.

