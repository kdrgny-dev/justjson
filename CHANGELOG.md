# Changelog

All notable changes to `@kdrgny/justjson` and its packages. Versions are kept
in lockstep across the published packages (`justjson`, `justjson-astro`, core).

## 1.10.0 — 2026-08-18 · Studio: hosted publish mode

- Hosted publish mode: edit a repository that owns its own site with a
  password; the GitHub token stays on the server, never in the browser.
- One-button publish — saves the current edit and pushes only what changed via
  a single create-tree call, tolerant of GitHub hiccups.
- Inline preview shows the actual published page; content-only sidebar,
  multi-device content pull, and one-click auto-translation in hosted mode.
- Astro: repeater fields map to arrays of nested objects; Astro 7 allowed as a peer.

## 1.9.0 — 2026-08-04 · Studio: themes, tables and a real live preview

- Theme marketplace with live preview on your own content; Atelier premium theme.
- Multi-page sites, repeater fields, rich text with inline links and images.

## 1.8.0 — 2026-07-28 · Design + Preview

- Theme editor (palette, accent, font, corners, density) with a live sample.
- Editor runs your dev server and shows the real site in a pane.

Earlier releases (1.0.0–1.7.0) are recorded as GitHub Releases and in
`landing/content/releases/`.
