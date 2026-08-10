# Reproduce the site

The `shrine` branch is the source deployed to `alejoacelas.com` through Vercel project `alejoacelas-com`.

1. Install dependencies with `yarn install`.
2. Build with `yarn build`.
3. Check the generated site in `dist/` with `yarn preview`.
4. Deploy from this repository root with `vercel deploy --prod`.
5. Confirm that `https://alejoacelas.com` serves the new deployment.

The restored About sentence came from the search index's crawl of the live domain, which preserved the newer public copy after the repository and Vercel production deployment had fallen behind.
