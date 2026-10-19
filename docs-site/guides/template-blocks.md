---
title: Template Blocks
description: The 29 PAGE blocks, grouped by what they do, with the attributes, nesting rules and structural checks each one is subject to.
icon: blocks
---

# Template Blocks

A page's `static template` is the only place its markup lives. Inside it, a
`<g-*>` block is the unit a `render*()` call reads: you do not name a tag when
you call `renderText`, you name a `<g-base>` and let the block decide what gets
sent. There are **29** PAGE blocks and the vocabulary is closed, enforced by
`TemplateEngine.ALLOWED_BLOCKS_PAGE`. Anything that is not in that set and not
one of the Telegram tags is rejected at compile time.

For the keyboard builders (`LabelGKeyboard`, `BlockGKeyboard`) and per-block
languages, see [Templates](/concepts/templates). For how a key on the render
params reaches these blocks, see [the render contract](/concepts/render-contract).

## The 29 blocks

| Group | Blocks | Count |
| --- | --- | --- |
| Structure and sharing | `g-base`, `g-import/`, `g-space/` | 3 |
| Logic | `g-script`, `g-ifelse`, `g-switch`, `g-case`, `g-default`, `g-map`, `g-div` | 7 |
| Content | `g-message`, `g-keyboard`, `g-media`, `g-media-group`, `g-poll`, `g-question`, `g-option`, `g-invoice`, `g-price`, `g-paid-media`, `g-venue`, `g-dice`, `g-description`, `g-gift` | 14 |
| Answers | `g-callback-answer`, `g-precheckout-error`, `g-shipping-error`, `g-inline-button`, `g-answer-note` | 5 |
| | **Total** | **29** |

The source splits them 20 content / 7 logic / 2 utility. The grouping above is
by role in a render call, which is how you actually reach for them.

## Structure and sharing

A `<g-base>` is the unit an `AGBaseId` points at. Give it an `id` when the same
page renders more than one layout; the render call then selects which one.

```html
<g-base id="home">
  <g-keyboard type="inline">Counter, Help</g-keyboard>
  <g-message>Home</g-message>
</g-base>

<g-base id="done">
  <g-import src="home" block="g-keyboard" base="home" />
  <g-message>Saved</g-message>
</g-base>

<g-space />
```

- **`g-base`** takes `id`. `<g-base>` must sit at the outermost level and cannot
  nest inside any other block.
- **`g-import/`** is the sharing block. `src` is the other template's key,
  `block` names what to pull (`all`, one block, or a comma-separated list),
  `base` picks the source base id (default `default`), `lang` selects the
  language, `section` is `all` (default) or `value`. Without `src` the tag is
  dropped, so `src` is required in practice even though no PAGE attribute is
  currently marked required.
- **`g-space/`** removes the line it sits on, which is how you keep template
  indentation out of the rendered text. It is void and must self-close.

### How `AGBaseId` picks the base

`AGBaseId` is part of the shared content half of every render params type, next
to `data`. Every getter on `TemplateManager` resolves the same way:

```ts
// the shape of every getG* lookup, e.g. getGMessage
const one = map?.message?.[AGBaseId] ?? map?.message?.default
```

So an `AGBaseId` with no matching base falls back to the `default` base rather
than failing. Language resolution sits one level deeper, inside the base:
`one?.[ALang] ?? one?.default`.

<Warning>
  Define `<g-base id="x">` and the keyboard builder needs the same `x`. A base id
  the template has but the builder does not is the single most common cause of
  "keyboard bindings do not work".
</Warning>

## Logic

Conditionals live in the template rather than in a near-duplicate base.

```html
<g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse>

<g-switch value="status">
  <g-case is="1">Off</g-case>
  <g-case is="2">Pending</g-case>
  <g-default>On</g-default>
</g-switch>

<g-map src="rows" join="\n\n">
  Position: {{ord}}
  Number: {{e.number}}
</g-map>

<g-div>
  This block strips its own indentation
  from every line.
</g-div>
```

- **`g-ifelse`** takes no attributes. The body must not be empty, must not
  contain `{{}}` or `{~ ... ~}`, must not use `${...}` inside a template
  literal, and must actually branch: a ternary or a `&&` / `||` / `??`
  short-circuit. A plain expression is rejected and the error points you at
  `{~ ... ~}` instead. Bare identifiers in the body are rewritten to
  `data?.x`, except reserved words, the in-scope names `data`, `__esc`,
  `FILTERS`, and the standard globals.
- **`g-switch`** takes `value`; **`g-case`** takes `is`; **`g-default`** takes no
  attributes and is optional. `g-case` and `g-default` may only appear directly
  inside `g-switch`.
