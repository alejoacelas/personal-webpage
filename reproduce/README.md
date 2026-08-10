# Reproduce the site

The repository root on `main` is the production source.

1. Install with `yarn install --frozen-lockfile`.
2. Build with `yarn build`.
3. Check locally with `yarn preview`.
4. Deploy from the root with `vercel deploy --prod` to Vercel project `alejoacelas-com`.
5. Confirm that `alejoacelas.com` and `www.alejoacelas.com` resolve to the new production deployment.

On 2026-08-10, the active site was consolidated from competing `main` and `shrine` histories. `main` contained the newer simplified landing page and canonical About sentence, so it became the sole production branch. Superseded files moved to `archive/2026-08-10-superseded/`; obsolete branch tips were preserved by the `archive/pre-main-consolidation-2026-08-10` tag before their branches were removed.
