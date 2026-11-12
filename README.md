

<div align="center">
  <!-- Адаптивный логотип (Светлая/Темная тема GitHub) -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/fameowly-wordmark-dark.svg">
    <img src="./.github/assets/fameowly-wordmark-light.svg" alt="Fameowly Logo" width="380"/>
  </picture>

  <br />

  <p>
    <em>Purrs up whatever you need 🐾</em>
  </p>

  <p>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/License-BSL%201.1-blue.svg" alt="License" />
    </a>
    <a href="https://nextjs.org/">
      <img src="https://img.shields.io/badge/Next.js-16+-black?style=flat-square&logo=next.js" alt="Next.js" />
    </a>
    <a href="https://tailwindcss.com/">
      <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    </a>
  </p>
</div>

## Overview

Self-hosted AI chat for a family or a small team. One host configures the API keys — everyone else just logs in and talks to the models. No database, no cloud account, no per-seat subscriptions.

Its main trick: **every outgoing request to an LLM provider can go through a SOCKS5 proxy**. Run the hub on any machine at home and reach OpenAI, Google or OpenRouter even when your ISP blocks them or the provider refuses connections from your country — users never need a VPN themselves.

## Features

- **SOCKS5 proxy for provider traffic**: set `SOCKS_PROXY` (or `ALL_PROXY` / `HTTPS_PROXY`) and all provider calls, including streaming, are tunneled through it. Everything else stays on the direct route.
- **Zero-database**: users, chats and uploads are plain JSON files under `data/`.
- **Shared keys**: OpenRouter, Google AI Studio, xAI (Grok) and local LLaMA-compatible endpoints are configured once by the host.
- **Sign-in**: by a one-time code sent to the user's email, or by name/email and password; password recovery by email. Accounts are added by the admin, with an email, a password or both.
- **Admin panel**: built-in UI for creating users and managing access.
- **Multimodal**: image and file attachments in chat, plus a dedicated image generation mode.
- **Rich rendering**: Markdown, LaTeX and syntax-highlighted code blocks.
- **Chat export**: print any chat to PDF with its original formatting, or download it as Markdown.
- **Installable PWA**: works as a standalone app on desktop and mobile.

Built with Next.js 16, React 19, the Vercel AI SDK and Tailwind CSS v4.

## Deployment (Docker)

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  fameowly:
    image: ghcr.io/lemix/fameowly:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

`data/`, `data-oss/` and `.env*` are excluded from the build context by `.dockerignore`, so a locally built image never contains users, chats or credentials — they are supplied at run time through the volume and `env_file`.

### Building without a registry

`scripts/deploy-image.sh` builds the premium image (it needs the `extensions` submodule) from the committed `HEAD`. Uncommitted changes are left out. Without arguments it only builds `fameowly-premium:sha-<commit>`. With `user@host` it streams the image over SSH, tags it `fameowly-premium:local`, runs `$DEPLOY_DIR/deploy.sh fameowly` (default `/opt/fameowly`) and keeps the newest `KEEP_IMAGES` (default 3) `sha-*` tags on the host for rollback. The host's compose service must use `image: fameowly-premium:local` with `pull_policy: never`.

### Environment

```env
JWT_SECRET=change-me-to-a-32-char-random-string
ADMIN_INIT_PASS=pick-your-first-admin-password

OPENROUTER_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
XAI_API_KEY=
LOCAL_LLM_URL=http://127.0.0.1:8080/v1

# Route provider traffic through a SOCKS5 proxy
SOCKS_PROXY=socks5://127.0.0.1:1080
```

The proxy is read from `SOCKS_PROXY`, `ALL_PROXY`, `HTTPS_PROXY` or `HTTP_PROXY`, in that order; the value must use a `socks` scheme. Leave them unset to connect directly.

### Mail and sign-in by email

```env
SMTP_URL=smtps://user:password@mail.example.com:465
MAIL_FROM=FaMeowly <noreply@example.com>
# Optional: secret for login code hashes (defaults to JWT_SECRET)
AUTH_CODE_SECRET=
# Optional: number of reverse proxies in front of the hub; enables per-IP limits
TRUSTED_PROXY_HOPS=1
```

With mail configured, the login page asks for an email and sends an 8-digit code
(valid 10 minutes, 5 attempts, a new one after 45 seconds, a few per hour); a
password is optional. Without `SMTP_URL`, `npm run dev` prints the messages to the
server log and a production server offers password sign-in only. Codes are sent
only to existing accounts, and the reply never tells whether an account exists.
A link to `/login?email=you@example.com` opens the form with the address filled in.
`TRUSTED_PROXY_HOPS` must match the real proxy chain: the client address is taken
from `X-Forwarded-For` that many entries from the right; leave it unset when the
hub cannot see client addresses.

### Company details

`/requisites` is a public page with the operator's legal details, which payment
providers require on the site. It is read from the environment at request time,
so the data never lands in git or in the image:

```env
COMPANY_NAME=ИП Иванов Иван Иванович
COMPANY_INN=
COMPANY_OGRN=
# Optional: COMPANY_KPP, COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_PHONE
```

