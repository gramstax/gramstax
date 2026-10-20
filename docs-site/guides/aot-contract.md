---
title: AOT Contract (gen/manifest.js)
description: How gramstax build freezes templates into codegen-free JS modules, the exact gen/manifest.js output shape, and the limits of the AOT path.
icon: cpu
---

# AOT contract (`gen/manifest.js`)

Ahead-of-time (AOT) template build: freezes both `.html` templates and a page's
class-inline `static template` into importable JS modules with zero runtime
codegen, for runtimes without the `Function` constructor (Workers).

```bash
bun packages/gramstax/scripts/build-manifest.ts <pagesDir> <outDir> --aot
# AOT written to <outDir>/gen
```

## Output tree

```text
.gramstax/
  routes.json      # frozen route list
  manifest.js      # static-import manifest
  gen/
    <key>.g.js     # one module per template key (`sub/note` → `sub_note.g.js`)
    manifest.js    # `{templates: Record<key, ITCompiledTemplate>}`
```

`gen/manifest.js` exact shape (verified output):

```js
import {template as start} from "./start.g.js"
export const templates = {"start": start}
```

Per-key module shape, abridged to one base and one language:

```js
import {__esc, FILTERS} from "gramstax"
function __fn0(data, __esc, FILTERS) {return {text: ""+("Hello "+(__esc(FILTERS.upper((data?.name)) ?? ""))+"!"), rich: false}}
const fn0 = (data) => __fn0(data, __esc, FILTERS)
function __fn2(data, __esc, FILTERS) {return [""+("Refresh")]}
const fn2 = (data) => __fn2(data, __esc, FILTERS)
export const template = {
  media: {"default": {}},
  poll: {"default": {}},
  venue: {"default": {}},
  dice: {"default": {}},
  callbackAnswer: {"default": {}},
  precheckoutError: {"default": {}},
  shippingError: {"default": {}},
  inlineButton: {"default": {}},
  answerNote: {"default": {}},
  webAppAnswer: {"default": {}},
  gift: {"default": {}},
  invoice: {"default": {}},
  paidMedia: {"default": {}},
  message: {"default": {"default": fn0}},
  keyboard: {"default": {"default": {"inline": fn2}}},
  description: {"default": {}}
}
```

A message leaf returns `{text, rich}` and a keyboard leaf returns an array of
labels. `export const template` always carries all 16 `ICompiledTemplate` fields;
a block the template does not use is an empty per-base object, and a used one is
indexed by base id and then by language. `pages` stays in userland source, in
`manifest.js`.

## Link-table mechanics

<Steps>
  <Step title="Collect">
    Build collects every `_compileToFunction` body while `__emitHook` is installed;
    message/keyboard-style leaves freeze into the generated function pairs shown
    above.
  </Step>

  <Step title="Link">
    Media-style leaves are engine closures (opaque to any walk), so those fields
    rebuild at import: bodies go into a `Map` keyed `${isArray}:${body}`,
    `__linkHook` resolves hits (miss throws = template drift, regenerate), then the
    same block compilers re-run on the embedded raw template.
  </Step>

  <Step title="Assert">
    Emitted files contain zero codegen tokens (`new Function`, `Function(`,
    `eval(`): asserted by test on every emitted file, including under a sabotaged
    `globalThis.Function`.
  </Step>
</Steps>

## Consuming the output

```ts
import {templates} from "./.gramstax/gen/manifest.js"
import {TemplateManager} from "gramstax"

// no directory to scan: every template arrives pre-compiled
const manager = new TemplateManager({path: []})
for (const [key, template] of Object.entries(templates)) manager.registerCompiled(key, template)
```

<Check>
  Registered templates render identically to JIT for all 16 `ICompiledTemplate`
  fields: proven by `template.aot-parity.test.ts` (media, poll, venue, dice,
  callbackAnswer, precheckoutError, shippingError, inlineButton, answerNote,
  webAppAnswer, gift, invoice, paidMedia, message, keyboard, description × 2
  datasets each). One field
  per `compileBlockG*` static on `TemplateEngine`; there is no single dispatcher
  method.
</Check>

## Known limitations

<AccordionGroup>
  <Accordion title="Script blocks are rejected at build">
    The build fails with a message beginning ``AOT blocked for template "<key>"
    (<id>): body contains `with(` - `with` is forbidden in ESM strict mode``.
    Move the logic into the page class as a method that returns plain data,
    instead of writing it in `{~~ ... ~~}` or `<g-script>`. Both forms eventually
    call `with(data)`, which ESM strict mode does not allow.
  </Accordion>

  <Accordion title="Runtime-built templates cannot be emitted">
    AOT freezes bodies at build time, so templates assembled at runtime
    (string-concatenated sources, per-request codegen) cannot be emitted. The
    emitter can freeze a page's class-inline `static template`, keyed by its route
    name, and a static `.html` file under the pages directory. When both exist for
    one key, the `.html` file wins, matching boot precedence.
  </Accordion>

  <Accordion title="How are filenames sanitized?">
    Any non-identifier character becomes `_`, leading digits gain a `_` prefix.
    Distinct keys mapping to one filename (`a/b` vs `a_b`) collide: keep keys
    distinct.
  </Accordion>
</AccordionGroup>

## Implementation map

- `packages/gramstax/scripts/aot-emit.ts`: `AotEmitter` (collect, guard, emit, `safeKey`)
- `packages/gramstax/scripts/build-manifest.ts`: `generate(..., {aot})` + `--aot` CLI (additive; legacy single-file contract unchanged)
- `packages/gramstax/src/template/engine.ts`: `__emitHook` (collect) + `__linkHook` (link); hook unset ⇒ exact JIT path
- `packages/gramstax/src/template/manager.ts`: `registerCompiled` (Phase 2; no validation, no reload)
