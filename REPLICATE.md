# REPLICATE

## Workspace structure and shared instructions

The human wanted simpler folders and shared agent instructions while preserving existing work.

- Moved the repository from work/writing/website to me/website and its superseded experiments to ~/best/archive/2026-08-website-superseded (website-superseded commit d5c9244). The production app is unchanged; CLAUDE.md now imports AGENTS.md.

Agent session 01a072fe-84d6-73f3-b37e-3bb912088c38 · Commits website: c555e05

## Group personal sites

The human wanted to remove unstarted personal projects and simplify the remaining folders.

- Moved `me/website` to `me/sites/website`, preserving repository history and site files.

Agent session 01a0b90b-7ae3-7ed1-bb2f-fde3ad5d78d3 · Commits dotfiles: 5ceaed4

## Agent instructions cleanup — 2026-09-19

Alejo asked to refresh project instructions and remove redundant Claude instruction files where native AGENTS.md loading is available.

- Updated the applicable instructions and removed redundant local Claude copies; distinct content and preserved snapshots remain.
- Checked instruction references and shared-context freshness; native Claude loading requires 2.1.277+ with the built-in feature enabled.

Agent session 01a0b915-3eb2-78b2-9add-6ba48ad9a3b1 · Commits 4b874940b8c87c584bd861fcd5ea8d3bef649f50

## Explicit startup instructions

Alejo wanted shared instructions selected deliberately at startup, without copied text or automatic parent inheritance.

- Removed agent-context YAML and generated shared text; retained project-specific instructions locally.
- Shared groups: none. Selection now lives in the machine's context registry; startup does not rewrite this file.
- Moved architecture and deployment details to README and corrected stale component references.

Agent session 01a0b915-3eb2-78b2-9add-6ba48ad9a3b1 · Commits 8c79b77

<a id="construction-records"></a>

## Construction records

Preserved records from the former construction-notes folder.

<a id="record-readme"></a>

### Reproduce the site

The repository root on `main` is the production source.

1. Install with `yarn install --frozen-lockfile`.
2. Build with `yarn build`.
3. Check locally with `yarn preview`.
4. Deploy from the root with `vercel deploy --prod` to Vercel project `alejoacelas-com`.
5. Confirm that `alejoacelas.com` and `www.alejoacelas.com` resolve to the new production deployment.

On 2026-08-10, the active site was consolidated from competing `main` and `shrine` histories. `main` contained the newer simplified landing page and canonical About sentence, so it became the sole production branch. Superseded files moved to `archive/2026-08-10-superseded/`; obsolete branch tips were preserved by the `archive/pre-main-consolidation-2026-08-10` tag before their branches were removed.

## Retire construction folders

Alejo wanted all `reproduce` folders under `~/best` transitioned to `REPLICATE.md`.

- Consolidated the existing records and updated references for `reproduce`. Preserved scripts, data and maintained procedures in their own folders.
- Original tracked files remain in Git at `e7900a3321ff50a12af44bdd84a3798be05d3375`; a full local backup, including ignored files, is at `/Users/alejo/.local/state/reproduce-migration/2026-09-19-_qyg4u7a/before/me/sites/website`.

Agent session 01a0bb8d-6d31-76d3-ac4e-aca4c5dfce64 · Commits e06285e11aee8d8ca845a771a60a4d0f651175de
