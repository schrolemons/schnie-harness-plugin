# Progress — docs/implementation-plan.md

2026-10-21: Design approved by the user. Existing launcher changes are prior work from this conversation and must be preserved. Plugin work uses a separate new directory. CLI/Vercel/GitHub credentials are available; no Harness Web listener is currently running on default ports. Installed dsh is 0.1.2-rc.1; current npm is 0.2.1-rc.2. Verify compatibility before installation, without upgrading the user's global runtime.

Ruling: Relax quotas only on the new knowledge route. Existing `/api/chat` still spends the author's model key, so changing it is not required to deliver the plugin and would independently weaken the public site.

Interface review: backend produces schema 1 Source IDs; host and client consume those IDs. Backend files are in launcher; plugin Host files and Client files have separate ownership. No task needs another task's model credentials. Source identity/citation matching must be tested end-to-end.

2026-10-21 verification: The user's startup error was traced to CLI/profile version mismatch, then repaired by updating the CLI to 0.2.1-rc.2. The profile's model patch and credential files were unchanged at the repair checkpoint. Existing third-party plugins were preserved. The pinned pnpm dependencies were rebuilt to resolve a store-major mismatch.

The Vercel knowledge endpoint is deployed from launcher main commit d5cd131. GET readiness, anonymous real vector search and the authoritative scoped overview were verified. Existing launcher checks: 156 tests passed; Astro check had zero errors/warnings/hints and the production build succeeded.

Plugin checks: 33 tests passed; syntax checks passed; no runtime npm dependencies. A real Harness conversation using the existing DeepSeek-V4-Pro / High configuration invoked knowledge search and produced a supported original link. The final source card is visible outside the collapsed tool process. History replay after reload, expandable snippet and 390px layout without horizontal overflow were verified in Edge. Screenshot in docs/images/source-card.png contains only the public source card.

Independent review found a quoted-code citation false positive. A failing regression reproduced it, then container-aware code masking fixed both ID and natural-link examples. The reviewer found no additional concrete issue in same-turn/source matching, disposal or credential boundaries. No secrets, session data or full desktop screenshots are part of the package/repository.
