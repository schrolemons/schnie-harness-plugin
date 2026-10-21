# SCHNIE Harness plugin

Approved scope, 2026-10-21: one installable prebuilt plugin bundle. Reuse the author's existing launcher RAG and Vercel deployment. The user's Harness owns model, credentials, reasoning and generation. No model API key enters this package or the knowledge API. Publish source to a new GitHub repository and validate in the installed local Web UI.

## Knowledge API contract

Default endpoint: `https://launcher.sch-nie.com/api/knowledge`.

`POST` JSON: `{operation: 'search' | 'overview', query?: string, site?: 'all' | 'blog' | 'world' | 'zero', mode?: 'chat' | 'tutor' | 'scholar'}`. Defaults: search/all/chat. Search query is required, trimmed, 1–1200 characters. Unknown properties and client credentials are rejected without echoing values. The endpoint never forwards a generation request.

Success JSON: `{schema: 1, requestId: string, operation, site, query: string, sources: Source[], overview?: string}`.

Source preserves the existing selector's fields (`number`, `title`, `section`, `category`, `categoryName`, `url`, `urlKind`, `site`, `siteName`, `sourcePath`, `articleId`, `articleHash`, `summary`, `text`) plus `id`: a stable lowercase 16-hex digest of article identity/version/section/text. Link identity is authoritative server data. The answer uses exact title+URL Markdown links or `[SCHNIE:<id>]` markers. UI displays only references supported by search results in that answer's own turn. Code/link literals do not become ID citations. Same title+URL is one displayed article; different titles sharing an index URL remain distinct. Candidates are not recommendations.

Errors: `{error: string, code: string, requestId: string}` with 400/413/415/429/503; never include raw upstream errors or credentials. GET returns capability/health metadata without querying vectors or charging generation. CORS is anonymous public read-only access, without cookies. TTL cache, 120 requests/minute/IP default, bounded topK and body/context sizes, 12-second timeout; no per-day model budget, captcha or model credentials. Reuse the existing namespace, embedding mode, adjacent snippets, source normalization and overview. No index mutation or re-embedding.

## Plugin responsibilities

Host registers `search_schnie` and `schnie_overview`, scoped prompt guidance and replayable tool results. Query only when relevant; preserve all user model and reasoning settings and generic Harness guidance. Tool network sends only the explicit operation/query/site/mode. Bounded timeout, cancellation, cached short results, no hidden generation or automatic repeated requests. No source code patching in the user's Harness.

Client renders cited source cards with expandable text previews using supported slots/conversation APIs, host theme tokens and native React. The user additionally requested visible UI on 2026-10-21: a live retrieval status above the composer, a custom tool record and minimal source cards. Custom reference nodes use `groupTree: turn` to remain outside the collapsed reasoning/tool process. No DOM scraping or global latest-result cache. No extra model settings or replacement chat. Plain tool JSON/Markdown fallback keeps headless environments functional. Unloading cleans registrations. Package includes compiled/runtime JS, locale resources, icon, README and MIT license, with no install/build scripts or bundled secrets.

## Compatibility and release

Installed CLI initially reported `0.1.2-rc.1` while the existing Web profile referenced newer official bundles. The user's explicit startup-repair request superseded the initial preference to avoid upgrading: the global CLI was updated to `0.2.1-rc.2`, which healed the legacy schedule bundle reference. Existing model/patch/credential files were preserved and verified by SHA256. A mismatched pnpm store was rebuilt using the profile's pinned dependencies. Compatibility is documented only for the version actually tested. Publish prebuilt `.tgz` as a GitHub release asset; npm publishing is optional and is not needed for download-and-install.

Only the new read-only knowledge route gets relaxed protection. The existing website generation route continues using its established credential and abuse protections because it still spends the author's Key.
