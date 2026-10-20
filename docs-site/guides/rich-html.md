---
title: Telegram Rich HTML
description: The 54 Telegram tags gramstax passes through to the message html field, and the three validation layers that police them at compile time.
icon: code-xml
---

# Telegram Rich HTML

Inside a `<g-message>`, everything that is not a `<g-*>` block is Telegram
markup, and it goes straight to the message `html` field. There are **54**
allowed tags, validated against Telegram Bot API **10.3**
(`TemplateEngine.BOT_API_VERSION`). The vocabulary is closed: an unrecognised
tag is a compile error, not a silently shipped string.

Validation runs in three layers before a template is compiled, so a page that
would have failed at send time fails at build time instead. The PAGE blocks
that carry this markup, and the compile pipeline they pass through, are covered
in [Template Blocks](/guides/template-blocks).

## The counts

`TemplateEngine` keeps the tag set in two pieces and unions them:

| Constant | Size | What it holds |
| --- | --- | --- |
| `ALLOWED_BLOCKS_TELEGRAM_LEGACY` | 9 | the original `parse_mode="HTML"` tags |
| `ALLOWED_BLOCKS_TELEGRAM_RICH` | 45 | everything the Rich Message Formatting spec added |
| `ALLOWED_BLOCKS_TELEGRAM` | **54** | the union, and the single source of truth |
| `ALLOWED_BLOCKS` | 84 | the 54 Telegram tags plus the 30 PAGE blocks |

The legacy 9 are `b`, `i`, `u`, `s`, `code`, `pre`, `a`, `blockquote` and
`blockquote expandable`.

## The 54 tags

Grouped by what they do, which is the same five-way split the source uses:

