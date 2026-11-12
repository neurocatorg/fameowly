# Family AI Hub

Self-hosted family AI hub on Next.js 16 with support for multiple LLM providers.

## Stack

- Next.js 16 (App Router, TypeScript, React 19)
- AI SDK v6 (ai, @ai-sdk/openai, @ai-sdk/google)
- Tailwind CSS v4 + @tailwindcss/typography
- jose (JWT auth)
- react-markdown + remark-gfm + remark-math + rehype-katex
- lucide-react

## Architecture Principles

- **SOLID**: each module/component has a single responsibility
- **DDD-lite**: domain logic (chat, images, auth) is isolated in `lib/`, 
  the UI layer contains no business logic
- **Low coupling**: components communicate through props/hooks, 
  not through global state

## File Size & Decomposition Rules

- **Maximum 200 lines** per component file. If it is longer, decompose it.
- **Maximum 150 lines** per custom hook. If it is longer, extract sub-hooks.
- **One component = one file**. Do not place multiple components in one file.
- **Hooks live in `hooks/`**, utilities in `lib/`, components in `components/` 
  or in co-located `_components/` next to the page.
- **Types**: shared types in `lib/types.ts`, local ones in the file where they are used.
- **Constants**: move them to separate files in `lib/` if they are used in 2+ places.

## Project Structure
- app/ # Next.js App Router pages & API routes
  - page.tsx # Home: signed-in → `_components/chat-app.tsx` (mode orchestrator), guest → plugin `home` page or /login
  - (chat)/_components/ # Chat mode components
  - (image)/_components/ # Image generation mode components
  - (video)/_components/ # Video mode components (placeholder, feature pending)
  - print/[chatId]/ # Printable chat transcript (PDF export via browser print)
  - profile/ # Own account: name, email (bind/change by code), password; plugin slots for balance
  - requisites/ # Public company details page, from `COMPANY_*` env (404 when unset)
  - info/[page]/ # Host for plugin public pages (`Plugin.publicPages`), open to guests
- api/ # API routes (chat, image, upload, auth, etc.)
- hooks/ # Custom React hooks (UI business logic)
- components/ # Shared UI components (sidebar, chat-message, etc.); `public/` = guest page frame + footer
- lib/ # Server & shared utilities, types, domain logic; `storage/` = document store (file backend); `sign-in/` = email codes, limits, password sign-in
- data/ # Runtime data: `db/<collection>/<id>.json` (users, chats, image_history, settings), `uploads/`
- extensions/ # Git submodule with closed-source plugins (providers, billing, web, etc.)
- searxng/ # SearXNG config (`settings.yml`) for the `searxng` docker-compose service


## Key Technical Decisions

- **AI SDK v6**: `streamText()` + `toUIMessageStreamResponse()` on the server.
  On the client, use a custom `usePersistentChat` hook with SSE parsing.
- **Local models**: llama.cpp goes through `createOpenAICompatible` like any other provider,
  wrapped with `extractReasoningMiddleware({ tagName: "think" })` for servers that inline
  `<think>` instead of returning `reasoning_content`. There is no bespoke local stream client.
- **OpenRouter**: use `openrouter.chat(modelId)` (Chat Completions API),
  NOT `openrouter(modelId)` (Responses API is not supported).
- **xAI (Grok)**: base provider `xai`, key `XAI_API_KEY` or a virtual provider. Chat uses
  `@ai-sdk/xai` pinned to the `ai-v6` dist-tag (`latest` targets a newer AI SDK) and
  `xai.responses(modelId)` — the Responses API streams grok-4.x reasoning summaries — with
  `store: false`. `reasoningEffort` takes our levels, "off" = `"none"`; grok-4.7 answers 400 to
  `"none"` (measured 2026-11-12), so its `reasoningLevels` are `[low, medium, high]`. Images: `/api/image` branches on
  `credentials.baseProvider === "xai"` into `lib/providers/xai-image.ts` (`generateImage`,
  `/v1/images/generations`, or `/v1/images/edits` with up to 5 references, JPEG/PNG — others are
  converted). xAI renders 1k/2k only; 4K is upscaled locally. Upstream errors answer 502,
  never the provider's 401/402.
