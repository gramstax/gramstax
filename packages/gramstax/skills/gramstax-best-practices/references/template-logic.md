# template-logic

Conditionals live in templates (`<g-ifelse>`, `<g-switch>`); one base with toggles beats many near-identical bases.

## Why

Splitting small content variations across base ids multiplies keyboards, `g*` objects, and e2e cases for the same view. A conditional keeps one source of truth; separate bases are for fundamentally different structures. Base ids and `<g-import/>` are the sharing mechanisms available.

## Incorrect

```typescript
// three bases differing by one line — triple the keyboards, objects, tests
const template = `
  <g-base id="ok"><g-message>Paid</g-message></g-base>
  <g-base id="fail"><g-message>Failed</g-message></g-base>
`
```

```typescript
// `<g-script>` compiles to `with(data ...)`, which is fine in JIT dev and a
// hard BUILD FAILURE under AOT — see template-aot.md
const template = `<g-base><g-script>if (status === 'paid') { show('Paid') }</g-script></g-base>`
```

```typescript
// every `{~~}` emits `with(data || {})`, a hard BUILD FAILURE under AOT — even
// `{~ i + 1 ~}`. `<g-ifelse>` is the AOT-safe spelling. See template-aot.md
const template = `<g-base><g-message>{~deletedAt ? "Yes" : "No"~}</g-message></g-base>`
```

## Correct

```typescript
const template = `
  <g-base><g-message><g-switch value="status"><g-case is="paid">Paid</g-case><g-default>Failed</g-default></g-switch></g-message></g-base>
`
```

```typescript
// logic in the page class, template only emits values
export class ReportPage extends PageBase {
  async helper_summary() {
    const rows = await this.db.rows()
    return {total: rows.length, label: `Total: ${rows.length}`}
  }
}
```

## The block registry

`TemplateEngine.ALLOWED_BLOCKS_PAGE` (`src/template/engine.ts:273`) — the authoritative list of 29 PAGE blocks:

```text
<g-base>  <g-message>  <g-keyboard>  <g-media>  <g-media-group>
<g-poll>  <g-question>  <g-option>  <g-invoice>  <g-price>
<g-paid-media>  <g-venue>  <g-dice>  <g-description>
<g-callback-answer>  <g-precheckout-error>  <g-shipping-error>
<g-inline-button>  <g-answer-note>  <g-gift>
<g-script>  <g-ifelse>  <g-switch>  <g-case>  <g-default>  <g-map>  <g-div>
<g-import/>  <g-space/>
```

Telegram Rich tags extend the list via `ALLOWED_BLOCKS_TELEGRAM` — see `template-rich.md`. Scope syntax is `ALLOWED_SCOPE = ['{{}}', '{~~}']` (`src/template/engine.ts:719`): `{{key}}` escapes, `{{{key}}}` is raw, `{{key|filter:arg}}` chains pipes. `{~~}` is JIT-only — it emits `with(` and fails the AOT build, so it cannot appear in any template that gets built.

The 15 `ICompiledTemplate` output fields map to these blocks one-for-one and are what the AOT parity suite locks — see `template-aot.md`.

## Structure

