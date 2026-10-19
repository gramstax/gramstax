---
title: Troubleshooting
description: Error-first fixes for template validation, routing, render params, config, deploy modes and the status server.
icon: life-buoy
---

# Troubleshooting

Most gramstax failures are raised before the thing you cared about happens, and
the message names the fix. So the entry point is the string, not the subsystem.
Source references are file paths only, and messages are verbatim unless marked
as a prefix.

## Quick index

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `Template ... (start.html, line 4): ...` | a block, attribute or value was rejected | `static template` |
| `AOT blocked for template ...` | `<g-script>` or `{~~ ~~}` reached the build | the template |
| `Label not found, ...` | a keyboard block has no `static label` | `src/blocks/g-keyboard.ts` |
| A tap does nothing | the page has no callback handler | the destination page class |
| An update arrives, nothing responds | `handle*` name or intent does not match | the handler and `buildData` |
| `renderText illegal combination: ...` | params carry fields the route never reads | the `render*()` call site |
| `Invalid gramstax config at ...` | config field missing, misspelled, wrong type | `gramstax.config.ts` |
| `optionsDeploy branch '...' does not match deploy '...'` | two live branches, or the wrong one | `optionsDeploy` |
| `Worker manifest not found at ...` | the build has not run for that target | `.gramstax/` |
| `Status server listening on ...` never appears | the status server could not bind | `statusServerPort` |

### Template validation failures

`TemplateManager` throws once per template, with file and line
(`packages/gramstax/src/template/manager.ts`). The `on base "..."` prefix appears
only when the offending line sits inside a `<g-base id="...">`:

```text
Template on base "kb" (start.html, line 1): Unsupported template block: <kop>
Missing <g-base> block: template content must be wrapped in <g-base>...</g-base>
Mismatched closing tag: expected </g-base> but found </g-keyboard>
Block <g-button> is not allowed inside <g-keyboard>
Block <g-media> must be self-closing: use <g-media /> instead
```

Void blocks such as `g-space` and void Rich HTML elements must self-close; content
blocks must not. `TemplateEngine.validateTemplate` in
`packages/gramstax/src/template/engine.ts` adds three attribute shapes: unknown,
missing, or malformed. An unknown attribute is rejected and the message names
the allow-list (`<table> has unknown attribute(s): ngasal (allowed: bordered,
striped, is_compact)`), a missing one is listed (`<tg-emoji/> is missing
required attribute(s): emoji-id`), and a bad value is quoted (`<tg-time> unix
must be a positive integer (got "abc")`).

An unknown filter is not an error: it renders empty and logs once per compile,
with a prefix of `Unknown template filter "uppercase" in {{user.name|uppercase}}`.

`<g-script>` and every `{~~ ... ~~}` scope compile to `with(data ...)`, which ESM
forbids, so they work under `gramstax start` and hard-fail the build.
`packages/gramstax/scripts/aot-emit.ts` reports a prefix beginning `AOT blocked
for template "start" (base "kb"): body contains`. Move the logic into a page-class
method and interpolate it with `{{}}`. See
[the AOT contract](/guides/aot-contract).

### Keyboard blocks that throw

`BlockGKeyboard._build` fails before it looks at anything else
(`packages/gramstax/src/blocks/g-keyboard.ts`):

```text
Label not found, make sure set this.label from class extends LabelGKeyboard
Object value home not found
Language "id" not found in label "home"
```

The first means the block class is missing its `static label`, the second that the
key passed to `_build` is not a static on that label class, the third that the
entry has no `lang` key. See [templates](/concepts/templates).

### A page that never fires

Two different failures look identical from Telegram: silence.

**The page is not loaded.** `PageManager` takes the first *named* export, so a
default-exported class is `File /abs/src/pages/start.ts must have export (not
default) class page`, and a root-level `index.ts` is `Empty routeName for
"src/pages/index.ts"` rather than being allowed to swallow the tree. Both come
from `packages/gramstax/src/page/manager.ts`. Two files claiming one route are
fatal at build time (`Duplicate routeName "admin" from "admin.ts" and
"admin/index.ts". Each page file must map to a unique route.`,
`packages/gramstax/src/cli/collect.ts`), and two pages resolving to one identity
are rejected at boot by `packages/gramstax/src/core/bot.ts` with `Duplicate page
name "StartPage" in /abs/src/pages (StartPage). Each page must have a unique name
set via buildData({name: ...}) or derived from the filename.`

**The page is loaded but nothing dispatches to it.** See
[page routing](/concepts/page-routing) for the full `handle*` table. The most
common miss: the `Args` in the name and the `/cmd` in the input are independent.
`handleArgsText` is args without a command, `/cmd <args>` is
`handleCommandArgsText`, and the framework will not guess which you meant.

**The page is resolved but the button had no home**
(`packages/gramstax/src/core/ctx.ts`):

```text
Page "settings" referenced in inline keyboard does not define handleCallbackQueryData. The button would have no registered handler. Add "async handleCallbackQueryData()" to the page class.
```

Custom routes are checked too: `routeName must be a non-empty string starting
with 'handle'`, and `registerCustomRoute: unknown page "x". Register the page
first so custom routes dispatch to a known handler.`

### Render params rejected

A key the winning route would ignore is a compile error, not a silent drop, so
`{mode: "reply", fallback: "reply"}` does not typecheck. For callers who are not
typechecked, `Ctx._assertRenderRoute` in `packages/gramstax/src/core/ctx.ts`
throws the same rule. This is a prefix:

```text
renderText illegal combination: mode: "reply" + fallback: "reply"
```

The same shape appears for `broadcast.targets + ...` and `chunkSize + ...`.
Media arguments are validated too: `Media not found for template "start"` means
the page has no `<g-media>` block for that base.

### Missing or malformed config

Every message is prefixed with the file path
(`packages/gramstax/src/cli/config.ts`):

```text
Invalid gramstax config at /abs/gramstax.config.ts: cannot load module (...)
Invalid gramstax config at /abs/gramstax.config.ts: unknown field `tokenn` (supported: optionsDeploy, token, deploy, ...)
Invalid gramstax config at /abs/gramstax.config.ts: `cacheSession` uses removed bare {module, ...} form
```

The third is a prefix: wrap the ref as `{override: {module, ...}}`. A missing
config file is legal and yields `deploy: "polling"`, and an empty token fails
only on start, with `Token is not valid or empty`. If start cannot find your bot
class, two prefixes come from `packages/gramstax/src/cli/start.ts`: `gramstax
start: BotCore not found`, and `no Gramstax subclass export found in
/abs/src/core/bot.ts (export a class extending Gramstax, e.g. BotCore)`. The
second is nearly always two copies of gramstax, so `instanceof` fails.

### Session and cache misconfiguration

`CacheExternal` accepts exactly three shapes
(`packages/gramstax/src/cache/external.ts`):

```text
Unsupported cache storage URL "postgres://localhost/x". Use "memory", a "redis://..." URL, or pass more.forceStore.
```

On the config side `cacheSession` is `{store, ttlMs?, namespace?}`, a module path
string, or `{override: {module, export?, args?}}`, and nothing else. The lock is
Redis only, and on a memory store the bot runs every update unlocked with one
warning line as the only signal: a prefix of `sessionLock requires a Redis cache
backend (got memory store)` from `packages/gramstax/src/core/bot.ts`.

### Deploy mode mistakes

At most one `optionsDeploy` branch may be non-empty and it must equal `deploy`.
Both halves are enforced, at load and again at construction
(`packages/gramstax/src/core/bot.ts`):

```text
Invalid gramstax config at /abs/gramstax.config.ts: `optionsDeploy` must define at most one deploy branch (got `polling, webhook`)
Invalid gramstax config at /abs/gramstax.config.ts: optionsDeploy branch 'webhook' does not match deploy 'polling'
Params deploy "serverless" does not match non-empty optionsDeploy branch (expected optionsDeploy.serverless only)
Params deploy webhook requires optionsDeploy.webhook.secretToken to be a non-empty string matching ^[A-Za-z0-9_-]{1,256}$ (generate one with: openssl rand -hex 32)
```

The old colon grammar is gone and named specifically: `gramstax start: --deploy
must be one of polling, webhook, serverless, raw, test with optionsDeploy
{serverless, webhook, polling, raw, test} from gramstax.config.ts (legacy colon
forms are removed, got "webhook:https://example.com/hook")`. `raw` replaces the
removed `templateManager: {} as any` escape hatch. See
[deploy](/concepts/deploy).

### Build and serverless failures

`gramstax build` catches its own failures, logs one line and exits `1`
(`packages/gramstax/src/cli/build.ts`). The `--target` help text still names
`lambda, cloudflare-workers`, which are not the accepted values.

```text
gramstax build: pages directory not found: /abs/src/pages
gramstax build: unknown target lambda (supported: cloudflare-mod, aws-lambda-async)
gramstax build failed: <the underlying message>
```

The emitted entry reads its artifact and its secrets at runtime
(`packages/gramstax/src/cli/targets/`): `Worker manifest not found at
/abs/.gramstax/manifest.js (run gramstax build first)`, `BOT_TOKEN is not set
(required to construct the bot)`, `BOT_WEBHOOK_SECRET is not set (required
worker secret/var)`. Secrets come from platform bindings.

### Port, webhook and queue problems

A webhook URL must be real and http(s) (`packages/gramstax/src/core/bot.ts`,
`packages/gramstax/src/cli/config.ts`):

```text
deploy webhook URL must use http(s): "localhost:3000/hook"
Invalid gramstax config at /abs/gramstax.config.ts: `optionsDeploy.webhook.url` must be a real https:// URL with no `<placeholder>` (got `https://<your-domain>/webhook`)
```

The status server is opt-in through `statusServerPort`. If you set it and never
see `Status server listening on 127.0.0.1:3001 (/health, /stats, /metrics)`, the
bind failed: `Failed to start status server: <the underlying error>` is logged
rather than thrown, so a port already in use is the usual cause. Queue problems
after shutdown come from `packages/gramstax/src/update/queue.ts`:
`WebhookQueue is closed` and `WebhookQueue enqueue aborted`.

### Getting more signal

Turn the logger on before debugging anything else. In `gramstax.config.ts`,
`log: true` mounts the default logger and `log: {force: "file"}` writes to disk.

Three endpoints answer on the status server, and the webhook server serves the
same ones: `GET /health` returns `{status: "ok"}` and is always open, `GET /stats`
returns the `MetricsStore` snapshot as JSON, and `GET /metrics` returns
Prometheus exposition text. When a webhook `secretToken` is configured, `/stats`
and `/metrics` answer `401` without a matching
`X-Telegram-Bot-Api-Secret-Token` header. The counters that answer "why did
nothing happen" are `noMatch`, `noHandler` and `dropped`; for per-update detail,
`Gramstax` exposes `hookUpdate`, `hookUpdateError` and `hookTrace`.