- **`g-map`** takes `src` and `join`. `join` defaults to a newline. Inside, `{{e}}`
  is the current element, `{{e.prop}}` a property, `{{i}}` the 0-based index and
  `{{ord}}` the 1-based ordinal. Nested maps get depth suffixes: `{{e2}}`,
  `{{i2}}`, `{{ord2}}`.
- **`g-div`** takes no attributes and normalises its own content: leading
  indentation is stripped per line and the tags are removed.
- **`g-script`** takes no attributes.

### `g-script` and the `{~~}` scope

`<g-script>` and the `{~~}` inline execution scope both compile to a `with(`
statement. `gramstax start` runs them fine, because it compiles with
`new Function`. `gramstax build` refuses them, because `with` is illegal in ESM
strict mode.

<Warning>
  There is no partial mode. Either your templates stay free of `g-script` and
  `{~~}`, or the build fails and names the block it rejected. For anything
  computed, put it in a page-class method and interpolate the result with
  `{{}}`.
</Warning>

`<g-ifelse>` is the AOT-safe conditional: it emits a plain optional-`data`
ternary, never a `with`. [The AOT contract](/guides/aot-contract) owns the exact
emitted-module shape and the limits of the build path; it is not restated here.

## Content

```html
<g-message>Plain or rich, {{escaped}}</g-message>

<g-keyboard type="inline">Counter, Help, Refresh</g-keyboard>
<g-keyboard type="bottom">Home, Keyboard</g-keyboard>

<g-media type="photo" src="https://example.com/a.jpg">Caption goes here</g-media>

<g-media-group>
  <g-media type="photo" src="a.jpg">…</g-media>
  <g-media type="video" src="b.mp4">…</g-media>
</g-media-group>

<g-poll type="quiz" correct="0">
  <g-question>2 + 2?</g-question>
  <g-option>3</g-option>
  <g-option>4</g-option>
</g-poll>

<g-invoice title="Pro" description="30 days" payload="sub-42" currency="USD">
  <g-price label="Monthly" amount="999" />
</g-invoice>

<g-paid-media stars="100">
  <g-media type="photo" src="a.jpg">…</g-media>
</g-paid-media>

<g-venue title="HQ" address="Somewhere" latitude="-6.2" longitude="106.8" />
<g-dice emoji="🎲" />
<g-description>Shown in the /command list</g-description>
<g-gift>Gift text</g-gift>
```

Structural rules beyond the attribute names, all enforced at compile time:

| Block | Rule | Constant or method |
| --- | --- | --- |
| `g-media-group` | 1 to 10 items; each item's `type` is `photo`, `video`, `audio` or `document` and `src` is required; audio or document items cannot be mixed with another type | `_validateMediaGroupItems` |
| `g-media` inside `g-media-group` or `g-paid-media` | `shared` includes the item in every language variant of the group | `validateBlockGMediaAttributes` |
| `g-poll` | exactly one `g-question`, 2 to 10 `g-option`; question 1 to 300 characters; option 1 to 100 characters | `_validatePollItems` |
| `g-poll type="quiz"` | `correct` is required and must be an option index; `multiple` is rejected, because a quiz is single-answer | `_validatePollItems` |
| `g-poll` regular | `correct` and `explanation` are rejected | `_validatePollItems` |
| `g-venue` | `title`, `address`, `latitude` and `longitude` are all required and non-empty | `_validateVenueItems` |
| `g-invoice` | `title`, `description`, `payload` and `currency` are required; `provider_token` is **forbidden** in a template; at least one `g-price` with a non-empty `label` and a positive `amount`; static `title` 1 to 32 characters, `description` 1 to 255, `payload` 1 to 128 bytes | `_validateInvoiceItems` |
| `g-paid-media` | `stars` required and within 1 to `MAX_PAID_MEDIA_STARS`; 1 to `MAX_PAID_MEDIA_ITEMS` `g-media` children, each `photo` or `video` with a non-empty `src` | `_validatePaidMediaItems` |
| `g-callback-answer` | plain text, no HTML, at most 200 characters | `_validateAnswerTextContent` |

`MAX_MEDIA_GROUP_ITEMS` is 10, matching the `sendMediaGroup` limit, and
excess items are truncated at compile time as well as rejected at validation.
`MAX_PAID_MEDIA_STARS` is 25000, the top of the `sendPaidMedia` Stars range,
and `MAX_PAID_MEDIA_ITEMS` is 10.

<Note>
  Static length and numeric checks skip any value carrying `{{}}` or
  `{~ ... ~}` interpolation, because the value is not knowable until render.
  Those cases are re-checked at runtime on the compiled block, not skipped.
</Note>

## Answers

The text a query is answered with is a block too, so it is localizable and sits
with the rest of the page's markup.

