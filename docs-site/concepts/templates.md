---
title: Templates
description: The block vocabulary, filters, imports, and how languages are declared.
---

# Templates

A page owns one `static template` block. Message text, keyboards, media
captions, poll options, invoices and error toasts all live there, compiled ahead
of time by `TemplateEngine` and cached by `TemplateManager`.

The point is not templating. It is that **the markup is not inside an API
call**, so it can be compiled, validated, translated and reused by tests.

## Blocks

Page blocks are prefixed `g-`. There are 29 of them, and each one maps to a
Telegram capability:

| Block | Purpose |
| --- | --- |
| `g-message` | The message body |
| `g-keyboard` | A keyboard, with `g-button` children |
| `g-media` | A photo, video, document, audio or voice |
| `g-media-group` | Up to ten media items |
| `g-poll` | A poll, with `g-item` children |
| `g-invoice` | An invoice, with `g-price` children |
| `g-callback-answer` | The answer to a callback query |
| `g-ifelse` / `g-switch` / `g-case` | Conditionals |
| `g-import` | Pull in another template file |
| `g-script` | Inline execution — **rejected by AOT**, see below |

Void elements must self-close: `<g-space/>`, `<g-div/>`, `<g-keyboard/>`.

## Telegram Rich HTML

Everything the Bot API accepts passes through too — 54 tags in five groups,
including `tg-emoji`, `tg-map`, `tg-math`, `tg-time`, `tg-slideshow` and
`tg-collage`. Validation runs against Bot API **10.3**, in three layers:

1. **Required attributes** — `<tg-emoji>` needs `emoji-id`, `<tg-map>` needs
   `lat`, `long` and `zoom`.
2. **Value formats** — `zoom` must be 13–20, `lat` must be in [-90, 90], and
   `<input type>` must be `checkbox`, the only one Telegram supports.
3. **Unknown attributes** — rejected, not ignored. `<table ngasal="x">` fails,
   with the allow-list named in the error.

Rejection rather than tolerance is the whole point: a page that would fail at
send-time fails at build-time instead.

## Languages

Put `lang` beside a block and you have a second language. No branch in the
handler, no runtime lookup:

```html
<g-message>What is your name?</g-message>
<g-message lang="id">Siapa namamu?</g-message>
```

The same mechanism gives you a `fallback` language, used when a requested one is
absent.

## Interpolation and filters

`{{}}` is variable interpolation. Filters are chained left to right and compiled
into calls at build time — zero parsing per render:

```html
<g-message>{{user.name|upper}} — {{count}} item{{count|plural:item:items}}</g-message>
```

Available: `upper`, `lower`, `number:<places>`, `date:<YYYY-MM-DD>`,
`plural:<singular>:<plural>`, `default:<value>`. Chaining works, and an unknown
filter renders empty with a one-time console warning rather than throwing in
production.

## Imports

`<g-import>` pulls another file into the current template. Imports resolve at
compile time, which is what lets AOT freeze a page into a standalone artifact.

## Ahead-of-time compilation

`gramstax build` freezes `src/pages` into `.gramstax/`, compiling each page's
blocks ahead of time. The practical consequences:

- No template compilation on a cold isolate.
- **Script blocks are rejected** — `g-script` and `{~~ … ~~}` both compile to
  `with(data …)`, which is illegal in ESM strict mode. Move the logic into the
  page class as a method returning plain data.
- Runtime-assembled templates cannot be emitted; only static sources are.

The error message for a blocked script is explicit about this. See
[the AOT contract](/guides/aot-contract).

## Tests read the same source

An e2e assertion can extract the rendered text and the button labels from the
compiled block, because both come from the same compiled output the user sees.
That is what lets the scaffold ship tests that assert on real output rather than
on a mock's echo.