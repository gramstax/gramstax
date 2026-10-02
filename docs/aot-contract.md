# AOT contract (`gen/manifest.js`)

Ahead-of-time template build: freezes `.html` templates into importable JS modules with zero runtime codegen, for runtimes without the `Function` constructor (Workers).

```bash
bun packages/gramstax/scripts/build-manifest.ts <pagesDir> <outDir> --aot
# AOT written to <outDir>/gen (3 pages, 1 templates, 3 routes)
```

## Output tree

```text
.gramstax/
  routes.json      # frozen route list (023)
  manifest.js      # static-import manifest (023)
  gen/
    <key>.g.js     # one module per template key (`sub/note` → `sub_note.g.js`)
    manifest.js    # `{templates: Record<key, ITCompiledTemplate>}`
```

`gen/manifest.js` exact shape (verified output):

```js
import {template as start} from "./start.g.js"
export const templates = {"start": start}
```

Per-key module shape (verified output):

```js
import {__esc, FILTERS} from "gramstax"
function __fn0(data, __esc, FILTERS) {return ""+("Hello "+(__esc(FILTERS.upper((data?.name)) ?? ""))+"!")}
const fn0 = (data) => __fn0(data, __esc, FILTERS)
export const template = {media: {"default": {}}, ..., message: {"default": {"default": fn0}}, ...}
```

Single `export const template` matches `ITCompiledTemplate` (absent blocks omitted); `pages` stays in userland source (023 `manifest.js`).

## Link-table mechanics (3 lines)

1. Build collects every `_compileToFunction` body while `__emitHook` is installed; message/keyboard-style leaves freeze into the `__fN`/`fN` pairs above.
2. Media-style leaves are engine closures (opaque to any walk), so those fields rebuild at import: bodies go into a `Map` keyed `${isArray}:${body}`, `__linkHook` resolves hits (miss throws = template drift, regenerate), then the same block compilers re-run on the embedded raw template.
3. Emitted files contain zero codegen tokens (`new Function`, `Function(`, `eval(`) — asserted by test on every emitted file, including under a sabotaged `globalThis.Function`.

## Consuming (024)

```ts
import {templates} from `./.gramstax/gen/manifest.js`
const manager = new TemplateManager({path: [emptyDir]})
for (const [key, template] of Object.entries(loaded.templates)) manager._registerCompiled(key, template)
```

Registered templates render identically to JIT for all 15 `ICompiledTemplate` fields — proven by `template.aot-parity.test.ts` (media, poll, venue, dice, callbackAnswer, precheckoutError, shippingError, inlineButton, answerNote, gift, invoice, paidMedia, message, keyboard, description × 2 datasets each). One field per `compileBlockG*` static on `TemplateEngine`; there is no single dispatcher method.

## v1 limits

- Script blocks rejected at build: `AOT blocked for template "<key>" (<id>): body contains \`with(\` — \`with\` is forbidden in ESM strict mode ... Move the logic into the page class (a method returning plain data) instead of \`{~~ ... ~~}\` / \`<g-script>\``. Applies to `{~~ ... ~~}` and `<g-script>` alike (both compile to `with(data ...)`).
- Runtime-dynamic templates impossible: AOT freezes bodies at build time, so templates assembled at runtime (string-concatenated sources, per-request codegen) cannot be emitted — only static `.html` sources.
- Filenames are sanitized (`safeKey`): any non-identifier character becomes `_`, leading digits gain a `_` prefix. Distinct keys mapping to one filename (`a/b` vs `a_b`) collide — keep keys distinct.

## v2 roadmap

- `with`-removal: compile script blocks to strict-safe closures instead of rejecting them.
- True ref-emission for wrapper blocks: engine cooperation (e.g. an assembler taking explicit args) so media-style fields freeze like message/keyboard instead of rebuilding at import.

## Implementation map

- `packages/gramstax/scripts/aot-emit.ts` — `AotEmitter` (collect, guard, emit, `safeKey`)
- `packages/gramstax/scripts/build-manifest.ts` — `generate(..., {aot})` + `--aot` CLI (additive; legacy single-file contract unchanged)
- `packages/gramstax/src/template/engine.ts` — `__emitHook` (collect) + `__linkHook` (link); hook unset ⇒ exact JIT path
- `packages/gramstax/src/template/manager.ts` — `_registerCompiled` (Phase 2; no validation, no reload)