| Block | Read by | Telegram call |
| --- | --- | --- |
| `g-callback-answer` | `renderCallbackAnswer` | `answerCallbackQuery` |
| `g-precheckout-error` | `renderPreCheckout` | `answerPreCheckoutQuery` |
| `g-shipping-error` | `renderShipping` | `answerShippingQuery` |
| `g-inline-button` | `renderInlineAnswer` | `answerInlineQuery` |
| `g-answer-note` | `renderGuestAnswer`, `renderWebAppAnswer` | validation only |

```html
<g-callback-answer>Saved</g-callback-answer>
<g-inline-button text="Search" start-parameter="q" />
<g-precheckout-error>Card declined</g-precheckout-error>
<g-shipping-error>We cannot ship there</g-shipping-error>
<g-answer-note>Note appended to the inline result</g-answer-note>
```

`g-callback-answer`, `g-precheckout-error`, `g-shipping-error` and
`g-answer-note` take `lang` only and must contain plain text with no HTML;
`g-callback-answer` is capped at 200 characters. `g-inline-button` takes `lang`,
`text` and `start-parameter`; `text` is required and non-empty, and a static
`start-parameter` must match the deep-link format `[A-Za-z0-9_-]` at most 64
characters. `{{}}` and `{~ ... ~}` values skip the static checks and are
enforced at runtime.

## Attribute reference

Twenty-seven of the 29 blocks have an attribute allowlist, checked by the
matching `validateBlockG*Attributes` method. An attribute outside the list is an
error naming the block, not a field quietly ignored.

| Block | Allowed attributes |
| --- | --- |
| `g-base` | `id` |
| `g-message` | `lang` |
| `g-keyboard` | `lang`, `type` |
| `g-media` | `lang`, `type`, `src`, `shared`, `filename`, `latitude`, `longitude`, `live`, `phone`, `first_name`, `last_name`, `vcard` |
| `g-media-group` | `lang` |
| `g-poll` | `lang`, `type`, `correct`, `explanation`, `anonymous`, `multiple` |
| `g-question` | none checked (no per-block attribute validator) |
| `g-option` | none checked (no per-block attribute validator) |
| `g-invoice` | `lang`, `title`, `description`, `payload`, `currency`, `provider_token` |
| `g-price` | `label`, `amount` |
| `g-paid-media` | `lang`, `stars` |
| `g-venue` | `lang`, `title`, `address`, `latitude`, `longitude` |
| `g-dice` | `lang`, `emoji` |
| `g-description` | `lang`, `scope` |
| `g-gift` | `lang` |
| `g-callback-answer` | `lang` |
| `g-precheckout-error` | `lang` |
| `g-shipping-error` | `lang` |
| `g-inline-button` | `lang`, `text`, `start-parameter` |
| `g-answer-note` | `lang` |
| `g-script` | none |
| `g-ifelse` | none |
| `g-switch` | `value` |
| `g-case` | `is` |
| `g-default` | none |
| `g-map` | `src`, `join` |
| `g-div` | none |
| `g-import/` | `src`, `block`, `base`, `lang`, `section` |
| `g-space/` | none |

### Value formats

`_PAGE_ATTR_VALUE_VALIDATORS` has **9** block entries covering the 19
attributes below. Each validator returns `null` for a valid value or a message
naming the attribute, the block and what it got.

| Block | Attribute | Accepted |
| --- | --- | --- |
| `g-base` | `id` | any non-empty string |
| `g-keyboard` | `type` | `inline` or `bottom` |
| `g-media` | `type` | `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact` |
| `g-media` | `shared` | `true` or `false` |
| `g-media` | `filename` | any string |
| `g-media` | `live` | positive integer, seconds |
| `g-poll` | `type` | `regular` or `quiz` |
| `g-poll` | `correct` | non-negative integer option index |
| `g-poll` | `explanation` | any string |
| `g-poll` | `anonymous`, `multiple` | `true` or `false` |
| `g-invoice` | `currency` | 3-letter uppercase code; `{{}}` and `{~ ... ~}` spans skip the static check |
| `g-price` | `amount` | positive integer in smallest units |
| `g-paid-media` | `stars` | positive integer 1 to 25000; dynamic spans skip the static check |
| `g-venue` | `title`, `address` | any string |
| `g-venue` | `latitude` | number in [-90, 90]; dynamic spans skip the static check |
| `g-venue` | `longitude` | number in [-180, 180]; dynamic spans skip the static check |
| `g-dice` | `emoji` | one of 🎲 🎯 🏀 ⚽ 🎳 🎰; dynamic spans skip the static check |

`TemplateEngine._PAGE_REQUIRED_ATTRS` is **empty**: no PAGE block has a
strictly required attribute. It exists so a future context-dependent
requirement has a home, and `validatePageAttributesBlock` already reads it.

Adding a rule is a one-line change: extend `_PAGE_ATTR_VALUE_VALIDATORS` and
every per-block method that delegates to it picks the rule up. `DICE_EMOJI` is
the shared set behind the `g-dice` check and the runtime assertion.