- **Auth**: JWT in httpOnly cookies, middleware for route protection. Sign-in by an
  8-digit email code (`lib/sign-in/`, `/api/auth/email/{start,verify}`), by password with
  name or email (`/api/auth/login`), password reset by code (`/api/auth/password/reset`,
  bumps `sessionVersion`). Users: `email?` (unique, lower-case), `emailVerifiedAt?`,
  `password?` (absent = code only); `name` is the display name. Codes live in `auth_codes`
  (HMAC with `AUTH_CODE_SECRET` or `JWT_SECRET`, TTL 10 min, 5 attempts, deleted on use);
  cooldowns and hourly counters in `auth_limits` (per-document expiry via `ttlSeconds: 0`).
  Limits apply to every address and the `start` reply never depends on whether an account
  exists. Mail goes out via `after()`, never awaited in the response. Per-IP limits need
  `TRUSTED_PROXY_HOPS` (default 0 = off). Accounts are created only by an admin or when
  `registrationPolicy.canCreateUser` allows it at code verification (OSS: never).
  Self-service registration is implemented by a plugin through `registrationPolicy`
  (its form fills the `login-request-access` slot; public delegator `/api/auth/access-request`).
  `/login?email=` pre-fills the address, so mail can link straight to sign-in; `/login?next=<path>` returns
  to a same-site path after sign-in (a single leading `/`, no backslashes or whitespace, else `/`).
  Profile (`/profile`): `PATCH /api/profile` renames (names stay unique: legacy sign-in uses
  them); `/api/profile/email/{start,verify}` binds or changes the email with a `verify_email`
  code sent to the new address and bound to the account ("address taken" only after a correct
  code); `POST /api/auth/password` sets a first password without proof, otherwise needs the
  current one or a `reset_password` code, and bumps `sessionVersion` (this device is re-issued).
- **Payment required (402)**: `/api/chat` and `/api/image` answer 402 when `spendingGuard`
  refuses. The chat client takes the unsent message back out of the chat (a chat created by it
  stays, empty) and returns text and attachments to the input; image mode keeps prompt and
  references. `components/payment-required.tsx` shows the `payment-required` slot, or a toast.
- **Mail**: `mailer` slot; OSS default sends via `nodemailer` when `SMTP_URL` + `MAIL_FROM`
  are set, prints to the log in development, and is unavailable in production otherwise
  (the login page then shows the password form only).
- **Storage**: every persistent document goes through the `documentStore` slot
  (`lib/contracts/document-store.ts`): collections with a small filter language, atomic
  `update` with `inc`, `transaction(fn)`. OSS default `lib/storage/` keeps one JSON file per
  document under `DATA_DIR/db/`, writes via temp file + rename, serialises writes per collection
  with mutexes kept on `globalThis` (Next.js may load a module once per bundle). Core stores
  (`user-store`, `chat-store`, `image-store`, `models.server`, `provider-store`) and every
  contract method that may read data are async. Read-modify-write runs inside `transaction`.
  Binary files stay in `DATA_DIR/uploads/`. The legacy layout is converted once by
  `scripts/migrate-legacy-layout.mjs`; there is no conversion at startup, and the server
  refuses to seed the default admin next to an unmigrated `users.json`.
  A plugin may replace the backend through the same slot; any backend must pass
  `runDocumentStoreChecks()` from `scripts/document-store-checks.ts` (the file runner is
  `scripts/check-document-store.ts`). Transaction callbacks may be re-run by such a backend,
  so they must not have side effects outside the store.
- **File attachments**: the server resolves files from `data/uploads/` into base64/text
  before sending them to the LLM. The client does not send raw data.
  Uploads are never inlined as `data:` URLs — the client resends the whole history on
  every request and Next.js middleware truncates bodies above 10 MB (`Unterminated string
  in JSON`). `chat-store` moves legacy inline attachments to disk on read and on write.
- **File security**: files are stored in `data/uploads/{userId}/`, 
  access is verified by `userId` from the session.
