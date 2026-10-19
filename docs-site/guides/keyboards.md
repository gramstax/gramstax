---
title: Keyboards
description: Where button labels come from, the four builders, the IKbCols layout grammar, and when an inline keyboard beats a reply keyboard.
icon: keyboard
---

# Keyboards

A keyboard in Gramstax is never a list of buttons you type into an API call. The
labels live in the page's own template inside a `<g-keyboard>` block, and the
builder reads them back out of the compiled template. Your code supplies the other
half: which destination each label points at, and how the labels are arranged into
rows.

This page is about that pairing and the two grammars that make it work. The block
vocabulary around it is [template blocks](/guides/template-blocks); the `data` and
`AGBaseId` keys every builder takes are the shared content half of [the render
contract](/concepts/render-contract); the `callbackQueryData(...)` objects a
destination carries are [pages](/guides/pages).

## The label source

Every button label starts as text inside a `<g-keyboard>` block:

```html
<g-keyboard type="inline">🔢 Counter, ❓ Help, 🔄 Refresh</g-keyboard>
<g-keyboard type="inline" lang="id">🔢 Penghitung, ❓ Bantuan, 🔄 Segarkan</g-keyboard>
<g-keyboard type="bottom">🏠 Home, ⌨️ Keyboard</g-keyboard>
```

Three attributes are meaningful on this block, and only three:

| Attribute | Meaning |
| :-------- | :------ |
| `type` | `inline` or `bottom`. Any other value is a validation error: `Attribute "type" on <g-keyboard> must be "inline" or "bottom"` |
| `lang` | which language variant of the block this is |
| *(none)* | the block inherits the default base when it has no `id` on its `<g-base>` |

`lang` and `type` are also the complete allowlist. An attribute outside that set
is rejected by name at compile time, the same way a Telegram tag's attributes are.

At compile time `TemplateEngine.compileBlockGKeyboards` turns the inner text into
one function per `(base, language, type)`. That function returns a flat array of
labels: the text is split on commas, quote-aware so a comma inside an HTML
attribute does not split, and `\,` is the escape for a comma that belongs to the
label itself. `getGKeyboard(...)` runs that function and hands the array back. So
by the time your builder runs, the template has already decided what the buttons
are called, in what language, and in what order.

<Note>
  `getGKeyboard` swallows every failure and returns `{rows: []}`. A base id that
  does not exist, a type the page never declared, or a language the block does not
  carry all produce an empty label array rather than an exception. That is why a
  keyboard can come out empty with nothing in the log, and why `AGBaseId` is the
  first thing to check when it does.
</Note>

## Two builders, two block types

<Tabs>
  <Tab title="Inline">

```ts
// template-backed: labels from <g-keyboard>, payloads from a destination list
const kb = this.inlineKeyboardT([StartCounterPage, StartHelpPage], `2`)

// computed: labels from the template, payloads you write
const kb2 = this.inlineKeyboard(
  (k, l) => k.text(l[0]!, StartCounterPage).row().text(l[1]!, StartHelpPage),
  {cache: true, AGBaseId: Base.index}
)
```

  </Tab>
  <Tab title="Bottom">

```ts
// template-backed
const kb = this.bottomKeyboardT(`2`, Base.index)

// computed
const kb2 = this.bottomKeyboard(
  (k, l) => k.text(l[0]!).row().text(l[1]!).oneTime()
)
```

  </Tab>
</Tabs>

There are four builders and two are shorthands:

| Builder | Callback | Params |
| :------ | :------- | :----- |
| `inlineKeyboardT(destinations, layout, AGBaseId, data)` | none, it supplies its own | none, it forwards `AGBaseId` and `data` |
| `bottomKeyboardT(layout, AGBaseId, data)` | none | none |
| `bottomKeyboardT(destinations, layout, AGBaseId, data)` | none | none |
| `inlineKeyboard(callback, params)` | `(k, l) => keyboard` | `IInlineKbParams` |
| `bottomKeyboard(callback, params)` | `(k, l) => keyboard` | `IBottomKbParams` |

The `T` builders are the ones you want most of the time. `inlineKeyboardT` is
declared as returning `IInlineKb` through `inlineKeyboard`, and
`bottomKeyboardT` as returning `IBottomKb`. The raw builders exist for the case the
shorthand cannot express: buttons whose callbacks are computed rather than
positional, such as a pagination row where the same label points at a different
page number on each render.