| Group | Count | Tags |
| --- | --- | --- |
| Inline | 15 | `a`, `b`, `code`, `del`, `em`, `i`, `ins`, `mark`, `s`, `strike`, `strong`, `sub`, `sup`, `tg-spoiler`, `u` |
| Block and structural | 24 | `aside`, `blockquote`, `blockquote expandable`, `br`, `caption`, `details`, `footer`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`, `td`, `th`, `tr`, `ul` |
| Telegram-specific | 8 | `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`, `tg-reference`, `tg-slideshow`, `tg-time` |
| Media | 6 | `audio`, `cite`, `figcaption`, `figure`, `img`, `video` |
| Forms | 1 | `input` |
| **Total** | **54** | |

<AccordionGroup>
  <Accordion title="Inline formatting (15)">
    `a`, `b`, `code`, `del`, `em`, `i`, `ins`, `mark`, `s`, `strike`, `strong`,
    `sub`, `sup`, `tg-spoiler`, `u`

    `a` and `code` are the only inline tags with attributes: `a` takes `href`
    or `name`, and `code` takes `class` as a `language-*` token. The other
    thirteen accept nothing at all.
  </Accordion>

  <Accordion title="Block and structural (24)">
    `aside`, `blockquote`, `blockquote expandable`, `br`, `caption`, `details`,
    `footer`, `h1` to `h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`,
    `td`, `th`, `tr`, `ul`

    `ol` carries `start`, `type` and `reversed`. `li` carries `value`, `type`,
    `checkbox` and `checked`. `table` carries `bordered`, `striped` and
    `is_compact`; `td` and `th` each carry `colspan`, `rowspan`, `align` and
    `valign`. `blockquote` carries `cite` and `expandable`, `aside` carries
    `cite`, `details` carries `open`.
  </Accordion>

  <Accordion title="Telegram-specific (8)">
    `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`,
    `tg-reference`, `tg-slideshow`, `tg-time`

    Four of them need attributes to mean anything: `tg-emoji` needs `emoji-id`,
    `tg-map` needs `lat`, `long` and `zoom`, `tg-reference` needs `name`, and
    `tg-time` needs `unix` (`format` is optional but validated when present).
    `tg-collage`, `tg-math`, `tg-math-block` and `tg-slideshow` take none.
  </Accordion>

  <Accordion title="Media (6)">
    `audio`, `cite`, `figcaption`, `figure`, `img`, `video`

    `img`, `video` and `audio` each require `src`. `img` also accepts `alt` and
    `tg-spoiler`; `video` also accepts `tg-spoiler`. `cite`, `figcaption` and
    `figure` take none.
  </Accordion>

  <Accordion title="Forms (1)">
    `input`

    `type` is required and the only value Telegram supports is `checkbox`, which
    is what makes this a checklist item. `checked` is the other allowed
    attribute.
  </Accordion>
</AccordionGroup>

## Layer 1: required attributes

`_TELEGRAM_REQUIRED_ATTRS` has **9** entries. Two shapes are supported: a
`string[]` where every entry must be present, and `{oneOf: string[][]}` where
one complete set is enough. Only `a` uses the second.

| Tag | Required |
| --- | --- |
| `a` | one of `href` or `name` |
| `img` | `src` |
| `video` | `src` |
| `audio` | `src` |
| `tg-emoji` | `emoji-id` |
| `tg-time` | `unix` (`format` is optional, value-checked when present) |
| `tg-map` | `lat`, `long`, `zoom` |
| `tg-reference` | `name` |
| `input` | `type` |

The other 45 tags have no required attributes. `{{placeholder}}` counts as a
value, so `<tg-time unix="{{unix}}">` passes this layer.

## Layer 2: value formats

`_TELEGRAM_ATTR_VALUE_VALIDATORS` has **18** entries. Each validator returns
`null` when the value is acceptable, or a message naming the attribute and what
it got. This layer runs after layer 1, so a missing attribute is reported as
missing rather than as a format problem.

| Tag | Attribute | Rule |
| --- | --- | --- |
| `tg-time` | `unix` | positive integer (`/^[1-9]\d*$/`) |
| `tg-time` | `format` | `r`, or a weekday / date / time combination such as `t`, `w`, `d`, `D`, `wDT` |
| `tg-map` | `lat` | number in [-90, 90] |
| `tg-map` | `long` | number in [-180, 180] |
| `tg-map` | `zoom` | integer in [13, 20] |
| `tg-emoji` | `emoji-id` | numeric string |
| `a` | `href` | `http(s)://`, `mailto:`, `tel:`, `tg://user?id=` or `#` scheme |
| `a` | `name` | non-empty |
| `img` | `src` | `http(s)://` or `tg://emoji`, `tg://photo`, `tg://document` reference |
| `img` | `alt` | non-empty |
| `video` | `src` | `http(s)://` or `tg://video`, `tg://document` reference |
| `audio` | `src` | `http(s)://` or `tg://audio`, `tg://document` reference |
| `input` | `type` | exactly `checkbox` |
| `ol` | `start` | non-negative integer |
| `ol` | `type` | one of `1`, `a`, `A`, `i`, `I` |
| `li` | `value` | non-negative integer |
| `li` | `type` | one of `1`, `a`, `A`, `i`, `I`, `checkbox` |
| `table` | see below | boolean presence attributes |
| `td`, `th` | `colspan`, `rowspan` | positive integer |
| `td`, `th` | `align` | `left`, `center` or `right` |
| `td`, `th` | `valign` | `top`, `middle` or `bottom` |
| `blockquote`, `aside` | `cite` | `http(s)` URL |
| `tg-reference` | `name` | non-empty |
| `code` | `class` | a `language-*` token |

Boolean attributes are presence-validated with a `() => null` entry, so
`reversed`, `bordered`, `striped`, `is_compact`, `expandable`, `open`,
`checked`, `checkbox` and `tg-spoiler` are accepted bare and carry no value
check. A value containing `{{` or `}}` is skipped by this layer entirely: the
framework performs no runtime re-check, so the sent message is where Telegram
gets to object.

```html
<tg-time unix="1647531900">a minute ago</tg-time>   <!-- valid -->
<tg-time unix="abc">a minute ago</tg-time>          <!-- rejected by layer 2 -->
<tg-time unix="{{unix}}">a minute ago</tg-time>    <!-- valid: skipped at compile time -->
```

## Layer 3: unknown attributes

`_TELEGRAM_ALLOWED_ATTRS` has **53** keys, one per distinct tag name. The 54
tag entries collapse to 53 keys because `<blockquote>` and
`<blockquote expandable>` normalise to the same name. Any attribute name
outside the list is an error, and the message names what the tag does accept.

```html
<table ngasal="x"><tr><td>1</td></tr></table>
<b class="x">text</b>
<!--
<table> has unknown attribute(s): ngasal (allowed: bordered, striped, is_compact)
<b> does not support any attributes
-->
```

Two consequences worth stating plainly:

- **35 tags allow no attributes at all.** `b`, `del`, `em`, `i`, `ins`, `mark`,
  `s`, `strike`, `strong`, `sub`, `sup`, `tg-spoiler`, `u`, `br`, `footer`,
  `h1` to `h6`, `hr`, `p`, `pre`, `summary`, `tr`, `ul`, `tg-collage`,
  `tg-math`, `tg-math-block`, `tg-slideshow`, `cite`, `figcaption`, `figure`,
  `caption`. Any attribute on one of them is an error.