| Concern | Use |
| --- | --- |
| swap a value | `<g-ifelse>` — `<g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse>` |
| iterate a list | `<g-map src="items">` — see [Looping](#looping) |
| compute a value | page-class helper, then `{{value}}` — see `template-scope.md` |
| swap whole branches | `<g-switch>` / `<g-case>` / `<g-default>` at block level |
| share a keyboard | `kbk` block, or `<g-import/>` — see `keyboard-reuse.md` |
| share step objects across a page family | base-class `g*` — see `pages-base-classes.md` |
| share markup inside one template | `<g-import/>` |
| compute anything non-trivial | page class method, interpolated as data |

## Looping

`<g-map src="items">` binds three variables per iteration:

| Variable | Meaning |
| --- | --- |
| `{{e.field}}` | current element property |
| `{{i}}` | index, **0-based** |
| `{{ord}}` | ordinal, **1-based** — `i + 1` |

Use `{{ord}}` for anything a human reads (positions, "no. 1"). Never reach for `{~ i - -1 ~}`: it computes the same thing and fails `gramstax build`, since every scope emits `with(`.

```html
<g-map src="arr" join="\n\n">
  Position: {{ord}}
  Number: {{e.number}}
</g-map>
```

- Filters work on all three: `{{e.name|upper}}`, `{{i|number:2}}`, `{{ord|number:2}}`.
- Nested maps add a depth suffix: `e2`, `i2`, `ord2`. Bare names bind the innermost map; the suffixed name binds that depth explicitly.
- **These names shadow `data` inside the map.** `{{ord}}` inside a `<g-map>` is the loop ordinal, not `data.ord`; outside any map it is `data.ord`. Same pre-existing rule as `{{i}}` and `{{e}}`.
- `src` takes a literal path, not an interpolation — `src="items"`, never `src="{{items}}"` (that is a raw `SyntaxError`; `<g-media src="{{…}}">` *is* supported, so the inconsistency is real).

## Notes

- Attribute values accept double-quoted, single-quoted, or bare syntax.
- `<g-switch value>` / `<g-case is>` mismatches render the `<g-default>` branch (or empty) — always provide one.
- `<g-import/>` and `<g-space/>` are void: self-close them.
- **`<g-script>` and every `{~~ ... ~~}` scope are AOT-blocked.** Both emit `with(`, forbidden in ESM strict mode, so `gramstax build` throws — for scopes this is unconditional, not only for conditionals. They work under `gramstax start` (JIT) and then fail the edge — the worst possible split. Use `<g-ifelse>` for conditionals, a page-class helper for computed values.
- `ALLOWED_BLOCKS_PAGE` gained `<g-ifelse>` after v2.2.0 (28 → 29 blocks); the rest of the v2.2.0 release delta was config-driven boot and AOT.

## `<g-ifelse>`

The AOT-safe conditional. The body is one JavaScript expression that must actually branch; bare identifiers are rewritten to optional `data` reads (`isAdmin` → `data?.isAdmin`), so nothing needs `with`.

```html
<g-ifelse>isAdmin ? "your admin" : "user"</g-ifelse>
<g-ifelse>isUser ? isBlock ? `account blocked` : `login success` : `please signup`</g-ifelse>
<g-ifelse>name || "Unknown"</g-ifelse>
```

Accepted bodies — anything containing `?:`, `&&`, `||`, or `??`:

```html
<g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse>
<g-ifelse>user.isAdmin && user.name</g-ifelse>
```

Four rules, all enforced by `validateBlockGIfElseBody` (`src/template/engine.ts:6138`):

| Rule | Rejected input | Message |
| --- | --- | --- |
| must branch | `items.length`, `formatPrice(total)` | `must be a conditional expression … Use {~~ items.length ~~} for a plain expression` |
| no interpolation | `isAdmin ? {{role}} : ""` | `must not contain {{}} or {~~} interpolation` |
| no `${}` in template literals | ``isAdmin ? `${a}-${b}` : ""`` | `must not use ${...} interpolation inside a template literal` |
| not empty | `<g-ifelse></g-ifelse>` | `body must not be empty` |

Notes:

- **No attributes.** The whole conditional is the body; there is nothing to configure.
- Allowed wherever `<g-script>` is — same parent list (`validatePositionsBlock`).
- Not self-closing; it is a regular block.
- Compose branches with `+`, not a template literal: `` (rss / 1048576).toFixed(1) + " MB" ``.
- Output is raw, exactly like `{~~}` — not `{{}}`-escaped.
- `&&`/`||` follow JavaScript and yield the falsy operand, so `isAdmin && name` renders `false`, not `""`. That matches `{~~}`, deliberately.
- `<g-ifelse>` is a leaf: it renders a string, so it cannot wrap `<g-message>` or `<g-keyboard>` children the way `<g-switch>` can. Branch over markup with `<g-switch>` — see `template-aot.md` for why `<g-script>` is not the answer.