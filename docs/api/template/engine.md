> **Documentation Info**
>
> - **Last Updated:** 14/01/2026 16:37:38
> - **Framework Version:** v0.3.22

# TemplateEngine

The `TemplateEngine` class provides static methods for parsing and compiling HTML-like templates into executable functions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateEngine` static methods for template parsing.
> - **Internal:** Typically used internally by `TemplateManager`.
> - **Format:** Parses HTML-like syntax with custom blocks and inline helpers.

&nbsp;

## Template Syntax

### Base Block

REQUIRED. Container for template sections.

| attribute | type   | required | default | description     | ai_notes                                                           |
| --------- | ------ | -------- | ------- | --------------- | ------------------------------------------------------------------ |
| `id`      | string | no       | -       | Base identifier | Defaults to `default` when missing; leading whitespace is trimmed. |

```html
<base id="default">
  <keyboard>Button 1, Button 2</keyboard>
  <message>Hello World</message>
</base>

<base id="error">
  <message>An error occurred</message>
</base>
```

### Message Block

Text content with template interpolation.

| attribute | type   | required | default | description  | ai_notes                        |
| --------- | ------ | -------- | ------- | ------------ | ------------------------------- |
| `lang`    | string | no       | -       | Language key | Defaults to `default` language. |

```html
<message>Hello {{name}}!</message> <message lang="id">Halo {{name}}!</message>
```

### Keyboard Block

Comma-separated button labels for inline or bottom keyboards.

| attribute | type   | required | default | description   | ai_notes                                                                |
| --------- | ------ | -------- | ------- | ------------- | ----------------------------------------------------------------------- |
| `lang`    | string | no       | -       | Language key  | Defaults to `default` language.                                         |
| `type`    | string | no       | -       | Keyboard type | `bottom` for reply keyboard; anything else defaults to inline keyboard. |

```html
<keyboard>Yes, No</keyboard>
<keyboard type="bottom">Button 1, Button 2</keyboard>
<keyboard lang="id">Ya, Tidak</keyboard>
```

### Description Block

Bot command descriptions for Telegram menu.

| attribute | type   | required | default | description            | ai_notes                        |
| --------- | ------ | -------- | ------- | ---------------------- | ------------------------------- |
| `lang`    | string | no       | -       | Language key           | Defaults to `default` language. |
| `scope`   | string | no       | -       | Telegram command scope | Defaults to `default` scope.    |

```html
<description>Start the bot</description>
<description lang="id">Mulai bot</description>
<description scope="chat_administrators">Admin command</description>
```

### Media Block

Media is defined using `<media>` blocks only (no `<photo>`, `<video>`, etc.). The inner content becomes the caption for supported types.

| attribute    | type   | required | default | description               | ai_notes                                                                                                            |
| ------------ | ------ | -------- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `type`       | string | yes      | -       | Media type                | One of `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`. |
| `lang`       | string | no       | -       | Language key              | Defaults to `default` language.                                                                                     |
| `src`        | string | no       | -       | Media source              | Required for file-based media types; omitted for `location`/`contact` metadata-only blocks.                         |
| `latitude`   | string | no       | -       | Latitude (location only)  | Used only when `type="location"`.                                                                                   |
| `longitude`  | string | no       | -       | Longitude (location only) | Used only when `type="location"`.                                                                                   |
| `phone`      | string | no       | -       | Contact phone number      | Used only when `type="contact"`.                                                                                    |
| `first_name` | string | no       | -       | Contact first name        | Used only when `type="contact"`.                                                                                    |
| `last_name`  | string | no       | -       | Contact last name         | Used only when `type="contact"`.                                                                                    |
| `vcard`      | string | no       | -       | Contact vCard             | Used only when `type="contact"`.                                                                                    |

```html
<media type="photo" src="path/to/image.jpg">Caption text</media>
<media type="video" src="path/to/video.mp4">Video caption</media>
<media type="location" latitude="123.456" longitude="78.90">Meet here</media>
<media type="contact" phone="+1234567890" first_name="John" last_name="Doe"
  >Lead</media