- **Generic HTML attributes are not supported.** `style`, `id` and `data-*` are
  outside the spec and therefore outside the allowlist. `{{placeholder}}` is
  valid as a value but never as an attribute name.

Coverage is locked by two tests in the package, one iterating every tag to prove
it has a validator or registry entry, and one running an exhaustive tag by
attribute matrix plus per-tag unknown-attribute rejection.

## Void elements must self-close

`validateFormatBlock` holds one set of void tags. Five of them are reachable
Telegram tags: `br/`, `hr/`, `img/`, `input/` and `tg-map/`. The set also lists
`space` and `import`, but the check compares against the captured tag name,
which for those is `g-space` and `g-import`, so those two entries never match.
Write them self-closing by convention; the two PAGE blocks are covered in
[Template Blocks](/guides/template-blocks).

```html
<hr/>
<img src="https://example.com/a.jpg"/>
<input type="checkbox" checked/>
<br/>
<tg-map lat="-6.2" long="106.8" zoom="16"/>
```

Content tags are **not** format-checked: both `<b>x</b>` and `<b/>` are
accepted, because a content tag is passed through untouched. Only the void set
has one correct spelling.

## Rich message limits

`validateBlockGMessageRich` checks each `<g-message>` body against the Bot API
rich-message limits:

| Limit | Value |
| --- | --- |
| Message length | 32768 characters |
| Blocks per message | 500, `<g-*>` blocks excluded |
| Nesting depth | 16 |
| Columns per table row | 20 |

<Note>
  The check approximates the rendered HTML by stripping `{{...}}` spans and
  `<g-*>` blocks from the body first. Interpolation that inflates the message at
  runtime is therefore not what this layer measures; it catches a source that is
  already too long.
</Note>

## A worked example

Everything on one page, with the validation layer each constraint comes from
named:

```html
<g-message>
  <h1>{{title|upper}}</h1>
  <p>Updated {{at|date:YYYY-MM-DD}}</p>

  <table bordered striped>
    <tr><th>Item</th><th align="right">Price</th></tr>
    <tr><td>{{itemName}}</td><td align="right">{{itemPrice|number:2}}</td></tr>
  </table>

  <details open>
    <summary>How this works</summary>
    <ol start="1" type="a">
      <li>Pick a base</li>
      <li>Render it</li>
    </ol>
  </details>

  <tg-time unix="{{unix}}" format="wDT">just now</tg-time>
  <tg-emoji emoji-id="5368324170671202286"></tg-emoji>
  <input type="checkbox" checked/>
  <a href="https://example.com/changelog">Full changelog</a>
</g-message>
```

- `<h1>`, `<p>`, `<summary>`: tags from `ALLOWED_BLOCKS_TELEGRAM`, with empty
  attribute allowlists, so layer 3 has nothing to complain about.
- `<table bordered striped>`: both names are allowlisted and both are boolean
  presence attributes, layers 2 and 3.
- `<th align="right">`: `align` is allowlisted and must be `left`, `center` or
  `right`, layers 2 and 3.
- `<ol start="1" type="a">`: `start` is a non-negative integer and `type` is one
  of `1`, `a`, `A`, `i`, `I`, layer 2.
- `<tg-time unix="{{unix}}">`: `unix` is required, layer 1. The `{{...}}` value
  skips layer 2, and no runtime check replaces it: the value is sent as-is.
- `<tg-emoji emoji-id="...">`: `emoji-id` is required, layer 1, and must be
  numeric, layer 2.
- `<input type="checkbox" checked/>`: `type` is required and must be `checkbox`,
  layer 1 and 2; `<input/>` is void, so it must self-close.
- `<a href="https://...">`: `href` satisfies the `oneOf` required rule, and the
  scheme check in layer 2 passes.

## Related

<Columns cols={3}>
  <Card title="Template Blocks" icon="blocks" href="/guides/template-blocks">
    The 30 PAGE blocks, their attributes, and where the compile pipeline runs.
  </Card>
  <Card title="Filters" icon="filter" href="/guides/filters">
    The six compile-time pipes and the escaping `{{}}` applies before this.
  </Card>
  <Card title="Templates" icon="file-code" href="/concepts/templates">
    Where a rich `<g-message>` body sits in the wider page model.
  </Card>
</Columns>