`bottomKeyboardT` has two overloads, and the first argument decides which one you
get. An array means the destination-list form; a string or nothing means the
layout form. `this.bottomKeyboardT(`2`)` and
`this.bottomKeyboardT([StartPage], `2`)` are different calls that both typecheck.

## Destinations, not strings

`inlineKeyboardT` walks the destination array in lockstep with the label array.
The Nth label is paired with the Nth destination, and what that destination
contributes to Telegram depends on its shape:

| Destination | What reaches Telegram |
| :---------- | :-------------------- |
| an `IKbCallbackData` object from `data.callbackQueryData(...)` | its `result` string |
| a page class or a page instance | `page.data.callbackQueryData()` called for you |
| a plain `string` | the string, unchanged |

A page destination goes through `Helper.ensurePageHasCallback` first, so it throws
naming the page and the method to add rather than shipping a dead button. The
compile-time layer is `IKbDest`, whose page branch requires
`handleCallbackQueryData` on the prototype. The two layers check the same thing
from opposite ends: TypeScript refuses a page class that cannot answer, and the
runtime refuses one that arrived as a plain JavaScript value.

<Warning>
  The label array and the destination array are positional and must be the same
  length. A `<g-keyboard>` block with one more label than the array has
  destinations reaches `PageDest[i]` as `undefined`, and the `in` check on it
  throws a `TypeError` while the keyboard is being built, not when the message is
  sent.
</Warning>

`bottomKeyboardT` is different, and the difference is the whole reason the two
kinds are not interchangeable. A reply-keyboard button has no callback payload, so
the destination list is not payloads. A `IKbCallbackData` object contributes its
`result` string as the button text, and a page class or instance contributes
`Helper.resolvePageTextLang(page, lang)`, the page's `intentText` resolved for the
user's language.

## Layout: `IKbCols`

The layout argument is typed, and the type is short enough to quote in full:

```ts
export type IKbCols = `${1 | 2 | 3 | 4 | 5 | 6}` | `${1 | 2 | 3 | 4 | 5 | 6}-${1 | 2 | 3 | 4 | 5 | 6}`
```

That is the accepted set: the twelve single values `"1"` through `"6"`, and the
thirty-six ranges `"1-1"` through `"6-6"`. Anything else is a type error at the
call site. The range is not "responsive between two numbers" the way the TSDoc on
the type describes it. `Ctx.keyboardCols` is what actually consumes it:

```ts
const [colsStr, lastRowStr] = layout.split(`-`)
const cols = parseInt(colsStr!)
const lastRow = lastRowStr ? parseInt(lastRowStr) : null
```

So the first number is buttons per row and the second, when present, is how many
buttons the final row must hold. `"3-2"` means three per row and a last row of two,
and the row break is taken as soon as exactly that many buttons remain.

| Layout | Four labels produce |
| :----- | :------------------ |
| `"1"` | four rows of one |
| `"2"` | two rows of two |
| `"2-3"` | one row of two, then a row of three |

