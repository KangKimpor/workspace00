# Kimpor Workspace mark

The current mark is an original geometric K: a vertical spine, an open chevron,
and a short connecting stroke. Rounded terminals keep it readable in small
navigation controls. It uses no third-party logo or proprietary assets.

The master is `svg/workspace-mark.svg`, in a 100 × 100 view box with a 6-unit
stroke. Keep at least 10 units of clear space. Monochrome marks use currentColor;
web app icons use a charcoal tile (#353936) and warm white (#faf9f6).

Run `pnpm brand:build` to generate the React mark, public SVGs, adaptive SVG and
ICO favicons, Apple touch icon, PWA icons, and social previews. The generator
exports web assets only. Existing native desktop artwork and earlier concept
masters are preserved for the paused desktop work.