>
```

### Script Block

Inline script evaluated with access to `data` via `with(data)`.

| attribute | type | required | default | description | ai_notes                                                               |
| --------- | ---- | -------- | ------- | ----------- | ---------------------------------------------------------------------- |
| (none)    | -    | -        | -       | -           | If the script throws or `data` is missing, it returns an empty string. |

```html
<script>
  return name ? `Hello ${name}` : `Hello`; // must return a value
</script>
```

### Div Block

Plain container used to normalize indentation. No attributes are supported.

| attribute | type | required | default | description | ai_notes                            |
| --------- | ---- | -------- | ------- | ----------- | ----------------------------------- |
| (none)    | -    | -        | -       | -           | Content is de-indented and trimmed. |

```html
<div>Line 1 Line 2</div>
```

### Space Block

Removes the entire line that contains a self-closing `<space />` tag.

| attribute | type | required | default | description | ai_notes                                                     |
| --------- | ---- | -------- | ------- | ----------- | ------------------------------------------------------------ |
| (none)    | -    | -        | -       | -           | Only `<space />` is recognized; `<space>...</space>` is not. |

```html
Line 1
<space />
Line 2
```

### Switch Block

Conditional rendering with `case` and `default` sub-blocks.

| attribute | type   | required | default | description | ai_notes                                                               |
| --------- | ------ | -------- | ------- | ----------- | ---------------------------------------------------------------------- |
| `value`   | string | yes      | -       | Data key    | Uses `data["value"]` for switching; missing value yields empty string. |

```html
<switch value="status">
  <case is="active">Active status</case>
  <case is="pending">Pending status</case>
  <default>Unknown status</default>
</switch>
```

### Case Block

Sub-block for `switch` values.

| attribute | type   | required | default | description    | ai_notes                                            |
| --------- | ------ | -------- | ------- | -------------- | --------------------------------------------------- |
| `is`      | string | yes      | -       | Match value(s) | Supports comma-separated values (e.g., `is="a,b"`). |

### Default Block

Fallback for `switch` when no `case` matches.

| attribute | type | required | default | description | ai_notes                        |
| --------- | ---- | -------- | ------- | ----------- | ------------------------------- |
| (none)    | -    | -        | -       | -           | Emits empty string when absent. |

### Map Block

Loops over arrays and joins rendered output.

| attribute | type   | required | default | description           | ai_notes                                         |
| --------- | ------ | -------- | ------- | --------------------- | ------------------------------------------------ |
| `src`     | string | yes      | -       | Data key for array    | Uses `data[src]` or `[]` if missing.             |
| `join`    | string | no       | -       | Join separator string | Defaults to `\n`; quotes are escaped internally. |

```html
<map src="items" join="\\n"> - {{e.name}} ({{i}}) </map>
```

### Import Block

Imports blocks from another template and supports scoped extraction.

| attribute | type   | required | default | description         | ai_notes                                                     |
| --------- | ------ | -------- | ------- | ------------------- | ------------------------------------------------------------ |
| `src`     | string | yes      | -       | Source template key | Required; missing `src` removes the import.                  |
| `block`   | string | no       | -       | Block list or `all` | Comma-separated list (`"message,keyboard"`) or `all`.        |
| `base`    | string | no       | -       | Base id             | Defaults to `default`.                                       |
| `lang`    | string | no       | -       | Language filter     | Matches block `lang` (default matches missing `lang`).       |
| `section` | string | no       | -       | `all` or `value`    | `all` keeps block tags; `value` extracts inner content only. |

```html
<import src="other-page" block="message,keyboard" base="default" />
<import src="other-page" block="all" section="value" />
```

&nbsp;

## Variable Interpolation

Variables use double curly braces and only resolve top-level `data` keys.

| syntax    | default | description        | ai_notes                                             |
| --------- | ------- | ------------------ | ---------------------------------------------------- |
| `{{key}}` | -       | Inserts `data.key` | Only `\w+` keys are supported (no nested dot paths). |

```html
<message>Hello {{name}}!</message>
```

### Map Variables

Inside `<map>`, you can reference:

| syntax       | default | description              | ai_notes                        |
| ------------ | ------- | ------------------------ | ------------------------------- |
| `{{e}}`      | -       | Current element          | `e` is the loop item.           |
| `{{e.prop}}` | -       | Current element property | Supports dot access within `e`. |
| `{{i}}`      | -       | Current index            | Zero-based index.               |

&nbsp;

## Inline Execution

Inline execution uses `{~ ... ~}` and is evaluated as JavaScript.

| syntax       | default | description          | ai_notes                                                                       |
| ------------ | ------- | -------------------- | ------------------------------------------------------------------------------ |
| `{~ code ~}` | -       | Evaluates expression | Tries plain execution first, then `with(data)`; returns empty string on error. |

```html
<message>Total: {~ data?.count ?? 0 ~}</message>
```

&nbsp;

## Static Methods

### `.compileMessages(template, baseBlocks?)`

Compile message blocks from template.

| parameter  | type   | required | default | description            | ai_notes                       |
| ---------- | ------ | -------- | ------- | ---------------------- | ------------------------------ |
| template   | string | yes      | -       | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | -       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => string } }`
- **ai_notes:** Compiled message functions by base/lang.

