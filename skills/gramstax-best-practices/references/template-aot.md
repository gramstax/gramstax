# template-aot

`gramstax build` always compiles templates ahead-of-time into `.gramstax/gen/`. Regenerate after every page or template change — staleness fails in three different ways, one of them silent.

## Why

Cloudflare Workers and other strict-ESM runtimes have no `Function` constructor, so a template that compiles at runtime cannot run there. AOT freezes each template into a plain JS module at build time. That unblocks the edge, but it moves compilation out of the request path and out of the dev loop: nothing tells you your `.gramstax/` is behind except the symptoms below, and the most common one is an empty string rather than an error.

## AOT is not optional

| Path | AOT? |
| --- | --- |
| `gramstax build` | **always** — no flag, `_runBuild(pages, out, true)` is unconditional |
| `gramstax start` / `gramstax start --watch` | never — disk scan + chokidar watcher, JIT compilation |
| `build-manifest.ts --aot` | the `--aot` flag exists **only** on this raw script |

So `bun run build:gramstax` in a deploy pipeline needs no extra flag, and adding `--aot` to `gramstax build` throws `unknown option`.

## Output

```text
.gramstax/gen/
  <key>.g.js       # one module per template key (`sub/note` → `sub_note.g.js`)
  manifest.js      # {templates: Record<key, ITCompiledTemplate>}
```

```js
// gen/manifest.js
import {template as start} from "./start.g.js"

export const templates = {`start`: start}
```

```js
// gen/start.g.js
import {__esc, FILTERS} from "gramstax"

function __fn0(data, __esc, FILTERS) {return ""+("Hello "+(__esc(FILTERS.upper((data?.name)) ?? ""))+"!")}
const fn0 = (data) => __fn0(data, __esc, FILTERS)

export const template = {media: {`default`: {}}, /* absent blocks omitted */ message: {`default`: {`default`: fn0}}}
```

Emitted files contain **zero** codegen tokens — no `new Function`, no `Function(`, no `eval(` — asserted per file by `template.aot-parity.test.ts`, including under a sabotaged `globalThis.Function`. That is the property that makes the edge target legal.

## Script blocks and scopes are rejected at build

```text
AOT blocked for template "<key>" (<id>): body contains `with(` - `with` is forbidden in ESM strict mode
```

`<g-script>` and **every** `{~~ ... ~~}` emit `with(...)`, which an ESM module cannot contain. For scopes this is unconditional: the `with(data || {})` retry is part of every scope body, so `{~ i + 1 ~}` fails exactly like `{~ a ? b : c ~}`. This is a hard build failure, not a stale artifact.

**Fix a conditional with `<g-ifelse>`** — it emits a plain optional-`data` ternary with no `with`, so it survives the edge:

```html
<g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse>
<g-ifelse>isUser ? isBlock ? `blocked` : `welcome` : `sign up`</g-ifelse>
```

There is no AOT-safe scope, so **a computed value moves into the page class** — a method returning plain data — and is interpolated with `{{}}`:

```typescript
// page class computes, template only emits
export class ReportPage extends PageBase {
  async helper_summary() {
    const rows = await this.db.rows()
    return {total: rows.length, label: `Total: ${rows.length}`} // plain data
  }
}
```

```html
<g-message>{{label}}</g-message>
```

`<g-ifelse>` renders a string, not markup, so it is not a replacement for branch-over-structure. **For branch-over-markup use `<g-switch>` / `<g-case>` / `<g-default>`**, which freeze as ordinary template functions.

## How linking works

1. Message/keyboard-style leaves freeze directly into the `__fn0`/`fn0` pairs above.
2. Media-style leaves are engine closures, opaque to any walk. The 7 fields in `RECOMPILE_FIELDS` — `dice`, `inlineButton`, `invoice`, `media`, `paidMedia`, `poll`, `venue` — rebuild at import from an embedded raw template: bodies go into a `Map` keyed `` `${isArray ? 1 : 0}:${body}` `` and the same block compilers re-run.
3. A link **miss throws** rather than degrading:

```text
AOT link miss for template "<key>": body not collected at build time (regenerate the module)
```

That is the self-healing case — the build tells you to regenerate rather than serving a hole.

## How staleness fails

Four distinct symptoms, from quietest to loudest:

| What you forgot | Symptom |
| --- | --- |
| edited a template, stale `gen/*.g.js` | `AOT link miss ... (regenerate the module)` — **throws** |
| added/renamed a page, stale `manifest.js` | `Route "<r>" in manifest.routes has no matching page ... Regenerate the manifest` — **throws** |
| template key missing from `gen/` | `X function not found for template "<key>"` for media/poll/venue/dice/etc — **throws** |
| template key missing, message/keyboard path | `getGMessage`/`getGDescription` swallow to `""` — **silent empty message** |
| stale manifest *content* (same pages, old templates) | serves the **old version with no error at all** |

The last two are the reason "I rebuilt and it still shows the old text" and "my message came out blank" are the two most confusing AOT reports. Manifest boot reads no directory and installs no watcher, so nothing detects the drift.

Discipline: treat any change under `src/pages/` or any `.html` as requiring `gramstax build`. There is no staleness check at boot.

## Parity suite

| Test | Locks |
| --- | --- |
| `template.aot-parity.test.ts` | all 16 `ICompiledTemplate` fields × 2 datasets, AOT output equals JIT, plus zero-codegen-token assertions |
| `template.aot-emit.test.ts` | emitter output shape |
| `template.aot-body.test.ts` | body collection, including under a sabotaged `Function` |
| `core.manifest-parity.test.ts` | manifest boot vs fs boot routing tables |
| `cli.build-parity.test.ts` | `gramstax build` output vs direct generation |
| `build-manifest.test.ts`, `cli.build.test.ts` | generator and CLI surface |

The 16 fields are `media`, `poll`, `venue`, `dice`, `callbackAnswer`, `precheckoutError`, `shippingError`, `inlineButton`, `answerNote`, `webAppAnswer`, `gift`, `invoice`, `paidMedia`, `message`, `keyboard`, `description` — one per `compileBlockG*` static. The block registry that produces them is in `template-logic.md`.

## Limits

- **Runtime-assembled templates cannot be AOT'd.** Only static `.html` sources and class-inline `static template` literals freeze; a string-concatenated source built per request cannot.
- **Filenames are sanitized** (`safeKey`): any non-identifier character becomes `_`, leading digits gain a `_` prefix. Distinct keys mapping to one filename (`a/b` vs `a_b`) collide — keep template keys distinct.
- **No dev AOT.** `gramstax start --watch` is JIT, so a template can work locally and fail the edge build. Run `gramstax build` in CI.

## Notes

- AOT artifacts are consumed only on manifest boot: `gen/manifest.js` is read and each template registered via `registerCompiled(key, template)`. Node deploys ignore `gen/` entirely; it exists for the edge.
- `--bundle` stubs four edge-impossible graphs with fail-fast errors — see `deploy-build.md`.
- `serverless` is the only deploy that auto-loads `.gramstax/`; on `polling`/`webhook` the build is inert, so a stale artifact cannot affect a Node deploy.
