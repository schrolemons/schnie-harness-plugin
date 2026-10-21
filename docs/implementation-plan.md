# SCHNIE Harness Plugin Implementation Plan

> Execute the approved design with test-first changes and independent backend/client tasks; review and integrate in this chat.

**Goal:** Deliver a prebuilt plugin using the existing remote knowledge base and the user's existing Harness model configuration.

**Architecture:** Launcher owns anonymous read-only retrieval; the plugin owns tool integration, source identity and reference rendering. No generation passes through the author's account.

**Tech stack:** Node.js ESM, Harness Cordis/Client slots, React from the host, existing Upstash Vector/Redis, Vitest, Playwright.

**Spec:** [design.md](design.md)

## Constraints

- Preserve all existing uncommitted launcher UI fixes.
- No production secrets in source, fixtures, tarball, logs or Git.
- Separate plugin repository; no edits to the installed Harness source or model configuration.
- Default endpoint `https://launcher.sch-nie.com/api/knowledge`; schema 1 and stable 16-hex source IDs.

## Task 1: Read-only knowledge service

Create `launcher/api/knowledge.js`, shared retrieval code, route tests and deployment includes. Write failing tests for valid retrieval without a DeepSeek key, website filters, credential rejection, overview, rate limits, cancellation and safe failures. Extract existing selection/retrieval without changing website behavior. Run targeted tests and full launcher tests.

## Task 2: Plugin host and packaging

Create `package.json`, `cordis.patch.yml`, `index.js`, `lib/knowledge-client.js`, locales and icon. Write failing tests proving only retrieval fields leave the Host; cancellation/timeouts work; both tools and an additive prompt section register and dispose. Implement plain runtime JS with no install scripts. Validate the actual npm packed file list and scan it for credentials.

## Task 3: Reference rendering

Inspect installed Harness contracts. Create `client.js` plus focused citation/projection tests. Associate sources with the correct tool call and Turn; render only cited safe server sources, preserve replay/partial answer behavior, deduplicate articles without merging distinct shared-index entries. Verify slots and the visible result in the installed Web UI.

## Task 4: Deployment, integration and publication

Run all tests/checks, review changes, deploy the existing launcher knowledge route using its existing Vercel project. Verify live health, real retrieval, overview and no generation route use. Install the `.tgz` into the user's Web profile, preserve unrelated settings, check references and retrieval through the real UI. Create a public independent GitHub repository (the user requested open source and publication), push source and attach the prebuilt `.tgz` release asset. Record verification and any host-version limitation in README and the release.
