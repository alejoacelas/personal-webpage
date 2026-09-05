---
agent_context:
  version: 1
  groups: []
  visibility: public
---
<!-- agent-context:begin sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -->
<!-- agent-context:end -->

# Personal Website — alejoacelas.com

`main` is the sole current version. The root Vite app is what production deploys; `~/best/archive/2026-08-website-superseded/` is lineage only.

## Stack

- **Framework:** React 19 + Vite 8
- **Styling:** Custom CSS (no CSS-in-JS or Tailwind)
- **Dev server:** `yarn dev` (port 3073)
- **Build:** `yarn build` (outputs to `dist/`)

## Deployment

- **Platform:** Vercel
- **Project:** `alejoacelas-com` (org: `alejandros-projects-a115cc74`)
- **Domain:** alejoacelas.com
- **Deploy:** `vercel deploy --prod` from project root

## Architecture

Matuschak-style stacked notes interface with an animated differential growth canvas background.

- `src/App.jsx` — Main app, layout modes (landing vs notes), URL hash navigation
- `src/NotePane.jsx` — Individual note renderer with markdown-like parsing
- `src/HoverPreview.jsx` — Popover preview on link hover
- `src/DifferentialGrowthBg.jsx` — Canvas-based animated background
- `src/notes.js` — Static note content database
- `src/styles.css` — All styles

## Repository hygiene

- Commit source assets from `public/`; do not commit generated `dist/` output.
- Do not commit local dependency installs, Playwright captures, local env files, or OS metadata.