## Where blocks may sit

`validatePositionsBlock` walks the template with a stack and holds an allowed
parent per block:

| Parent | Children it accepts |
| --- | --- |
| outermost level | `g-base` only |
| `g-base` | `g-message`, `g-keyboard`, `g-media`, `g-media-group`, `g-poll`, `g-invoice`, `g-paid-media`, `g-venue`, `g-dice`, `g-description`, `g-import`, `g-script`, `g-space` |
| `g-media-group`, `g-paid-media` | `g-media` |
| `g-poll` | `g-question`, `g-option` |
| `g-invoice` | `g-price` |
| `g-message`, `g-keyboard`, `g-media`, `g-poll`, `g-question`, `g-option`, `g-description` | `g-switch`, `g-map` |
| `g-switch` | `g-case`, `g-default` |
| `g-case`, `g-default`, `g-map` | `g-map`, `g-div` |
| `g-base`, `g-message`, `g-description`, `g-keyboard`, `g-poll`, `g-question`, `g-option`, `g-case`, `g-default`, `g-map`, `g-div` | `g-script`, `g-ifelse` |

Telegram tags are passthrough and ignored here, so rich HTML can sit wherever
the block allows.

## Self-closing or paired

`validateFormatBlock` holds both sets and rejects the wrong spelling:

| Must self-close | Must use open and close tags |
| --- | --- |
| `g-space/`, `g-import/`, `br/`, `hr/`, `img/`, `input/`, `tg-map/` | 18 PAGE blocks: `g-base`, `g-message`, `g-keyboard`, `g-media`, `g-media-group`, `g-poll`, `g-question`, `g-option`, `g-invoice`, `g-paid-media`, `g-description`, `g-script`, `g-ifelse`, `g-switch`, `g-case`, `g-default`, `g-map`, `g-div` |

Everything else passes through unformat-checked: the 5 Telegram void tags beyond
the ones listed, every content Telegram tag, and 9 PAGE blocks (`g-price`,
`g-venue`, `g-dice`, `g-gift`, `g-callback-answer`, `g-precheckout-error`,
`g-shipping-error`, `g-inline-button`, `g-answer-note`) that appear in neither
set. For those, `<b>x</b>` and `<b/>` are both accepted, and the block is
written however it reads best.

## The compile pipeline

`TemplateManager.compile` runs the same sequence for a page's `static template`
and for a `.html` file under `src/pages`:

<Steps>
  <Step title="Validate the raw source">
    `validateTemplate` runs on the template exactly as authored, before any
    import is resolved.
  </Step>

  <Step title="Expand `<g-import/>`">
    `processGImportBlocks` replaces each import with its resolved blocks,
    recursively, against a shared import cache.
  </Step>

  <Step title="Validate again">
    The expanded template is validated a second time, so a bad block pulled in
    from another page fails in the page that pulled it.
  </Step>

  <Step title="Compile each block family">
    Fifteen `compileBlockG*` statics, one per `ICompiledTemplate` field:
    `media`, `poll`, `venue`, `dice`, `callbackAnswer`, `precheckoutError`,
    `shippingError`, `inlineButton`, `answerNote`, `gift`, `invoice`,
    `paidMedia`, `message`, `keyboard`, `description`.
  </Step>

  <Step title="Store the `ICompiledTemplate`">
    Each field is indexed by base id, then by language. That is what
    `TemplateManager` caches and what AOT freezes.
  </Step>
</Steps>

The last stage differs by path: `gramstax start` materialises the compiled
bodies with `new Function`, while `gramstax build` emits plain ESM modules.
See [the AOT contract](/guides/aot-contract) for that half.

<Note>
  Under `gramstax start --watch`, chokidar re-runs this for the changed template
  file only, so a hot reload recompiles one page rather than the tree.
</Note>

## Related

<Columns cols={3}>
  <Card title="Templates" icon="file-code" href="/concepts/templates">
    Keyboard label blocks, per-block languages, and why markup lives outside the API call.
  </Card>
  <Card title="Telegram Rich HTML" icon="code-xml" href="/guides/rich-html">
    The 54 Telegram tags and the three validation layers that police them.
  </Card>
  <Card title="Filters" icon="filter" href="/guides/filters">
    The six compile-time pipes and the interpolation syntaxes they attach to.
  </Card>
  <Card title="The render contract" icon="braces" href="/concepts/render-contract">
    How a render call selects a block, and why an unread key is a compile error.
  </Card>
  <Card title="AOT contract" icon="cpu" href="/guides/aot-contract">
    What `gramstax build` freezes, and why script blocks are refused.
  </Card>
  <Card title="E2E testing" icon="test-tube" href="/guides/e2e-testing">
    Asserting against the compiled template instead of a mock's echo.
  </Card>
</Columns>