### `.compileKeyboards(template, baseBlocks?)`

Compile keyboard blocks from template.

| parameter  | type   | required | default | description            | ai_notes                       |
| ---------- | ------ | -------- | ------- | ---------------------- | ------------------------------ |
| template   | string | yes      | -       | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | -       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: { inline, bottom } } }`
- **ai_notes:** Compiled keyboard builders per base/lang.

### `.compileMedia(template, baseBlocks?)`

Compile media blocks from template.

| parameter  | type   | required | default | description            | ai_notes                       |
| ---------- | ------ | -------- | ------- | ---------------------- | ------------------------------ |
| template   | string | yes      | -       | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | -       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => IMediaBlock } }`
- **ai_notes:** Compiled media builders per base/lang.

### `.compileDescription(template, baseBlocks?)`

Compile description blocks from template.

| parameter  | type   | required | default | description            | ai_notes                       |
| ---------- | ------ | -------- | ------- | ---------------------- | ------------------------------ |
| template   | string | yes      | -       | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | -       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [scope]: { [lang]: (data) => string } } }`
- **ai_notes:** Compiled description functions by scope.

### `.processImportBlocks(template, resolver, depth?, importCache?)`

Process import blocks recursively.

| parameter   | type     | required | default | description                 | ai_notes                           |
| ----------- | -------- | -------- | ------- | --------------------------- | ---------------------------------- |
| template    | string   | yes      | -       | Template with imports       | Contains `<import>` directives.    |
| resolver    | function | yes      | -       | Function to resolve imports | Returns template content string.   |
| depth       | number   | no       | 0       | Current recursion depth     | Stops at depth limit (10).         |
| importCache | Map      | no       | -       | Cache for resolved imports  | Optional reuse of resolved blocks. |

- **returns: string** - Template with imports resolved.
- **ai_notes:** Returns template with `<import>` blocks replaced.

&nbsp;

## Usage

```typescript
import { TemplateEngine } from "gramstax";

const template = `
  <base>
    <keyboard>Back, Next</keyboard>
    <message>
      Welcome {{name}}!
    </message>
    <media type="photo" src="/tmp/hero.jpg">Hero image</media>
  </base>
  
  <base id="error">
    <message>Error: {{error}}</message>
  </base>
`;

const messages = TemplateEngine.compileMessages(template);
const keyboards = TemplateEngine.compileKeyboards(template);
const media = TemplateEngine.compileMedia(template);

const msg = messages.default.default({ name: "John" });
const kb = keyboards.default.default.inline({ name: "John" });
const mediaBlock = media.default.default({});
```
