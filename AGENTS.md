# Personal Website — alejoacelas.com

The `redesign` branch rebuilds the site from scratch; follow [PLAN.md](PLAN.md).
Production still deploys from `main` until the redesign is merged.

Read [README.md](README.md) for the source layout, local commands and deployment.
Run `yarn build` and inspect changed UI locally before publishing.

- Commit source assets from `public/`; do not commit generated `dist/` output.
- Do not commit local dependency installs, Playwright captures, local env files, or OS metadata.
