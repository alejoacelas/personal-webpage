# alejoacelas.com

Alejo Acelas's personal site: a map of work he has shared, grouped by topic, with a
reader for each piece. The works are his Slack posts, documents, repositories, small
sites and things he said on calls.

## How it is built

- `wiki/index.html`, `style.css`, `inks.css`, `app.js`, `search.js` and `map-inks.js`
  are the page.
  It has no framework and every route is in the URL hash.
- `wiki/data.publish.js` is the published data: each work's title, description, text
  and position on the map. `node wiki/build.mjs --release` writes it from a private,
  annotated sample of Alejo's work that is kept outside this repository.
- `wiki/share.mjs` decides which works are published and applies the edits that
  remove other people's details. The build writes nothing if a private name, an email
  address, an invite link or a link to a left-out work remains.
- `scripts/build.mjs` copies the page, the files it loads and the published data
  into `dist/`, and writes every work as plain text (`llms.txt`, `works.txt`,
  `works/<id>.txt`, `topics/<id>.txt`) so AI assistants can read the site. Vercel runs
  it on every push to `main`.
- `api/rank.mjs` re-sorts search results by how well each answers the visitor's
  question, and `api/search.mjs` returns search results as plain text. The page keeps
  its own word-matching order when the endpoints are absent.

## Commands

- `yarn build`: build `dist/` from what is committed.
- `node wiki/serve.mjs`: serve the site locally with the search endpoint.
- `node wiki/build.mjs --review`: build `wiki/data.js` with every work that isn't
  left out, for checking the sharing marks. That file is ignored and never deployed.
- `node wiki/shoot.mjs`: take headless screenshots of the page.

## How it is published

A weekly run on Alejo's computer collects his new work, marks what can be public,
has a second agent check it, and commits a new `wiki/data.publish.js` to `main`.
