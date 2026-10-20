---
title: Filters
description: The six compile-time pipes, the interpolation syntaxes they attach to, and why the filter list is a whitelist rather than a plugin point.
icon: filter
---

# Filters

A template interpolates with `{{}}`, and a filter post-processes what came out.
`{{price|number:2}}` is not parsed at render time: the pipe is resolved while
the template is compiled and becomes a chained call in the emitted body, so a
render is a function call over pre-resolved data and nothing else.

There are **6** filters, and the list is a closed `DEFAULT_FILTERS` object rather
than a registry you extend. An unknown filter renders empty and warns through
`console.warn` rather than reaching an evaluator. That is what lets a template
reshape a value without also being a code-execution surface, which is the same
guarantee [Template Blocks](/guides/template-blocks) makes about the block
vocabulary.

## Interpolation syntaxes

| Syntax | Escaping | Behaviour |
| --- | --- | --- |
| `{{key}}` | HTML-escaped | reads from `data`; nullish renders empty |
| `{{{key}}}` | raw | reads from `data`; for developer-authored markup only |
| `{{key\|filter:arg}}` | as `{{}}` | post-processing pipe, compiled into a chained call |
| `{{user.name\|upper}}` | as `{{}}` | dotted paths compile to optional chaining |
| `{~ expr ~}` | raw | inline JavaScript; the `{~~}` scope |
| `<g-ifelse>cond ? a : b</g-ifelse>` | raw | AOT-safe conditional, no `with` |

`{{}}` escapes exactly three code points: `&` becomes `&amp;`, `<` becomes
`&lt;`, `>` becomes `&gt;`. A non-string value is stringified, and `null` or
`undefined` becomes the empty string.

The escape applies wherever `{{}}` appears, attribute values included.
`_processScopeVariables` is a single pass over the template source, so
`src="{{url}}"` compiles to `src="${__esc(...)}"` exactly as a text node does.
Only the triple-brace form is raw, and it is raw in either position.

```html
<g-message>{{name}}</g-message>          <!-- name is escaped -->
<g-message>{{{markup}}}</g-message>      <!-- markup is inserted raw -->
<g-media type="photo" src="{{url}}">…</g-media>   <!-- escaped -->
<g-media type="photo" src="{{{url}}}">…</g-media> <!-- raw -->
```

<Warning>
  `{{{...}}}` is an escape hatch with no guard on the value, in text or in an
  attribute. Only interpolate raw values you wrote yourself; anything sourced
  from a user goes through `{{}}`.
</Warning>

Whitespace inside the braces is trimmed, so `{{ name }}` and `{{name}}` are the
same expression.

## The 6 filters

| Filter | Signature | Behaviour |
| --- | --- | --- |
| `upper` | `{{name\|upper}}` | `String(value ?? "").toUpperCase()` |
| `lower` | `{{name\|lower}}` | `String(value ?? "").toLowerCase()` |
| `number` | `{{price\|number:2}}` | `toFixed(2)`, default 0 decimals; non-numeric renders empty |
| `date` | `{{at\|date:YYYY-MM-DD}}` | UTC over `YYYY MM DD HH mm ss`, default `YYYY-MM-DD` |
| `plural` | `{{count\|plural:item:items}}` | first argument when the value is exactly `1`, second otherwise |
| `default` | `{{x\|default:N/A}}` | replaces undefined, null and empty string; `0` and `false` pass through |

### `upper` and `lower`

Nullish becomes the empty string rather than the four letters of `undefined`:

```html
<g-message>{{name|upper}}</g-message>   <!-- name: null  =>  ""   -->
```

### `number`

```ts
number: (value, decimals) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return ``
  return n.toFixed(decimals === undefined || decimals === `` ? 0 : Number(decimals))
}
```

Omitting the argument gives 0 decimals. Non-numeric input renders the empty
string, never the word `NaN`:

```html
<g-message>{{total|number:2}}</g-message>   <!-- 1234.5  =>  "1234.50" -->
<g-message>{{label|number}}</g-message>     <!-- "abc"    =>  ""        -->
```

### `date`

The value is coerced with `new Date(String(value))`. An unparseable value
renders empty. Everything is UTC, and the format string is a straight token
substitution, so any character that is not a token passes through untouched:

| Token | Meaning |
| --- | --- |
| `YYYY` | four-digit year |
| `MM` | month, zero-padded |
| `DD` | day of month, zero-padded |
| `HH` | hour, zero-padded |
| `mm` | minute, zero-padded |
| `ss` | second, zero-padded |

```html
<g-message>{{createdAt|date:YYYY-MM-DD}}</g-message>
<g-message>{{seenAt|date:DD/MM/YYYY HH:mm}}</g-message>
```

UTC is deliberate: a bot rendering the same message to two people in two
timezones should not produce two different strings for the same timestamp.

### `plural`

The whole argument is one string, and the split happens on the **first** colon:

