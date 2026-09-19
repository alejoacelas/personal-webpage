# alejoacelas.com

Canonical source for [alejoacelas.com](https://alejoacelas.com).

- `main` is the only active branch and the root Vite app is the only current site.
- Vercel project `alejoacelas-com` deploys the root to `alejoacelas.com` and `www.alejoacelas.com`.
- `~/best/archive/2026-08-website-superseded/` contains superseded experiments and is never deployed.
- `myea.blog` is a separate site in the separate `myea-blog` repository.

## Development

React 19 and Vite 8, with custom CSS. Run `yarn install`, then `yarn dev` to open
the development server on port 3073. `yarn build` writes the production build to
`dist/`; `yarn preview` serves that build locally.

The current site is a profile page with expandable sections and an animated
differential-growth background:

- `src/App.jsx`: profile content and expandable sections.
- `src/DifferentialGrowthBg.jsx`: canvas background.
- `src/styles.css`: styles.
- `src/main.jsx`: React entry point.

## Deployment

Vercel project `alejoacelas-com`, organization `alejandros-projects-a115cc74`.
After building and checking locally, run `vercel deploy --prod` from the repository
root. The superseded stacked-notes interface is not part of the current app.