- **Generated images**: `/api/image` passes `imageConfig.{aspectRatio,imageSize}` to Gemini and
  upscales locally only when the model ignores `imageSize`. `responseModalities` is `["IMAGE"]`
  only: with `TEXT` allowed, gemini-3.1-flash-image answers vague prompts with text and no
  image (measured 2026-11-04); with `IMAGE` only it ends them with `finishReason: NO_IMAGE` unless a
  system instruction demands an image (4/4 vs 0/4). Response parts flagged `thought`
  are skipped: gemini-3-pro-image sends a 1K draft image there before the final one.
  Originals reach 25 MB, so the UI never shows them: `imageVariantUrl(url, "thumb" | "view")`
  → `/api/files/...?v=` serves a WebP (256 / 2048 px) rendered once by `lib/image-variants.ts`
  and stored next to the original. Only «Скачать» fetches the original. Stored file names are
  UUIDs or content hashes, so `/api/files` responds `immutable` + `ETag`.
  `image-store` moves legacy inline `data:` reference images to disk on read and on write.
  Thinking and search for images reuse the model flags `reasoningLevels` and `supportsWebSearch`
  (admin form shows both for image models). `lib/image-generation-options.ts` maps the picked level
  to `generationConfig.thinkingConfig.thinkingLevel` ("off" = `MINIMAL`), only when the model offers
  2+ levels, and adds `tools: [{ googleSearch: {} }]`. Measured 2026-11-10 on Vertex:
  gemini-3.1-flash-image `HIGH` adds ~1.5k thought tokens and ~5 s; gemini-3-pro-image ignores the
  level (~310 thought tokens always). Search is the model's call — it rarely searches unless the
  prompt asks for fresh facts — and gives it page text only. Image search (`searchTypes.imageSearch`,
  flash only) is not wired: unverified (quota 429) and its Search Suggestions are mandatory.
  Grounding goes to `ImageHistoryItem.grounding` without `suggestions` (they expire); the live
  response carries them, and `ImageResult` shows `GroundingPanel`. Image defaults: «Сразу», search off.
  It bypasses `webToolsProvider`: the route calls Gemini REST directly. Billing gets
  `usageTracker.onImageFinish(userId, modelId, { imageSize, webSearchQueries })`: the price of the requested size
  (`ModelOption.pricePerImageBySize`, else `pricePerImage`) plus `pricePerSearchQuery` per Google query; image
  thinking tokens are not billed (~1.5k tokens, under 1 % of the image price).
