# alejoacelas.com

The site is the page in `wiki/`, and `main` is what is live.

## Weekly run

Every Monday at 08:30 a scheduled Claude session on the main Mac collects Alejo's new
Slack posts, sent documents and calls, decides what can be public, and deploys by
committing `wiki/data.publish.js` to `main`. Once a month it puts a review page on
his docket showing what it held back and what went out.

The run's brief, the sharing criteria, the annotation briefs and the private sample
are in the private desk folder
`~/best/systems/desk/requested/2026-11/2026-11-21-website-wiki`; start with its `README.md`.

## Secrets

- `OPENROUTER_API_KEY` (in the ignored `.env`): the search bar's re-sorting step calls Jev through
  OpenRouter's Decisions API (`wiki/rank.mjs`). 1Password: account `my.1password.com`, vault
  `mac-agents`, item `OPENROUTER_API_KEY — website`, field `credential`. Provisioned through the
  Stripe project `alejoacelas-website` (resource `openrouter-api`).