<Note>
  `keyboardCols` is applied by the two `T` builders, not by the raw ones. Pass a
  layout to `inlineKeyboard` or `bottomKeyboard` and it is ignored: those builders
  hand you the keyboard and the flat label array, and you place the buttons with
  `.row()` yourself. That is what the computed examples in
  [the pagination sample](https://github.com/gramstax/gramstax/tree/main/example/5-interactive-menu/src/pages/start/inline)
  do.
</Note>

`bottomKeyboard` also calls `.resized()` on the keyboard it returns, and it does
so on both the cached and the uncached path, so a reply keyboard you build through
Gramstax is already marked for resize. You never have to remember that call.

## Which base supplies the labels

`AGBaseId` is the `<g-base id>` the labels are read from, and it has to match on
both sides. This is the single most common keyboard bug, and it fails quietly
because a mismatch produces an empty label array rather than an error.

```html
<g-base id="${Base.index}">
  <g-keyboard type="inline">${this.kbk.cancel()}</g-keyboard>
  <g-message>…</g-message>
</g-base>
<g-base id="${Base.success}">
  <g-keyboard type="inline">${this.kbk.home()}</g-keyboard>
  <g-message>…</g-message>
</g-base>
```

```ts
// ✅ both sides agree
await this.renderText({AGBaseId: Base.index, keyboard: this.helper.homeKeyboard(Base.index)})

// ❌ the message resolves one base and the keyboard another
await this.renderText({AGBaseId: Base.index, keyboard: this.helper.homeKeyboard()})
```

`getGKeyboard` falls back from the requested base to `default`, so a wrong base id
only fails loudly when no default base exists to fall back to. Either way the rule
is the same: if the template names the base, name it on every render and every
builder call that reads it.

## Caching

Both raw builders accept `cache: true`, and both default to `false`. When it is
on, the finished keyboard is memoized in `this.cacheKeyboard`, a plain `Map`, under
a key built from four parts:

| Builder | Key |
| :------ | :-- |
| `inlineKeyboard` | `` `${data.name}:${AGBaseId ?? `default`}:${from?.language_code ?? `default`}:i` `` |
| `bottomKeyboard` | `` `${data.name}:${AGBaseId ?? `default`}:${from?.language_code ?? `default`}:b` `` |

The trailing `i` and `b` keep the two kinds apart, which is what lets a page cache
an inline and a bottom keyboard for the same base in the same language.

<Warning>
  `cache: true` is silently ignored when `data` is passed. The guard on both
  builders is `params?.cache === true && !params?.data`, so a keyboard built with
  interpolation is never memoized. That is deliberate, since the labels change
  with the data, but it means a page that passes `data` and expects caching has
  none.
</Warning>

Caching is worth it for a keyboard that is identical per language, which is
exactly what a static menu is. It is not worth it for a per-user board, and it is
per-process: the cache is a `Map` on the bot instance, so it is not shared across
instances and it resets on restart. The `cacheKeyboard` config slot exists to seed
it, and it expects a `Map`, so a cold start can preload the same keys the first
render would have produced.

## When inline beats bottom

An inline keyboard attaches callback payloads to buttons, and a reply keyboard
attaches text. Everything else follows from that one difference.

**Inline is right when the tap should edit in place.** A callback query is what
makes `mode: "auto"` resolve to an edit, so a button on an inline keyboard turns
one message into the next screen of the same message. There is no resend and no
message list to scroll back through. The payload can also carry args, which is
what lets one button class serve a whole list: `data.callbackQueryData(`item`, id)`
encodes both onto one button and `handleArgsCallbackQueryData` reads them back with
`this.callbackQueryDataArgs`.

**Bottom is right when the button is an input, not a navigation step.** Its
buttons send plain text, which means they re-enter through text routing rather than
callback routing, which means the user's next message and the button are the same
kind of event. That is what makes a reply keyboard the natural fit for a durable
input mode: a menu of city names, a persistent set of commands, a "type here and
send" affordance that stays after the message scrolls away.

<Warning>
  A bottom keyboard cannot ride an edit route. `IRouteEdit` narrows `keyboard` to
  `IInlineKb`, and `Ctx._assertInlineKeyboardForEdit` throws at runtime before any
  API call for plain-JavaScript callers, with the fix in the message: pass
  `mode: "reply"` to send a new message instead. `editMessageReplyMarkup` takes
  inline markup only.
</Warning>

## Editing only the markup

`renderEditKeyboard` changes the buttons and nothing else. It is the one render
method that never touches message text:

```ts
async handleArgsCallbackQueryData() {
  await this.renderEditKeyboard({keyboard: null, AGBaseId: `photo-card`})
}
```

`keyboard: null` is not "no keyboard". It means "resolve the markup from the
`<g-keyboard>` block of this base", which is where `AGBaseId` earns its keep on
this method: the same call with no base id would resolve the default one, and with
a wrong one would resolve nothing. Each label is then used as both the button text
and its own callback payload, so this is the one call that does not need a
destination list.

Its params type is `IContent & Omit<IRouteEdit, "mode" | "options">`, so `data`,
`AGBaseId` and an inline `keyboard` are available and `mode` is declared `never`:
there is no choice to make, the call always edits. There is also no send fallback,
because there is no new message to send. Failures are classified by
`Ctx.classifySendError`, reported through `notifySendError`, logged, and rethrown.

## Shared blocks

Once two or more pages need the same board, the block moves out of the page into
`src/blocks/g-keyboard.ts` and is exposed on the page base. Two classes do the
work.

`LabelGKeyboard` holds the strings. A label is a plain object keyed by language,
and the object also carries two helpers for composing and reversing button orders.

`BlockGKeyboard._build(key, lang, type, reverse)` turns one label into template
text. The pieces fit together like this:

```ts
// src/blocks/g-keyboard.ts
import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static refresh = {default: `🔄 Refresh`, id: `🔄 Segarkan`}
    static refresh_back = {
      default: `${this.refresh.default}, ${this.back.default}`,
      id: `${this.refresh.id}, ${this.back.id}`
    }
    static back_refresh = this._reverseObj(this.refresh_back)
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static refresh = (lang?: string, type?: string) => this._build(`refresh`, lang, type)
  static refresh_back = (lang?: string, type?: string) => this._build(`refresh_back`, lang, type)
  static back_refresh = (lang?: string, type?: string) => this._build(`back_refresh`, lang, type)
}
```

```ts
// src/base/page.ts
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardGBlock
  static kbl = KeyboardGBlock.label
}
```

`BlockGKeyboard.label` must be set before `_build` runs, or `_build` throws
`Label not found, make sure set this.label from class extends LabelGKeyboard`. A
key that does not exist on the label class throws `Object value <key> not found`,
and a language the key does not carry throws `Language "<lang>" not found in label
"<key>"`. Those three throws are the guard rails around a shared block.

`kbk` and `kbl` are your own static fields on `PageBase`, not framework API. The
framework never looks at them; they exist so every page reaches the same two
places by the same name.

| Call | Emits |
| :--- | :----- |
| `${this.kbk.back()}` | one `<g-keyboard>` per language the label carries |
| `${this.kbk.back(`id`)}` | one `<g-keyboard>` for `lang="id"` only |
| `${this.kbk.back(`default`)}` | one `<g-keyboard>` for `lang="default"` |
| `${this.kbk.back(`id`, `bottom`)}` | the same, with `type="bottom"` |
| `${this.kbl.back.default}` | the raw string `⬅️ Back`, for use inside a sentence |

The `type` argument defaults to `inline`, and `reverse` is a fourth positional
argument on `_build` that flips the comma-separated order of each language.

### Composing and reversing

Two static helpers on `LabelGKeyboard` exist because "Refresh, Back" and
"Back, Refresh" are the same buttons in a different order, and writing both by
hand is how the two drift apart.

`LabelGKeyboard._reverse(input)` reverses a comma-separated label string and
respects the `\,` escape, so a label that genuinely contains a comma survives the
round trip. `LabelGKeyboard._reverseObj(input)` applies it across every language
of an object at once. That is how `back_refresh` above is one line rather than two
transcriptions.

## Testing a keyboard

The e2e harness renders the page's own compiled template, so a keyboard drift
between template and handler fails the test rather than shipping:

```ts
const labels = e2e.gkb(`start`, `default`, `inline`)
expect(labels).toEqual([`🔢 Counter`, `❓ Help`, `🔄 Refresh`])
```

`gkb(page, aGBaseId, aType, data?, aLang?)` calls `getGKeyboard` with the same
arguments the builders use and returns the flattened label array, so a test
asserts against the exact strings the user will see, in the exact order. See [e2e
testing](/guides/e2e-testing).

## Where to go next

<Columns cols={2}>
  <Card title="Template blocks" icon="blocks" href="/guides/template-blocks">
    The full PAGE block vocabulary, including the import and switch forms that
    decide which labels exist.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    How `keyboard`, `data`, `AGBaseId` and `mode` combine, and which keys each
    delivery route actually reads.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    `buildData`, `callbackQueryData(...)`, and the typed destination list this page
    consumes.
  </Card>
  <Card title="Filters" icon="filter" href="/guides/filters">
    Compiling `{{placeholders}}` inside a label, for a board whose text changes
    with the data.
  </Card>
  <Card title="Sessions" icon="clock" href="/guides/sessions">
    How a button tap parks a user in a step, which is the other half of an
    interactive screen.
  </Card>
  <Card title="E2E testing" icon="flask-conical" href="/guides/e2e-testing">
    The harness `gkb` belongs to, and what else it can assert against the compiled
    template.
  </Card>
</Columns>