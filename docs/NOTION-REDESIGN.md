# Kimpor Workspace web redesign

Status: first working phase and redesign implemented and locally verified on
`redesign/notion-workspace`, based on main `de057ed`. No deployment, live
migration, main push, merge or visual-baseline approval is authorized here.

Review: [draft PR #20](https://github.com/KangKimpor/kimpor-workspace/pull/20).

## Scope and decisions

The Pages/Databases first phase and its tested data-safety fixes are retained.
The redesign reuses React, the existing controls, Tiptap/Yjs, account auth,
Supabase synchronization and private attachments. It does not replace storage,
encryption or the editor engine. Pre-existing edits to `.gitignore`, `README.md`
and root `package.json` are excluded from this work's commits.

The direct user request for a fixed 16px scale and no text-size control overrides
the attached brief's slider. The schedule/time bar remains removed. Native
desktop applications remain paused. Legacy appearance keys and saved `lime`
values remain compatible; new accounts default to blue. Old blue preferences
are no longer silently rewritten to lime.

Astra medium supplied architecture and UX planning. The implementation builders
use 6.1 Sol; the user subsequently requested medium effort for remaining work.

## Figma reference

Reauthentication succeeded. Metadata and high-fidelity design contexts with
screenshots were retrieved from `ot3OLEBIHB1IGCcSqg5V11`, including gallery
`2:25134`, table `2:25363`, sidebar `2:29199`. The supplied community file is
primarily marketing pages containing app examples. Those examples guide the
neutral chrome, underline tabs, small card radii, tags and table dividers.
Settings is interpreted from the written specification. No kit logos, photos,
icons or marketing copy are used as application assets.

## Implementation coverage

| Requirement | Source | Evidence / limits |
|---|---|---|
| Persistent pages, archive, templates, properties and views | Core store and model; `pages-databases-data.md` | First-phase unit and PostgreSQL ownership/concurrency checks; retained during redesign |
| Neutral responsive shell and skins | tokens, `notion-surfaces.css`, existing feature styles | 92 contrast pairs; all 34 profile/theme combinations and 612 strict layout audits pass |
| Gallery/table/board Projects and named preset creation | `apps/web/src/projects/` | Named/icon form, original preset schemas, keyboard board moves, imported-ID no-write regression |
| Categorized searchable Settings | `apps/web/src/settings/` | Desktop two-pane / phone drill-in; detailed old→new map in `SETTINGS-REDESIGN.md` |
| Storage, deletion and notifications | AccountPanel / notifications | Numeric storage, in-app typed confirmation, real subscription state |
| One import/export panel | ImportExportPanel | JSON plus portable formats retained; editor flush preserved |
| Safe menus and primitives | ActionMenu, Pressable, Tag, PropertyTypeIcon, `/design` | Reuse existing libraries; no added runtime dependency |
| Row side peek and property creation | DatabaseEditor / AddPropertyForm | Shared validated form in database and row; reads current schema after editor flush before append |
| First-phase save/conflict fixes | editor flush lifecycle, property patches, per-view clocks | Do not remove optimistic view state or queued-save flushing during extraction |

## Verification ledger

Before this broader visual redesign, the working Pages/Databases phase passed
104 unit tests with 90.7% core line coverage, typecheck, lint, web build, backup
and cloud contract tests, 18 mocked auth browser cases and 72 contrast pairs.
All 12 SQL migrations plus ownership, purge and Pages/Databases contracts ran
on a disposable loopback PostgreSQL instance. This is baseline evidence, not
proof that the final redesign passes the same checks.

Current contrast checks: 92 pairs pass, including every tag pair in both themes.
Final command results and screenshot links are recorded below.
Existing approved screenshots under `docs/visual-baselines/` provide the old
visual reference; they will not be overwritten or approved automatically.

`pnpm check` passes after integration: 110 tests across 19 files, 90.7% core line
coverage, backup contract 1/1, cloud/matrix contracts 13/13, lint/conventions,
types, web build, 237.2 KiB initial JS gzip and 92 contrast pairs. The final
keyboard composition guards also pass focused ESLint and a fresh web build.
No runtime dependencies were added; JavaScript license checks pass.

The first complete 208-case browser pass had 192 passes and 16 failures:
seven assertions contained the intentionally replaced colors; six Firefox
cases stalled in `setViewportSize` on this Windows host (also documented in
the previous verification ledger); phone Settings Escape now returns from
detail to categories, so its test must explicitly close Settings; duplicate
Calendar header text wrapped on phone; WebKit notification status waited on
an unnecessary service-worker query. The source/tests address all except
the host Firefox resize limitation. A new complete run is pending below.
No assertions, thresholds or browser projects were removed.

The rebuilt 212-case browser run produced 203 passes and nine failures. The six
Firefox viewport-resize cases remain blocked by this Windows host. A real
wide-peek overlay stacking issue was corrected and verified with normal clicks.
The remaining database/journal WebKit cases passed isolated retries (the
database workflow also passed three consecutive development-build runs).
Production-build correction checks pass 12/12 across all four browser projects.
An additional Settings Calendar-first-visit/Trash handoff regression passes 4/4.
This is combined evidence, not a claim of one completely green full browser run.

The initial full layout command passed 32 profiles, then lost the preview server
owned by the completed browser suite. Traces show `ERR_CONNECTION_REFUSED` for
Settings assets; both interrupted profiles pass after a persistent preview was
started (2/2). A new full stable-server audit is running. Preview/auth servers
are now independent of test-suite lifetimes. No layout assertions changed.
The subsequent complete `pnpm layout:audit` passes all 34 profiles / 612 screens
in 5.0 minutes; receipts are in `docs/evidence/lime-layout-audit.json` (the
historical filename is retained for the existing tooling).

Review also restored visible headings and guidance in the shared empty-state
component and removed its fallback Done action. The final production build's
regression passes 4/4 browser projects, including a page-overflow assertion.
The full layout/capture run preceded that final static empty-state text change;
the last build and focused regression cover it without replacing baselines.

| Final verification | Result |
|---|---|
| `pnpm check` | Pass: lint/conventions, types, 110 unit tests, 90.7% core line coverage, backup 1/1, cloud contracts 13/13, build, budget, contrast |
| Final focused lint / typecheck / web build | Pass after the final empty-state and keyboard changes |
| `pnpm budget` | Pass: 237.2 KiB initial JS gzip; 250 KiB gate unchanged |
| `pnpm contrast` | Pass: 92 semantic pairs in light/dark |
| PostgreSQL contracts | Pass on disposable loopback PostgreSQL 18.4: all 12 migrations, ownership, purge and Pages/Databases contracts; no live migration |
| Full browser run | 203/212 pass; three corrected/intermittent cases pass the 12-case focused production rerun; six Windows-host Firefox viewport-resize timeouts remain enabled |
| Additional handoff / empty-state regressions | 4/4 + 4/4 pass across Chromium, WebKit, Firefox and phone WebKit |
| `pnpm layout:audit` | Pass: all 34 profile/theme combinations and 612 screen audits |
| `pnpm shots` | Pass: 510 candidates, 17 profiles, both themes; approved images unchanged |
| `pnpm lighthouse` | Pass on `/` and `/design`: 99 performance, 100 accessibility, 100 best practices; LCP 747/745 ms, TBT 0 ms, CLS 0 |
| Dependency licenses / staged secret scan | Pass; no new runtime dependencies |

The first Lighthouse attempt ran alongside browser audits/capture and failed
the performance/TBT gate (73, 725 ms). With the same thresholds and those jobs
stopped, the final production build passes the isolated run above. Reports are
local under `docs/evidence/lighthouse/`; `notion-web-verification.json` records
the compact results. Screenshot and layout receipts are committed separately
from ignored image candidates. There is no claim of a green approved-baseline
comparison or completed production/device acceptance.

## Screenshots for review

The existing approved images are before references, not captures fabricated
after the redesign. Candidate files use the corresponding `docs/screenshots/`
paths and remain ignored; approved baselines are unchanged.

| Screen | Before reference | Candidate |
|---|---|---|
| Projects desktop/light | `docs/visual-baselines/workspace-windows1366-light.png` | `docs/screenshots/workspace-windows1366-light.png` |
| Database desktop/light | `docs/visual-baselines/database-windows1366-light.png` | `docs/screenshots/database-windows1366-light.png` |
| Settings desktop/light | `docs/visual-baselines/settings-windows1366-light.png` | `docs/screenshots/settings-windows1366-light.png` |
| Projects phone/dark | `docs/visual-baselines/workspace-iphone15-portrait-dark.png` | `docs/screenshots/workspace-iphone15-portrait-dark.png` |
| Database phone/dark | `docs/visual-baselines/database-iphone15-portrait-dark.png` | `docs/screenshots/database-iphone15-portrait-dark.png` |
| Settings phone/dark | `docs/visual-baselines/settings-iphone15-portrait-dark.png` | `docs/screenshots/settings-iphone15-portrait-dark.png` |

Gallery, board and sidebar are included through the populated Projects/gallery
captures, database view tests and layout audit screenshots. The Figma sources
in this report identify the actual reference frames. There are no baseline
approval commits or visual comparison success claims.

## Boundaries

Sharing, guests, comments, teamspaces, timeline and formulas require later
product/backend work and have no placeholder controls. New rollup calculations
remain unavailable. Actual files attach to page content; a database files
property does not claim a complete file manager. Native desktop work, production
providers/Storage, installed physical devices, VoiceOver/Narrator and hardware
Khmer IME checks are not established by fixture tests. New visual baselines
require human review.

The lime branch's visual direction is superseded; its functional changes should
be reviewed independently before any production rollout.

The disposable SQL server is stopped. Its temporary test-runtime folder remains
because automatic approval review rejected directory cleanup without returning
a specific reason; cleanup was not retried through another mechanism.
