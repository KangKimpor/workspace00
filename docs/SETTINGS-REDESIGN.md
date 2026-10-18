# Settings redesign control matrix

Settings is a lazy-loaded Radix dialog, with a searchable category navigation and independently scrolling content on desktop/tablet. Below 600 px it becomes a full-screen category list with detail/back navigation and edge swipe back. Dialog close, sign-out, data transfer and Trash/Calendar handoff flush editors first.

| Previous control | New location | Behavior |
|---|---|---|
| Account email / Sign out | My account | Existing account session and sign-out, after editor flush |
| Collapsed storage / Refresh | My account → Storage | Automatically loads numerical database/files usage, progress, refresh and inline retry |
| Delete account native prompt | My account → Danger zone | In-app typed DELETE ACCOUNT confirmation; Cancel receives initial focus; same cloud endpoint and sign-out |
| Theme segment | Appearance → Theme | Light/Dark/System preview cards; same persisted preference and platform theme application |
| Accent select / mislabeled Olive | Appearance → Accent | Six named swatches including legacy Lime; blue default; existing stored lime remains valid |
| Density select | Appearance → Density | Comfortable/Compact segment; same persisted preference |
| Reduce Motion | Appearance → Reduce motion | Accessible switch; same preference and document attribute |
| Text size | No selector | Explicit owner preference: fixed 16 px; legacy key remains compatible |
| ImportExportPanel + duplicate More JSON controls | Import & export | One panel: JSON/ZIP export, JSON/Markdown/CSV/ZIP import, page Markdown export and backup guidance |
| Enable / Disable notifications | Notifications | One switch reads permission and actual push subscription; unsupported, denied and unconfigured states explained |
| App lock | App lock | Existing lazy passphrase form and encryption semantics |
| Install | Devices & install | Existing lazy PWA install behavior plus iOS step list |
| Windows | Hidden in web | Native delivery remains paused |
| Keyboard spans | Keyboard shortcuts | Action/shortcut table, platform modifier; verified WorkspaceApp shortcuts and calendar D/W/M/A/T handler |
| Region text | Language & region | Device language/time zone with explanatory note |
| Trash | Trash | Count and handoff to existing Trash sheet |
| Calendar settings | Calendars | Handoff to existing calendar settings |
| App identity | About | Bundled brand, package version and bundled third-party notices |

No new dependencies or external assets. Settings content keeps Khmer system fallback, semantic tokens and actual 44 px control boxes. Native desktop implementation and live cloud deletion/push were not exercised. Automated settings specs cover search, keyboard category activation, phone drill-in/back, light/dark axe smoke, fixed text size, consolidated imports and notification loading without registration. Actual execution results belong in the parent redesign report.
