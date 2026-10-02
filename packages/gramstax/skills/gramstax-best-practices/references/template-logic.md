# template-logic

Conditionals live in templates (`<g-switch>`, `{~~}`); one base with toggles beats many near-identical bases.

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

`TemplateEngine.ALLOWED_BLOCKS_PAGE` (`src/template/engine.ts:274`) — the authoritative list of 29 PAGE blocks:

```text
<g-base>  <g-message>  <g-keyboard>  <g-media>  <g-media-group>
<g-poll>  <g-question>  <g-option>  <g-invoice>  <g-price>
<g-paid-media>  <g-venue>  <g-dice>  <g-description>
<g-callback-answer>  <g-precheckout-error>  <g-shipping-error>
<g-inline-button>  <g-answer-note>  <g-gift>
<g-script>  <g-switch>  <g-case>  <g-default>  <g-map>  <g-div>
<g-import/>  <g-space/>
```

Telegram Rich tags extend the list via `ALLOWED_BLOCKS_TELEGRAM` — see `template-rich.md`. Scope syntax is `ALLOWED_SCOPE = ['{{}}', '{~~}']`: `{{key}}` escapes, `{{{key}}}` is raw, `{{key|filter:arg}}` chains pipes.

The 15 `ICompiledTemplate` output fields map to these blocks one-for-one and are what the AOT parity suite locks — see `template-aot.md`.

## Structure

| Concern | Use |
| --- | --- |
| swap a value | scope — `{~deletedAt ? "Yes" : "No"~}` |
| swap whole branches | `<g-switch>` / `<g-case>` / `<g-default>` at block level |
| share a keyboard | `kbk` block, or `<g-import/>` — see `keyboard-reuse.md` |
| share step objects across a page family | base-class `g*` — see `pages-base-classes.md` |
| share markup inside one template | `<g-import/>` |
| compute anything non-trivial | page class method, interpolated as data |

## Notes

- Attribute values accept double-quoted, single-quoted, or bare syntax.
- `<g-switch value>` / `<g-case is>` mismatches render the `<g-default>` branch (or empty) — always provide one.
- `<g-import/>` and `<g-space/>` are void: self-close them.
- **`<g-script>` and `{~~ ... ~~}` are AOT-blocked.** Both compile to `with(...)`, forbidden in ESM strict mode, so `gramstax build` throws. They work under `gramstax start` (JIT) and then fail the edge — the worst possible split. Move the logic into the page class.
- `ALLOWED_BLOCKS_PAGE` gained no new entries in v2.2.0; the release delta was config-driven boot and AOT.