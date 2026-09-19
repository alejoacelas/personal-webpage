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