- **Web tools**: two mechanisms behind one `webToolsProvider` slot. `resolve()` returns
  `tools` for `streamText()` — provider-native for Google/Vertex (they share the same tool
  factories: `@ai-sdk/google-vertex` re-exports them from `@ai-sdk/google`, so one OSS strategy
  covers both), or premium `web_search` / `fetch_url` function tools for models flagged
  `supportsToolCalling` (llama.cpp needs `--jinja`). Executed tools run as a multi-step loop:
  optional `maxSteps()` → `stopWhen: stepCountIs(n)`, the last step runs without tools and
  with an "answer now" note; tool budgets, not the step cap, are what stop the model.
  The usage tracker gets `totalUsage` (every step) as `usage` — that is what is billed — and, for multi-step
  answers, `contextUsage` = first step's prompt + final answer (what stays in the chat; `lib/chat/finish-usage.ts`).
  `lib/chat/stream-grounding.ts` merges grounding from pre-fetch, tool results and Google
  metadata. Optional `prepareContext()` pre-fetches **pasted links only** (there is no
  pre-fetched search); the route always calls it and `lib/chat/apply-web-context.ts` puts
  the result into the current user turn. Split: **OSS owns mechanics** (`lib/web-tools/`:
  SSRF-hardened `safe-fetch`, `ip-guard`, `extract-article`, `searxng` client), **premium owns
  policy** (`extensions/plugins/web/`: tools, budgets, `fetch_url` allowlist = links the user
  pasted anywhere in the chat + this answer's search hits, injection-resistant blocks).
  Web search is an explicit per-chat toggle; a pasted link is pre-fetched once for the
  message that contains it, and afterwards stays re-readable through `fetch_url`.
  When it is, the plugin also appends an English note to the system prompt: earlier turns
  may come from another model or from pages no longer in context — re-open, don't guess.
  Never send `tool_choice: "required" | "none"` or a named tool to ik_llama — measured broken.
- **Timeouts**: every generation is capped at 10 min; cloud providers also get stall
  detection (`stepMs` / `chunkMs` of AI SDK `timeout`), local servers do not — long prompt
  processing is legitimately silent. Each web tool call has a 30 s deadline, and `safeFetch`
  bounds DNS and the TCP/TLS handshake itself (its custom connector bypasses undici's timeout).
- **Streaming through a reverse proxy**: `/api/chat` wraps the response in
  `lib/chat/sse-heartbeat.ts` — an SSE comment every 15 s. Without it nginx
  (`proxy_read_timeout`, 60 s default) drops the stream while a local model silently
  processes a long prompt, and the browser sees a normal, truncated end. Cancelling that
  response also aborts the generation (second stop path besides `req.signal`).
- **Fetching untrusted URLs**: always through `lib/web-tools/safe-fetch.ts`, never `fetch`
  or `proxyFetch` — the hub shares a LAN with the LLM servers. SearXNG itself is trusted
  infra and is called with plain `fetch`.
- **Grounding hygiene**: grounding metadata travels via `toUIMessageStreamResponse`
  `messageMetadata` into `ChatMessageData.grounding` — never into `content`.
  `sanitizeMessagesForLLM()` neutralizes URLs in assistant history so old links
  are never re-fetched.
- **Reasoning**: two independent concerns. *Visibility* is always on where the provider
  supports it (`includeThoughts` for Google, tag extraction for local). *Control* is the
  «Сколько думать» picker (Сразу / Быстро / Вдумчиво / Глубоко = `ReasoningLevel` off/low/medium/high).
  The admin picks the levels per model (`ModelOption.reasoningLevels`; without it
  `supportsReasoning` means `[off, high]`); fewer than two levels = no picker. `/api/chat` clamps
  the requested level to the model's list (`lib/reasoning-levels.ts`) and hands it to the
  `reasoningOptionsProvider` slot as `reasoningLevel` (plus the deprecated `reasoningEnabled`).
- **Answer options UI**: chips above the input are `components/option-picker/` — a popover above
  the chip on desktop, a `components/ui/bottom-sheet.tsx` on mobile that blurs the textarea and
  re-focuses it inside the closing tap (iOS only reopens the keyboard from a user gesture).
  Hints live in the option list; on/off chips get an ⓘ `Tooltip` (hover on desktop, tap on touch).
  Emoji on chips unless `CHAT_OPTION_ICONS=false`, in the lists only with `CHAT_OPTION_LIST_ICONS=true`
  (`page.tsx` → `OptionIconsContext`). `OptionPanel` is the floating pill that holds the chips in both
  modes: chat (thinking, style, search) and image (format with `AspectRatioIcon`, quality 1K/2K/4K,
  thinking and search when the image model allows them).
- **Prompt island**: `components/prompt-island/` is the one input for chat and image modes
  (`chat-composer.tsx` / `image-composer.tsx` wire it). One row `[+] text [estimate] [→]` while the text
  fits; otherwise the text takes the full width and the controls drop to a row below. `use-prompt-layout.ts`
  decides from a hidden one-line copy of the text measured against the compact width, so the layout
  never flips back and forth; it returns to one row only when cleared or when the text fits again.
  Same textarea element in both layouts (CSS grid areas), so focus and the phone keyboard survive.
  Text height is capped at `min(200, 30% of the visual viewport)`; below `PROMPT_COMPACT_HEIGHT`
  (keyboard up) the island and chips drop spare paddings. Enter always adds a line; sending is the
  button only. `estimate` hosts the `prompt-estimate` plugin slot and `bottom` the `prompt-footer` slot, which the
  composers drop while `isCompact`; without plugins both stay empty.
- **Plugin System**: optional features are implemented as plugins in the `extensions/` submodule.
  Behaviour is overridden through the DI container; core routes resolve strategies
  via `container.get(...)`. Admin UI loads plugin tabs from `/api/plugins/capabilities`.

## Plugin System

- **Plugin Interface** (`lib/types.ts`): `id`, `name`, `register`, `adminTabs`, `uiSlots`, `apiRoutes`, `publicPages`,
  `onServerStart`. Behaviour changes go through `register(container)` — never through ad-hoc hooks.
- **Background tasks**: `instrumentation.ts` (Node.js runtime) calls `startPluginBackgroundTasks()` from
  `lib/plugin-loader.ts`, which runs every plugin's optional `onServerStart` once per process. Several processes
  may run it, so a plugin job takes its own lease in the `documentStore`.
- **Public pages**: `publicPages` are server components for guests. Id `home` renders on `/`
  for guests (otherwise `/` redirects to /login), other ids at `/info/<id>`. The core wraps them
  in `components/public/public-shell.tsx` («Войти», or «Открыть FaMeowly» for a signed-in visitor);
  `footerLabel` adds a link to the public footer. Pages read the session themselves when needed.
- **DI Container** (`lib/container.ts`): thirteen strategy slots — `providerResolver`, `modelFactory`,
  `usageTracker`, `pricingPolicy`, `modelAccessPolicy`, `spendingGuard`, `userLifecycle`, `webToolsProvider`,
  `reasoningOptionsProvider`, `documentStore`, `mailer`, `registrationPolicy`, `accessGate`.
  `userLifecycle.onUserCreated?` fires for accounts added by an admin or created by sign-up.
  `accessGate.check(userId)` (OSS: never blocks) keeps a signed-in user out of the app: `/` renders the
  `access-gate` slot instead, `/api/chat` and `/api/image` answer 403. Premium `registration` uses it for
  «Завершите настройку аккаунта»: non-admins accept the current offer edition (the offer's «Редакция от» line;
  a new edition asks again; optional news-by-email flag) and confirm an email while mail is configured.
  Consents live in `user_consents` + append-only `consent_log` (delegated `/api/account-setup`).
  `lib/plugin-loader.ts` registers OSS defaults first; plugins override. Last register wins.
- **Adding New Plugins** (no core files to edit):
  1. Create folder `extensions/plugins/{plugin}/`, implement `Plugin`, register in `extensions/index.ts`.
  2. Declare UI slots in `extensions/plugins/{plugin}/ui-slots.json`:
     `{ "<slot-id>": { "component": "components/foo", "inline": false } }`.
- **UI Slots**: `scripts/generate-plugin-slots.js` scans the manifests and emits
  `lib/generated/plugin-slots.ts` (gitignored) with literal dynamic imports.
  `PluginSlot` in `lib/plugin-ui.tsx` consumes that map and renders `fallback`
  for slots no plugin fills. With `ENABLE_PLUGINS=false` the map is empty,
  so plugin components are never bundled. The login page hosts `login-legal` and
  `login-request-access`; guests read `/api/plugins/capabilities` with slot ids only.
  `/profile` hosts `profile-balance`, `profile-preferences` and `profile-payments`; empty chat and image screens host
  `chat-empty-notice`; the app hosts `payment-required` and `onboarding` (state behind the
  delegated `/api/onboarding`); `/` hosts `access-gate`; the sidebar footer hosts `sidebar-menu`
  (entries styled with `components/sidebar/footer-classes.ts`); the prompt island hosts `prompt-estimate`
  (price of the next request, left of [→]) and `prompt-footer` (line under the island, hidden while `isCompact`).
  The header keeps `header-account`, which billing no longer fills (balance lives in `prompt-footer`).
  Billing computes the estimate on the client from `GET /api/balance?prices=1` (the user's marked-up prices +
  estimate parameters from the admin «Баланс» tab, `settings/billing.estimate`).
- **Plugin Bridge**: `lib/plugins.ts` loads the registry from `@plugins` and exposes
  `adminTabs` / `uiSlots` / `apiRoutes`. When the submodule is absent, `lib/plugin-stub.ts`
  supplies an empty plugins array.
- **Stub Generation**: `npm run prepare:plugins` (`postinstall` + before every dev/build)
  runs `scripts/ensure-plugin-stub.js` and `scripts/generate-plugin-slots.js`.
- **Build Modes**: `npm run build` (with plugins), `npm run build:os` (open-source via `ENABLE_PLUGINS=false`).

## Documentation Is Part of the Change

Documentation is not a follow-up task. A change that alters observable behaviour
is **incomplete** until the docs are updated in the same turn. Never finish a
task by saying docs will be updated later.

When you touch the left column, update the right one:

| Changed | Must update |
|---|---|
| Any signature in `lib/contracts/` | Extension-point table in both plugin docs |
| `Plugin` / `PluginAdminTab` in `lib/types.ts` | Both plugin docs + `## Plugin System` above |
| `ServiceMap` slots in `lib/container.ts` | Both plugin docs + `## Plugin System` above |
| OSS defaults in `lib/strategies/` | "OSS default" column in both plugin docs |
| `package.json` scripts | `## Commands` below, `README.md`, "Running it" in both plugin docs |
| Folder layout or path aliases | `## Project Structure` above, both plugin docs |
| New `getPluginRoute` delegator in `app/api/` | Delegated-path list in both plugin docs |
| `ui-slots.json` schema or the slot generator | `## Plugin System` above, section 5 of both plugin docs |

`internal-docs/plugin-development.md` (EN) and `internal-docs/plugin-development.ru.md`
(RU) are translations of each other — **never update one without the other**.

Verify claims before writing them down. Documentation asserting behaviour that
the code does not have is worse than no documentation.

## Breaking Change Protocol

The plugin API is consumed by an out-of-tree submodule and, once published, by
third-party developers. `tsc` cannot see those consumers, so **the compiler will
not warn you**. Absence of type errors is not evidence that a change is safe.

Before changing `lib/contracts/`, `ServiceMap`, `Plugin`, `PluginAdminTab`, the
`ui-slots.json` schema, or a delegated API path:

1. **Warn explicitly.** Open the reply with the contract name, the old shape and
   the new shape. Do not bury it in a summary.
2. **Show the blast radius.** Grep `extensions/` and list every consumer found,
   including "none found" as an explicit result.
3. **Ask before proceeding** when the change is not backwards compatible:
   removing or renaming a member, narrowing a return type, changing a slot id.
4. **Never silently delete** an interface member — report it as a breaking
   change even when nothing in this repository currently uses it.

Additive changes (a new optional field, a new container slot that ships an OSS
default) are not breaking. Say so explicitly, so the distinction stays visible.

## Code Style

- TypeScript strict mode, no `any`
- Functional components + hooks (no classes)
- Named exports for components, default export only for pages
- Tailwind CSS for styling, no CSS modules
- Russian language for UI text, English for code/comments

## Commands

- `npm run dev` — development server (premium, `data/`, port 3000)
- `npm run dev:os` — development server (open-source, `data-oss/`, port 3010)
- `npm run build` — production build  
- `npm run build:os` — production build (open-source mode, `ENABLE_PLUGINS=false`)
- `docker compose up -d` — Docker deployment
- `scripts/deploy-image.sh [user@host]` — build the premium image from `HEAD` locally; with a host,
  ship it over SSH as `fameowly-premium:local` and run the host's `deploy.sh` (no registry needed)

Runtime data lives in `DATA_DIR` (default `./data`). OSS runs use a separate
directory so they never corrupt premium data.

## Local Demo Is Part of the Change

A change with visible behaviour is **incomplete** until the user can look at it locally.
Finish such a turn with a running dev server and say: URL, which account to sign in with,
and what to click to see the change (mention the mobile viewport when it matters).

- The local `./data` may still be in the legacy layout; then `npm run dev` answers 500 on `/`
  ("Legacy data layout" / "Legacy premium data"). Never migrate `./data` without asking.
  Run on a migrated copy instead:
  ```bash
  D=/tmp/fameowly-demo-data; rm -rf "$D" && cp -a data "$D"
  DATA_DIR="$D" node scripts/migrate-legacy-layout.mjs
  DATA_DIR="$D" node extensions/scripts/migrate-premium-files.mjs
  DATA_DIR="$D" npm run dev
  ```
  The copy keeps the user's own accounts and passwords, models and providers.
- One `next dev` per checkout (`.next/dev/lock`): stop the previous one first.
- Verify the demo yourself before handing it over: the pages respond 200 and the server log
  shows no errors.

## Additional Conventions

| Principle     | Rule                                                                                        |
|---------------|---------------------------------------------------------------------------------------------|
| SRP           | One file = one entity. The `usePersistentChat` hook must not contain file upload logic      |
| OCP           | New provider = new file in `lib/providers/`, not edits to `route.ts`                        |
| ISP           | Components receive only the props they need, not the full hook state                        |
| DIP           | Hooks depend on abstractions (types in `lib/types.ts`), not concrete API endpoints          |
| Max 200 lines | Hard limit. Violation = immediate decomposition                                             |
| Plugin OCP    | New optional feature = new plugin in `extensions/plugins/`, not edits to core routes        |
| Plugin DIP    | Plugins register strategies in the DI container; core depends on contracts, not on plugins  |
| Docs sync     | Behaviour change without a doc update in the same turn = incomplete change                  |
| Docs parity   | EN and RU plugin docs are updated together, never one alone                                 |
| Contract warn | Touching `lib/contracts/`, `ServiceMap` or `Plugin` = explicit breaking-change warning first |
| No silent API drops | Removing an interface member is reported even if nothing in this repo uses it          |