```html
<g-message>{{count}} {{count|plural:item:items}}</g-message>
<g-message>{{count}} {{count|plural:entry:entries}}</g-message>
```

Everything after the first colon is the plural form, colons included, so
`{{n|plural:a:b:c}}` yields `a` at 1 and `b:c` everywhere else. Pick a
separator your strings do not already contain.

The test is `Number(value) === 1`, exactly. `"1"` and `1.0` coerce to 1 and take
the first branch; `0`, `2` and any non-numeric value take the second.

### `default`

```ts
default: (value, fallback) =>
  value === undefined || value === null || value === `` ? (fallback ?? ``) : value
```

Only those three values are replaced. `0` and `false` are values, and a page
that renders `0` for a counter is right to do so:

```html
<g-message>{{nickname|default:anonymous}}</g-message>  <!-- undefined => "anonymous" -->
<g-message>{{note|default:-}}</g-message>             <!-- ""        => "-"          -->
<g-message>{{count|default:0}}</g-message>             <!-- 0         => 0, unchanged -->
```

## Chaining

Pipes run left to right and each one receives the previous one's output:

```html
<g-message>{{user.name|upper|default:N/A}}</g-message>
<g-message>{{price|number:2}} USD</g-message>
<g-message>{{label|lower|upper}}</g-message>
```

The last example is not a round trip. Each pipe receives the previous result, so
`lower` then `upper` returns the uppercased string and the lowercase step changes
nothing in the final output. A pipe is a function call, not a reversible
transform.

## Why the whitelist matters

Filters are pure functions over a value plus compile-time string constants. The
chain compiles to a call on the `FILTERS` table, with the base expression
optional-chained and every filter argument embedded through `JSON.stringify`,
never as raw source:

```js
FILTERS.number(FILTERS.upper((data?.price)), "2")
```

Three consequences:

1. **A template cannot execute code through a pipe.** There is no eval path, no
   expression compiler and no hook to add one.
2. **An unknown filter is not a crash.** `_compileFilterChain` checks the name
   against the table; on a miss it writes a warning naming the filter to
   `console.warn` and emits an empty string. The rest of that chain is
   skipped, so a later filter in the same pipe never runs, but the rest of the
   template still renders, so a typo degrades one span rather than the message.
   The warning is deduplicated per scope pass, and `_processScopeVariables` runs
   once per block and label, so the same unknown filter in two blocks warns
   twice.
3. **Filters are the AOT-safe way to shape a value.** The emitted module
   imports `FILTERS` from `gramstax` rather than inlining the logic, which is
   what lets the build freeze a body. See
   [the AOT contract](/guides/aot-contract) for the emitted module shape.

<Note>
  The table is defined as `TemplateEngine.DEFAULT_FILTERS` and re-exported from
  the package barrel as `FILTERS`, the name the compiled body reads. It is a
  documented public surface rather than an internal detail. Generated code only
  reads it, so never mutate it at runtime.
</Note>

## Filters against `<g-ifelse>`

Both shape a value, and they have different reach.

| | `{{x\|filter}}` | `<g-ifelse>` |
| --- | --- | --- |
| Position | inside any `{{}}` expression | a block, in any block that accepts it |
| Reads | one `data` path | bare identifiers, rewritten to `data?.x` |
| Output | escaped (`{{{...}}}` for raw) | always raw |
| Can compute | no | yes, any expression that branches |

Between them the blocks cover what a pipe cannot: `<g-ifelse>` is the
conditional, `<g-switch>` the multi-way branch, `<g-map>` the loop.

```html
<g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse>
<g-switch value="status">
  <g-case is="1">Off</g-case>
  <g-default>On</g-default>
</g-switch>
<g-map src="rows" join="\n">{{ord}}. {{e.title}}</g-map>
```

Anything that has to compute rather than select goes in a page-class method and
arrives back through `{{}}`.

The four rules `<g-ifelse>` enforces are listed in
[Template Blocks](/guides/template-blocks): non-empty, no nested `{{}}` or
`{~ ... ~}`, no `${...}` inside a template literal, and an expression that
actually branches.

## `{~ expr ~}` is not AOT-safe

The inline execution scope evaluates developer-authored JavaScript with the
template's data in view. It works under `gramstax start`, and `gramstax build`
refuses a template that contains one, for the reason given in
[the AOT contract](/guides/aot-contract). Filters and `<g-ifelse>` cover most of
what it is used for; a page-class method covers the rest.

## Related

<Columns cols={3}>
  <Card title="Template Blocks" icon="blocks" href="/guides/template-blocks">
    The 29 PAGE blocks, including `<g-ifelse>`, `<g-map>` and `<g-script>`.
  </Card>
  <Card title="Telegram Rich HTML" icon="code-xml" href="/guides/rich-html">
    The 54 tags a filtered value can be dropped into.
  </Card>
  <Card title="AOT contract" icon="cpu" href="/guides/aot-contract">
    Why `gramstax build` refuses the inline execution scope.
  </Card>
</Columns>