The page (and its link on the login screen) exists only when `COMPANY_NAME`,
`COMPANY_INN` and `COMPANY_OGRN` are all set; otherwise it returns 404.
A 15-digit OGRN is labelled ОГРНИП.

### Chat UI

Emoji are shown on the answer-option chips above the input (thinking depth, answer style,
web search); `CHAT_OPTION_ICONS=false` hides them. `CHAT_OPTION_LIST_ICONS=true` also shows
them next to each choice in the lists (off by default). Both are read at request time, so a
restart is enough.

### Models configuration

The available models are stored in the data directory as the `models` document of the `settings` collection: `data/db/settings/models.json`, shaped `{ "id": "models", "chatModels": [...], "imageModels": [...] }`. A reference configuration with all supported fields is provided in `data/models.json.example`.

On a fresh data directory `npm run init:data` seeds the catalogue from the example; edit the document afterwards (the server picks up changes on the next request).

Boolean properties (`isLocal`, `supportsTemperature`, `supportsReasoning`, `supportsWebSearch`, `supportsUrlContext`, `supportsToolCalling`) default to `false`. The `isLocal` flag is automatically inferred as `true` when `provider` is `"local"`.

`archived: true` hides a model from the model picker for everyone, admins included, and the chat and image routes refuse it; the entry stays in the catalogue so it can be restored. `GET /api/models?all=1` (admin only) returns archived models too.

`supportsWebSearch` shows the «Поиск» toggle in chat and `supportsUrlContext` lets the model read links pasted into a message. On `google` and `google-vertex` both are served by Google's native tools (Grounding with Google Search, URL Context) — and not on every model of those providers, so check the model's own documentation first. On other providers they are served by the `web` plugin of the commercial edition: pasted links are pre-fetched and injected into the prompt, while search is a tool the model calls itself through a self-hosted SearXNG — so it also needs `supportsToolCalling` (a llama.cpp server must run with `--jinja`, otherwise requests with tools fail). In the open-source build the flags have no effect there.

### Web search (SearXNG)

`docker compose up -d` also starts a `searxng` container, reachable only from the hub over the internal network. Its config lives in `searxng/settings.yml`; the JSON API (`formats: [html, json]`) and a disabled `limiter` are both required. Set `SEARXNG_URL` (`http://searxng:8080` inside Docker) and a random `SEARXNG_SECRET` in `.env.local`. For local development run the container by hand and point `SEARXNG_URL` at it:

```bash
docker run -d --name searxng-dev -p 127.0.0.1:8888:8080 \
  -v "$PWD/searxng:/etc/searxng:rw" -e SEARXNG_SECRET=dev-only searxng/searxng:latest
```

Pages are fetched by the hub itself through an SSRF-hardened client (`lib/web-tools/safe-fetch.ts`): only `http`/`https`, every redirect re-validated, connections pinned to a resolved public IP, loopback and private ranges refused.

`reasoningLevels` sets which thinking depths the user may pick in the «Сколько думать перед ответом» picker: any of `"off"` (Сразу), `"low"` (Быстро), `"medium"` (Вдумчиво), `"high"` (Глубоко). The picker appears with two or more levels; a single level is applied silently. A model without `reasoningLevels` but with `supportsReasoning: true` offers `["off", "high"]`. List only what the provider honours: Google maps the levels to `thinkingConfig.thinkingLevel` and "off" to `thinkingBudget: 0` (gemini-3.1-pro stops thinking, gemini-3.8-flash does not); OpenRouter to `reasoning.effort` / `reasoning.enabled: false`; xAI to `reasoningEffort` (grok-4.5+ cannot stop thinking, so leave out `"off"` for them); llama.cpp to `chat_template_kwargs` (`enable_thinking`, `reasoning_effort`), which a server started without `--jinja` silently ignores. A level that is accepted is not always different: measure the reasoning tokens per level on a task that needs thinking, and where the levels give the same depth, offer only `["off", "high"]` (or a single level when the model cannot stop thinking). Measured 2026-11-12, 3 runs per level: separate depths on gemini-3.1-pro, gemini-3.8-flash (without "off"), Claude Sonnet 5 and DeepSeek V4 Pro; the same depth at every level on GPT-5.6, Kimi K3, DeepSeek V4 Flash, Qwen 3.8 and grok-4.7. Displaying the reasoning block itself does not depend on these settings: it is always on wherever the provider exposes reasoning.

## Local development

```bash
npm install
npm run dev   # http://localhost:3000
```

Runtime data lives in `DATA_DIR` (default `./data`). Point it at another directory to run isolated instances side by side.

Users, chats, image history and settings are JSON documents under `DATA_DIR/db/<collection>/<id>.json`; uploads and generated images stay in `DATA_DIR/uploads/`. Upgrading from a version that kept `users.json`, `chats/`, `images/` and `models.json` at the top of the data directory takes one migration run before the first start (the old files are kept, the run can be repeated):

```bash
DATA_DIR=./data node scripts/migrate-legacy-layout.mjs --dry-run
DATA_DIR=./data node scripts/migrate-legacy-layout.mjs
```
