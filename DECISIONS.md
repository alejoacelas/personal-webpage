# Personal website decisions

## Core decisions

### Maintain one production source

- [Deploy the root main app, never a superseded experiment](#deploy-the-root-main-app-never-a-superseded-experiment).
- [Keep the blog as a separate site](#keep-the-blog-as-a-separate-site).
- [Commit source assets and verify generated output locally](#commit-source-assets-and-verify-generated-output-locally).

## Details

### Deploy the root main app, never a superseded experiment

The consolidation in `adf1028` chose main because it held the newer simplified landing page and canonical About copy. [README.md](README.md) identifies the root Vite app and Vercel project alejoacelas-com. The superseded archive and preserved branch tag are lineage, not alternative production inputs.

### Keep the blog as a separate site

myea.blog has its own repository and deployment. Editing this profile site must not silently replace its routes or revive the removed stacked-notes application. The current profile lives in [App.jsx](src/App.jsx).

### Commit source assets and verify generated output locally

[AGENTS.md](AGENTS.md) keeps public/ assets in source control and dist/, dependency installs, environment files and captures out. Build from the root and inspect changed UI before publishing so generated artifacts cannot become a competing source of truth.
