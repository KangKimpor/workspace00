# Workspace design system

## Current Notion-inspired web system — 18 October 2026

The web implementation uses neutral surfaces, charcoal text, small corner radii,
underline view tabs and blue primary actions. Kimpor's original geometric K is
retained; no Notion logo, illustrations or proprietary assets are shipped.
System fonts lead the stack and the bundled Noto Sans Khmer fallback remains.
Body text is fixed at 16px with 1.5 or greater line height. There is no text-size
selector. Chrome uses the 14px `--text-ui` token; metadata uses caption tokens.

Figma reference `ot3OLEBIHB1IGCcSqg5V11` was read successfully after
reauthentication: gallery `2:25134`, table `2:25363`, sidebar `2:29199`.
These embedded app examples guide layout and visual treatment. The kit's
marketing imagery is reference material only. Settings follows the written
brief because the file has no matching Settings screen. Accessible colors and
44px targets take precedence over the reference's denser example controls.

| Primitive | Implementation and behavior |
|---|---|
| Button/icon action | Existing `Pressable`, `.ws-button`, `.ws-icon`; primary, quiet, danger and disabled states; visible focus; short ease-out feedback |
| Input/select/number | `.ws-input` and existing property editors; semantic labels; 16px inputs on phones |
| Segmented/theme/switch | Settings controls show selected state; theme previews and accent swatches retain accessible names |
| Menu/popover | `ActionMenu`, keyboard arrows/Home/End/Escape, optional icons/sections/shortcuts/checkmarks, focus return |
| Modal/sheet | Existing Radix dialogs and extracted `WorkspaceSheet`; trapped focus, safe areas and editor flush before navigation |
| Tabs | Underline selection, roving focus where applicable; view configuration persists through the existing store |
| Tag/status | `Tag`, stable NFC-normalized option hash, ten semantic foreground/background pairs; no schema color writes |
| Property icon | `PropertyTypeIcon`, existing ISC-licensed Lucide library; decorative SVG hidden from screen readers |
| Breadcrumb | Existing page ancestry, individually accessible navigation actions and phone truncation |
| Skeleton/empty/banner/toast | Quiet semantic surfaces, text status and retry/actions; no decorative empty-state artwork |

`/design` renders the existing studies plus the workspace primitive gallery.
Colors exist only in `packages/ui/src/tokens.css`. `notion-surfaces.css` carries
the shared web skin, with project and Settings layout in their feature folders.
Controls have actual 44px bounding boxes; pseudo-element hit areas do not
substitute for the layout audit. Existing phone <600, tablet 600–1023 and desktop
≥1024 container breakpoints, icon rail, keyboard guards and safe areas remain.

All ten tag foreground/background pairs are checked in both themes by
`scripts/contrast.mjs`, alongside the original checks (92 total pairs).
Visual captures are candidates, not approved baselines. Physical-device,
screen-reader and real IME verification remains separate from local automation.

## Previous lime direction (historical)

The redesign uses `packages/ui/src/tokens.css` as its color, type, spacing and motion source. Urbanist Variable is bundled locally; Noto Sans Khmer Variable remains the Khmer fallback. Legacy storage/package names remain unchanged.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#DFE1E0` | `#191919` |
| Surface | white | charcoal |
| Ink action | `#242221`, white text | light ink, dark text |
| Current/next marker | `#B6FF65`, `#001500` text | same |
| Schedule/dock | black, white text | same |

Use ink for primary actions, lime for current/next emphasis, semantic success/danger for status, and calendar color tokens for events. Keep literal CSS colors confined to tokens. `pnpm contrast` checks text, focus, calendar and brand pairs in both themes.

Radii follow roles: controls 14, groups 20, cards 28, sheets 32 and pills 999 px. Controls must provide 44×44 CSS px targets. Use existing Pressable, visible focus rings, reduced-motion support and the 4/8 px spacing scale. The reading pane remains narrow; tables/calendars fill their pane and scroll within intentional regions. Today is capped at 1480 px.

`Today.tsx` owns reusable ProjectCard, TaskCard and OptionPill. `ActionMenu.tsx` supplies menu semantics, arrow/Home/End/Escape handling, outside dismissal and focus return. Database view tabs support arrows/Home/End, retain imported view labels and expose the active panel. Desktop property/filter/sort controls anchor the existing Sheet; phones use the same focus-managed sheet.

The month calendar uses roving date focus: arrows move days, Page Up/Down move a month while clamping the day, Enter opens creation, and T returns to today. D/W/M/A select views outside fields and dialogs. All-day bars span each week once; overflow opens the complete day's events. Phone month selection keeps an agenda; desktop date-number selection opens Day.

Trash confirmation is an alertdialog with Cancel focused. Cloud deletion requires a matching online session and server acknowledgement. Read `adr/0010-permanent-deletion.md` before changing that contract.

The layout audit generates inspectable geometry receipts and screenshots. Screenshot evidence cannot approve visual baselines or replace physical keyboard, VoiceOver/Narrator, IME and safe-area acceptance.
