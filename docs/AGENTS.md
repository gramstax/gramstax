# Gramstax API Reference (AGENTS)

Consolidates `docs/api` content with implementation notes from `packages/gramstax/src`.

## Summary

- Aggregates all API docs from `docs/api`.
- Adds implementation cross-references from `packages/gramstax/src`.
- Notes mismatches between docs and code where relevant.

## Table of Contents

- [Summary](#summary)
- [Documentation Overview](#documentation-overview)
  - [Project Src Structure](#project-src-structure)
- [Cache](#cache)
  - [CacheExternal](#cacheexternal)
- [Core](#core)
  - [Gramstax](#gramstax)
  - [Ctx](#ctx)
- [Page](#page)
  - [PageManager](#pagemanager)
- [Template](#template)
  - [TemplateEngine](#templateengine)
  - [TemplateManager](#templatemanager)
- [Utils](#utils)
  - [LoggingUtils](#loggingutils)
- [Blocks](#blocks)
  - [BlockKeyboard](#blockkeyboard)
- [Data](#data)
  - [LabelKeyboard](#datakeyboard)
- [Worker Thread](#worker-thread)
  - [WorkerThreadExport](#workerthreadexport)
  - [WorkerThreadInit](#workerthreadinit)
  - [WorkerThreadLaunch](#workerthreadlaunch)
  - [WorkerThreadPool](#workerthreadpool)
  - [WorkerThreadRpc](#workerthreadrpc)
  - [WorkerThreadGatewayClient](#workerthreadgatewayclient)
  - [WorkerThreadGatewayServer](#workerthreadgatewayserver)
- [Worker Thread Examples](#worker-thread-examples)
  - [worker-main.ts](#worker-main-ts)
  - [worker-server.ts](#worker-server-ts)
  - [worker-client.ts](#worker-client-ts)
  - [test-final-main.ts](#test-final-main-ts)
  - [test-final-server-main.ts](#test-final-server-main-ts)
  - [test-final-worker-a.ts](#test-final-worker-a-ts)
  - [test-final-worker-b.ts](#test-final-worker-b-ts)
  - [test-final-worker-c.ts](#test-final-worker-c-ts)
- [Source Exports](#source-exports)

## Documentation Overview

> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00
> - **Framework Version:** v0.5.2

**Best Practices**

- Prefer `buildData(dataCallbackFn)` when only callback payloads are needed (avoid `{ dataCallback }`).
- `dataCallback` must return an array (use `[]` for no payloads); payloads route to `callbackPayload()`, otherwise `callback()`.
- Avoid setting `intentTextCommand` unless you must override the filename-derived default.
- `textFree()` triggers only when text exists; no empty-text guard needed.
- If you introduce multi-language keyboards, ensure every related flow handles all languages.
- Favor fast paths (reuse computed data, avoid duplicate lookups).
- Avoid `intentText`/`intentTextCommand` unless you must override the filename-derived default (`this.data.name`); renaming the page file (e.g., `reset.ts` → `Reset.ts`) also changes the derived intent.
- Payload text routes to `textPayload()` (e.g., `start 123`), payload commands route to `textCommandPayload()` (e.g., `/start 123`).
- `intentText` applies to `text()` and `textPayload()`; `intentTextCommand` applies to `textCommand()` and `textCommandPayload()`.
- Prefer `intentText` + `text()` handlers for bottom-keyboard actions in single-language flows.
- Use the core route handlers (`textCommand`, `callback`, `callbackPayload`) directly instead of wrapper helpers like `showMenu`.
- Create mandatory flow components as classes; use static types where it improves clarity, don't put variables outside the class, prioritize them inside the class.
- Centralize guard/account checks once before routing instead of repeating them in each page handler.
- Cache keyboard/data objects before `edit`/`reply` and avoid unnecessary base IDs to create code for faster performance.
- Avoid passing `{}` as the data argument when it is unused; only pass `{}` when you need a later `baseId` argument.
- Use target page `Page.data.callback(...)` for inline navigation instead of `this.data.callback("...")`.
- Avoid duplicate `<base>` blocks when a single base is enough; create code for faster performance.
- `callbackQueryAnswer()` is auto-handled for routed callbacks; call it only for custom toasts.

**Example: `buildData` payload arrays**

Use an array return even when payload is optional. Do not coerce to an empty string.

**WRONG**

```typescript
static data = this.buildData((payload?: string) => [payload ?? ``])
```

**CORRECT**

```typescript
static data = this.buildData((payload?: string) => [payload])
```

**Example: Avoid duplicate `<base>` blocks**

If a single base renders the message, do not duplicate it with another base id.

**Example: Skip `buildData` when no payloads**

If a page never uses callback payloads, omit `buildData` and let the system auto-generate `data`.

**WRONG**

```typescript
export class StartPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload]);
}
```

**CORRECT**

```typescript
export class StartPage extends PageBase {}
```

**WRONG**

```html
<base>
  <keyboard>Back to Menu</keyboard>
  <message>
    Balance: {{balance}}
  </message>
</base>
<base id="balance">
  <message>
    Balance: {{balance}}
  </message>
</base>
```

**CORRECT**

```html
<base>
  <keyboard>Back to Menu</keyboard>
  <message>
    Balance: {{balance}}
  </message>
</base>
```

**Example: Cache keyboard/data for edit/reply**

Avoid repeating `this.kb()`/payload creation and base IDs when the default base is sufficient.

**WRONG**

```typescript
if (isEdit) {
  await this.edit(this.kb(), { balance: formatted }, `balance`);
  return;
}
await this.reply(this.kb(), { balance: formatted }, `balance`);
```

**CORRECT**

```typescript
const kb = this.kb();
const data = { balance: formatted };
if (isEdit) {
  await this.edit(kb, data);
} else {
  await this.reply(kb, data);
}
```

**Example: Skip empty data objects**

Only pass `{}` when you need a `baseId` argument. Otherwise omit the data parameter.

**WRONG**

```typescript
await this.edit(kb, {});
await this.reply(kb, {});
```

**CORRECT**

```typescript
await this.edit(kb);
await this.reply(kb);
```

**Example: Use target page callbacks**

Use the destination page `Page.data.callback(...)` for inline navigation.

**WRONG: ONLY IF NOT HAVE PAYLOAD**

```typescript
k.text(a[0]!, this.data.callback("balance"));
```

**CORRECT**

```typescript
k.text(a[0]!, BalancePage.data.callback());
```

### Project Src Structure

Minimum folders and file that must be present in every bot project:

- `./base` = Contains abstract class files used by other classes, such as `page.ts` with the `CtxCore` content (`./core/ctx.ts`).
- `./base/guard.ts`
- `./base/page.ts`
- `./blocks` = Contains block template string files, such as `<keyboard>` in the `KeyboardBlock` class (`./blocks/keyboard.ts`).
- `./blocks/keyboard.ts`
- `./core` = Contains core files; both `ctx.ts` and `bot.ts` are required.
- `./core/bot.ts`
- `./core/ctx.ts`
- `./labels` = Contains label files, such as `KeyboardLabel` (`./labels/keyboard.ts`), used by `KeyboardBlock` (`./blocks/keyboard.ts`). Other relevant files can be added.
- `./labels/keyboard.ts`
- `./guards` = Contains guard files before proceeding to other tasks (e.g., user ban checks, language overrides).
- `./guards/__example.ts` = YOU CAN DELETE THIS IF THAT FOLDER IS ALREADY HAS A REAL FILE GUARD, IF NOT, JUST LEAVE IT!!
- `./pages` = Contains page files.
- `./pages/start.ts`
- `./pages/general-status.ts`
- `./utils` = Contains utility files such as logs and string manipulation or others.
- `./utils/log.ts`

Other folders if needed:

- `./db` = Contains database files and schemas.
- `./repositories` = Contains ready-to-use interactions with `./db`, used to avoid creating schema builders from scratch.
- `./services` = Contains core service files (business logic and related helpers).
- Others as needed.

# PageManager

The `PageManager` class provides static utilities for loading and managing page modules dynamically.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `PageManager` static methods for page loading.
> - **Usage:** Used internally by `Gramstax` to load page classes from the `src/pages` directory.
> - **Module format:** Pages must export a class (not default export) that extends `Ctx`.

&nbsp;

## Static Methods

### `.getFilePath()`

Returns the default pages directory path.

- **returns: string**
- **ai_notes:** Returns `join(process.cwd(), "src", "pages")`.

```typescript
import { PageManager } from "gramstax";

const pagesPath = PageManager.getFilePath();
// => "/path/to/project/src/pages"
```

&nbsp;

### `.getFileSync(path?, positionModule?)`

Synchronously load a single page module.

| parameter      | type   | required | default         | description                 | ai_notes                                   |
| -------------- | ------ | -------- | --------------- | --------------------------- | ------------------------------------------ |
| path           | string | no       | `getFilePath()` | Path to the page file       | Uses default pages directory when omitted. |
| positionModule | number | no       | `0`             | Index of the exported class | Used when file has multiple exports.       |

- **returns: typeof Ctx**
- **ai_notes:** First exported page class.
- **throws:** Error if file has no exports.

```typescript
const StartPage = PageManager.getFileSync(
  "/path/to/project/src/pages/start.ts"
);
```

&nbsp;

### `.getFile(path?, positionModule?)`

Asynchronously load a single page module with cache busting.

| parameter      | type   | required | default         | description                 | ai_notes                                   |
| -------------- | ------ | -------- | --------------- | --------------------------- | ------------------------------------------ |
| path           | string | no       | `getFilePath()` | Path to the page file       | Uses default pages directory when omitted. |
| positionModule | number | no       | `0`             | Index of the exported class | Appends timestamp for cache busting.       |

- **returns: Promise<typeof Ctx>**
- **ai_notes:** Resolves with loaded page class.

```typescript
const StartPage = await PageManager.getFile(
  "/path/to/project/src/pages/start.ts"
);
```

&nbsp;

### `.getFileManySync(path?, positionModule?)`

Synchronously load all page modules from a directory.

| parameter      | type   | required | default         | description                 | ai_notes                                   |
| -------------- | ------ | -------- | --------------- | --------------------------- | ------------------------------------------ |
| path           | string | no       | `getFilePath()` | Path to the pages directory | Uses default pages directory when omitted. |
| positionModule | number | no       | `0`             | Index of the exported class | Used when files have multiple exports.     |

- **returns: Array<{ path: string; page: typeof Ctx }>**
- **ai_notes:** Array of page records.
- **throws:** Error if directory does not exist.

```typescript
const pages = PageManager.getFileManySync();
// => [{ path: "/path/to/start.ts", page: StartPage }, ...]
```

&nbsp;

### `.clearCacheRequire(path?)`

Clear the require cache for all page modules.

| parameter | type   | required | default         | description                 | ai_notes                        |
| --------- | ------ | -------- | --------------- | --------------------------- | ------------------------------- |
| path      | string | no       | `getFilePath()` | Path to the pages directory | Enables hot-reloading of pages. |

- **returns: boolean**
- **ai_notes:** True when cache cleared.
- **throws:** Error if directory does not exist.

```typescript
PageManager.clearCacheRequire();
```

## Usage

```typescript
import { PageManager } from "gramstax";

const pagesPath = PageManager.getFilePath();
const page = PageManager.getFileSync(`${pagesPath}/start.ts`);
const pages = PageManager.getFileManySync(pagesPath);

console.log(page.name);
console.log(`Loaded pages: ${pages.length}`);
```

#### Implementation Details (packages/gramstax/src/page/manager.ts)

- Uses `createRequire` to load CommonJS/TS modules in `getFileSync`.
- `getFile()` loads modules via dynamic `import()` with cache-busting timestamp query.
- `getFileManySync()` and `clearCacheRequire()` validate the directory exists with `existsSync` before reading.

## Template

### TemplateEngine

Source: `docs/api/template/engine.md`

> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00
> - **Framework Version:** v0.5.2

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
  return name ? `Hello ${name}` : `Hello`;
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
<map src="items" join="\n"> - {{e.name}} ({{i}}) </map>
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

#### Implementation Details (packages/gramstax/src/template/engine.ts)

- `<media>` blocks only (no `<photo>`/`<video>` tags); `type` drives media behavior.
- `<map>` requires `src` and supports `join`; `{{e}}`, `{{e.prop}}`, and `{{i}}` are expanded.
- `<switch>` supports comma-separated `case is` values with `default` fallback.
- `<import>` supports `block`, `base`, `lang`, `section` with recursion limit 10.
- `<space />` removes the line it appears on; `<div>` normalizes indentation.
- `{~ ... ~}` and `<script>` execute with `data` scope and return empty string on errors.

# TemplateManager

The `TemplateManager` class manages template loading, compilation, caching, and hot-reloading from page files.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateManager` for template management.
> - **Hot-reload:** Supports file watching for development.
> - **Sources:** Templates from static `template` property or `.tpl` files.

&nbsp;

## Constructor

### `new TemplateManager(options)`

| parameter           | type     | required | default | description             | ai_notes                                      |
| ------------------- | -------- | -------- | ------- | ----------------------- | --------------------------------------------- |
| options.path        | string[] | yes      | -       | Paths to scan for pages | Note: Typically `["src/pages"]`.              |
| options.enableWatch | boolean  | no       | `false` | Enable file watching    | Note: For development auto-reload on changes. |

| options.watchOptions | object | no | - | Chokidar watch options | **Passed to:** chokidar watcher. |

```typescript
import { TemplateManager } from "gramstax";

const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: process.env.NODE_ENV === "development",
});
```

&nbsp;

## Template Sources

Templates can come from:

### 1. Static Template Property

```typescript
class MyPage extends Ctx {
  static template = `
    <base>
      <message>Hello World</message>
    </base>
  `;
}
```

### 2. External .html File

Create `my-page.html` alongside `my-page.ts`:

```html
<base>
  <message>Hello World</message>
</base>
```

&nbsp;

## Methods

### `.getMessage(key, baseId?, language?, data?)`

Get compiled message string.

| parameter | type   | required | default   | description          | ai_notes                         |
| --------- | ------ | -------- | --------- | -------------------- | -------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Template file key.               |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.       |
| language  | string | no       | "default" | Language code        | Uses `default` as fallback.      |
| data      | object | no       | -         | Template variables   | Used for template interpolation. |

- **returns: string**
- **ai_notes:** Rendered template string.

```typescript
const message = tm.getMessage("start", "default", "en", { name: "John" });
```

### `.getKeyboard(key, baseId?, language?, type?, data?)`

Get compiled keyboard labels.

| parameter | type   | required | default   | description          | ai_notes                        |
| --------- | ------ | -------- | --------- | -------------------- | ------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Source template file key.       |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.      |
| language  | string | no       | "default" | Language code        | Fallback uses `default`.        |
| type      | string | no       | "inline"  | Keyboard type        | Values are `inline`, `bottom`.  |
| data      | object | no       | -         | Template variables   | Used by template interpolation. |

- **returns: string[]**
- **ai_notes:** Button labels for selected language.

```typescript
const buttons = tm.getKeyboard("start", "default", "en", "inline");
// => ["Counter", "Help", "Settings"]
```

### `.getMedia(key, baseId?, language?, data?)`

Get compiled media data.

| parameter | type   | required | default   | description          | ai_notes                         |
| --------- | ------ | -------- | --------- | -------------------- | -------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Template file key.               |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.       |
| language  | string | no       | "default" | Language code        | Uses `default` as fallback.      |
| data      | object | no       | -         | Template variables   | Used for template interpolation. |

- **returns: IMediaBlock | undefined**
- **ai_notes:** Media payload for selected base/lang.

```typescript
const media = tm.getMedia("photo-page", "default", "en");
// => { type: "photo", src: "...", caption: "..." }
```

### `.getDescription(key, baseId?, language?, scope?, data?)`

Get command description for Telegram menu.

| parameter | type   | required | default   | description          | ai_notes                        |
| --------- | ------ | -------- | --------- | -------------------- | ------------------------------- |
| key       | string | yes      | -         | Page name (filename) | Source template file key.       |
| baseId    | string | no       | "default" | Base block ID        | Matches `<base id="...">`.      |
| language  | string | no       | "default" | Language code        | Fallback uses `default`.        |
| scope     | string | no       | "default" | Bot command scope    | Telegram command scope.         |
| data      | object | no       | -         | Template variables   | Used by template interpolation. |

- **returns: string**
- **ai_notes:** Rendered description string.

```typescript
const desc = tm.getDescription("start", "default", "en");
// => "Start the bot"
```

### `.getDescriptionLanguage(key, baseId?, scope?)`

Get available languages for a description.

- **returns: string[]**
- **ai_notes:** Languages present for scope.

### `.getDescriptionScopes(key, baseId?)`

Get available scopes for a description.

- **returns: string[]**
- **ai_notes:** Scope keys for description.

### `.has(key)`

Check if template exists.

| parameter | type   | required | default | description | ai_notes               |
| --------- | ------ | -------- | ------- | ----------- | ---------------------- |
| key       | string | yes      | -       | Page name   | Template cache lookup. |

- **returns: boolean**
- **ai_notes:** True when template exists.

### `.destroy()`

Cleanup resources and close watchers.

- **returns: Promise<void>**
- **ai_notes:** Resolves after watchers closed.

&nbsp;

## Internal Properties

### `._map`

Map of compiled templates.

- **type: Map<string, ICompiledTemplate>**

### `._engine`

Reference to TemplateEngine class.

- **type: typeof TemplateEngine**

### `._watcher`

Active file watchers.

- **type: FSWatcher[]**

&nbsp;

## Hot Reload

When `enableWatch` is true:

- **File change:** Recompiles the template
- **File add:** Compiles and adds new template
- **File delete:** Removes template from cache

```typescript
const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: true,
  watchOptions: {
    ignored: /node_modules/,
    persistent: true,
  },
});

// Later: cleanup
await tm.destroy();
```

&nbsp;

## Usage

```typescript
import { TemplateManager, Gramstax } from "gramstax";
import { join } from "path";

const templateManager = new TemplateManager({
  path: [
    join(process.cwd(), "src", "pages"),
    join(process.cwd(), "src", "shared-templates"),
  ],
  enableWatch: process.env.NODE_ENV !== "production",
});

// Use with Gramstax
new Gramstax({
  token: "TOKEN",
  deploy: "polling",
  templateManager,
});

// Direct usage
const message = templateManager.getMessage("welcome", "default", "en", {
  userName: "John",
  balance: 100,
});

const keyboard = templateManager.getKeyboard(
  "welcome",
  "default",
  "en",
  "inline"
);

console.log("Message:", message);
console.log("Buttons:", keyboard);
```

#### Implementation Details (packages/gramstax/src/template/manager.ts)

- Validates paths at construction time and throws if any path does not exist or is not a directory.
- Supports `.html`, `.ts`, `.js` files only (`.tpl` is not recognized in implementation).
- Compiles `Page.template` strings from `.ts`/`.js` pages.
- `processImportBlocks()` is used to resolve `<import>` blocks; supports importing blocks from `.html` or `.ts/.js` pages via `_readTemplateFile()`.
- Uses a shared `importCache` and `rawTemplates` map during batch `_loadAllFiles()` to reduce repeated IO.
- Handles `change`, `add`, `unlink`, `error` events via chokidar when `enableWatch` is true.
- `write()` only supports `.html` files and re-compiles the updated file.
- Returns empty values on failures for `getMessage`, `getMedia`, `getKeyboard`, `getDescription` instead of throwing.

## Utils

### LoggingUtils

Source: `docs/api/utils/log.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# LoggingUtils

The `LoggingUtils` class extends [LoggingPretty](https://www.npmjs.com/package/logging-pretty) to provide enhanced logging functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `LoggingUtils` class and the exported `log` singleton.
> - **Inheritance:** Extends `LoggingPretty` with additional helper methods.

&nbsp;

## Constructor

### `new LoggingUtils(options?)`

| parameter | type   | required | default | description                       | ai_notes                                       |
| --------- | ------ | -------- | ------- | --------------------------------- | ---------------------------------------------- |
| options   | object | no       | -       | LoggingPretty constructor options | **Passed through:** to parent `LoggingPretty`. |

```typescript
import { LoggingUtils } from "gramstax";

const logger = new LoggingUtils();
```

&nbsp;

## Methods

### `.errorMake(error, constructorName?, funcName?)`

Log a formatted error message with optional class and function context.

| parameter       | type   | required | default | description            | ai_notes                                    |
| --------------- | ------ | -------- | ------- | ---------------------- | ------------------------------------------- |
| error           | any    | yes      | -       | The error to log       | Stringified using `String(error)`.          |
| constructorName | any    | no       | -       | Class name for context | Format is `[ClassName:methodName] error`.   |
| funcName        | string | no       | -       | Method/function name   | Format is `[methodName] error` if no class. |

- **returns: void**
- **ai_notes:** Writes formatted log entry.

```typescript
const logger = new LoggingUtils();

try {
  throw new Error("Something went wrong");
} catch (error) {
  logger.errorMake(error, "UserService", "createUser");
  // Logs: [UserService:createUser] Error: Something went wrong
}
```

&nbsp;

## Exported Singleton

### `log`

A pre-instantiated `LoggingUtils` instance for convenience.

```typescript
import { log } from "gramstax";

log.info("Application started");
log.debug("Debug message");
log.warn("Warning message");
log.error("Error message");
log.success("Success message");
```

&nbsp;

## Inherited Methods

All methods from [LoggingPretty](https://www.npmjs.com/package/logging-pretty) are available:

- `.info(message)` - Log info level message
- `.debug(message)` - Log debug level message
- `.warn(message)` - Log warning level message
- `.error(message)` - Log error level message
- `.success(message)` - Log success level message

## Usage

```typescript
import { log, LoggingUtils } from "gramstax";

log.info("Application started");

const logger = new LoggingUtils();
logger.errorMake(new Error("Oops"), "Worker", "init");
```

#### Implementation Details (packages/gramstax/src/utils/log.ts)

- `LoggingUtils` simply forwards options to `LoggingPretty` and adds `errorMake()` formatting.
- The `log` singleton is initialized eagerly as `new LoggingUtils()`.

## Blocks

### BlockKeyboard

Source: `docs/api/blocks/keyboard.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# LabelKeyboard

The `BlockKeyboard` class provides static methods for generating keyboard template blocks from `LabelKeyboard` definitions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `BlockKeyboard` static methods.
> - **Dependency:** Requires `LabelKeyboard` to be set via `BlockKeyboard.label`.
> - **Output:** Generates HTML-like `<keyboard>` blocks for template engine.

&nbsp;

## Static Properties

### `.label`

Reference to the `LabelKeyboard` class containing keyboard definitions.

- **type: typeof LabelKeyboard**
- **required:** Must be set before using `_build()`.

```typescript
import { BlockKeyboard, LabelKeyboard } from "gramstax";

class MyKeyboards extends LabelKeyboard {
  static backNext() {
    return { en: "Back, Next", id: "Kembali, Lanjut" };
  }
}

BlockKeyboard.label = MyKeyboards;
```

&nbsp;

## Static Methods

### `._process(obj, params)`

Generate keyboard template blocks from an object of language-keyed values.

| parameter      | type    | required | default    | description               | ai_notes                                  |
| -------------- | ------- | -------- | ---------- | ------------------------- | ----------------------------------------- |
| obj            | object  | yes      | -          | Object with language keys | Structure is `{ en: "...", id: "..." }`.  |
| params.type    | string  | no       | `"inline"` | Keyboard type             | Values are `"inline"` or `"bottom"`.      |
| params.lang    | string  | no       | -          | Target language           | If set, returns single language block.    |
| params.reverse | boolean | no       | -          | Reverse button order      | If true, reverses comma-separated labels. |

- **returns: string**
- **ai_notes:** Returns HTML-like `<keyboard>` block(s) as string.

```typescript
const obj = { en: "Back, Next", id: "Kembali, Lanjut" };

// All languages
BlockKeyboard._process(obj, { type: "inline" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard> <keyboard type="inline" lang="id">Kembali, Lanjut</keyboard>`

// Single language
BlockKeyboard._process(obj, { type: "inline", lang: "en" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard>`

// Reversed
BlockKeyboard._process(obj, { type: "inline", reverse: true });
// => `<keyboard type="inline" lang="en">Next, Back</keyboard> ...`
```

&nbsp;

### `._build(key, lang?, type?)`

Build keyboard blocks by calling a method from the linked `LabelKeyboard`.

| parameter | type   | required | default    | description                  | ai_notes                               |
| --------- | ------ | -------- | ---------- | ---------------------------- | -------------------------------------- |
| key       | string | yes      | -          | Method name in LabelKeyboard | Must exist or throws.                  |
| lang      | string | no       | -          | Target language              | If set, returns single language block. |
| type      | string | no       | `"inline"` | Keyboard type                | Values are `"inline"` or `"bottom"`.   |

- **returns: string**
- **ai_notes:** Returns keyboard block string.
- **throws:** Error if `data` not set or method not found.

```typescript
// Assuming BlockKeyboard.label = MyKeyboards with backNext() method

BlockKeyboard._build("backNext");
// => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'

BlockKeyboard._build("backNext", "en", "bottom");
// => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
```

&nbsp;

## Usage

```typescript
import { BlockKeyboard, LabelKeyboard, Ctx } from "gramstax";

// ./labels/keyboard.ts
class KeyboardD extends LabelKeyboard {
  static navigation() {
    return {
      en: "Back, Home, Next",
      id: "Kembali, Beranda, Lanjut",
    };
  }
}

// ./blocks/keyboard.ts
export class KeyboardBlock extends BlockKeyboard {
  static data = KeyboardD;
  static navigation(lang?: string, type?: string) {
    return this._build(`navigation`, lang, type);
  }
}

// ./base/page.ts
export class PageBase extends Ctx {
  static kbk = KeyboardBlock;
  static kbl = KeyboardBlock.label;
}

// ./pages/my.ts
// Use in page template
export class MyPage extends PageBase {
  static template = `
    <base>
      ${this.kbk.navigation()}
      <message>Choose an option</message>
    </base>
  `;
}
```

#### Implementation Details (packages/gramstax/src/blocks/keyboard.ts)

- `_process()` defaults `type` to `inline` and supports generating multiple `<keyboard>` tags when `lang` is omitted.
- `_process()` reverses button order through `LabelKeyboard._reverse()` when `params.reverse` is `true`.
- `_build()` throws when `data` or method is missing and calls the LabelKeyboard method with `lang` before rendering.

## Labels

### LabelKeyboard

Source: `docs/api/labels/keyboard.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# LabelKeyboard

The `LabelKeyboard` class provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `LabelKeyboard` static utility methods.
> - **Usage:** Used as base class for user-defined keyboard data classes.
> - **Purpose:** Provides button order manipulation for multi-language keyboards.

&nbsp;

## Static Methods

### `._reverse(input)`

Reverse the order of comma-separated button labels.

| parameter | type   | required | default | description                   | ai_notes                              |
| --------- | ------ | -------- | ------- | ----------------------------- | ------------------------------------- |
| input     | string | yes      | -       | Comma-separated button labels | Escaped commas (`\\,`) are preserved. |

- **returns: string**
- **ai_notes:** Reversed comma-separated labels.

```typescript
import { LabelKeyboard } from "gramstax";

const reversed = LabelKeyboard._reverse("Back, Next, Submit");
// => "Submit, Next, Back"

// Escaped commas are preserved
const preserved = LabelKeyboard._reverse("Option A\\, B, Option C");
// => "Option C, Option A\\, B"
```

&nbsp;

### `._reverseObj(input)`

Reverse button order for all languages in an object.

| parameter | type   | required | default | description                                 | ai_notes                            |
| --------- | ------ | -------- | ------- | ------------------------------------------- | ----------------------------------- |
| input     | object | yes      | -       | Object with language keys and button values | Applies `_reverse()` to each value. |

- **returns: object**
- **ai_notes:** Returns object with reversed labels.

```typescript
const reversed = LabelKeyboard._reverseObj({
  en: "Back, Next",
  id: "Kembali, Lanjut",
});
// => { en: "Next, Back", id: "Lanjut, Kembali" }
```

&nbsp;

### `._build(lang, reverse, obj)`

Build keyboard string with optional language selection and reversal.

| parameter | type    | required | default | description                     | ai_notes                                       |
| --------- | ------- | -------- | ------- | ------------------------------- | ---------------------------------------------- |
| lang      | string  | no       | -       | Target language code            | If provided, returns only that language value. |
| reverse   | boolean | no       | -       | Whether to reverse button order | If true, applies `_reverse()` to result.       |
| obj       | object  | yes      | -       | Object with language keys       | Structure is `{ en: "...", id: "...", ... }`.  |

- **returns: string | object**
- **ai_notes:** Returns string if `lang` provided, object otherwise.

```typescript
const keyboards = {
  en: "Back, Next",
  id: "Kembali, Lanjut",
};

// Get specific language
LabelKeyboard._build("en", false, keyboards);
// => "Back, Next"

// Get specific language reversed
LabelKeyboard._build("en", true, keyboards);
// => "Next, Back"

// Get all languages
LabelKeyboard._build(undefined, false, keyboards);
// => { en: "Back, Next", id: "Kembali, Lanjut" }
```

&nbsp;

## Usage

Extend `LabelKeyboard` to define reusable keyboard configurations:

```typescript
import { LabelKeyboard } from "gramstax";

export class KeyboardLabel extends LabelKeyboard {
  static backNext(lang?: string) {
    return this._build(lang, false, {
      en: "Back, Next",
      id: "Kembali, Lanjut",
    });
  }

  static confirmCancel(lang?: string) {
    return this._build(lang, false, {
      en: "Confirm, Cancel",
      id: "Konfirmasi, Batal",
    });
  }
}
```

#### Implementation Details (packages/gramstax/src/labels/keyboard.ts)

- `_reverse()` splits with `/((?<!\\), *)/` so escaped commas are preserved.
- `_build()` returns a string for a specific language or an object for all languages.

## Worker Thread

### WorkerThreadExport

Source: `docs/api/worker-thread/export.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadExport

The `WorkerThreadExport` class provides a unified interface for creating and managing worker threads with automatic RPC proxying.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadExport` static methods for worker thread initialization.
> - **Dual mode:** Automatically detects if running in main thread or worker thread.
> - **RPC proxy:** Provides type-safe method calls to worker thread.

&nbsp;

## Static Methods

### `.init(options)`

Initialize a worker thread export with automatic environment detection.

| parameter        | type     | required | default              | description              | ai_notes                                             |
| ---------------- | -------- | -------- | -------------------- | ------------------------ | ---------------------------------------------------- |
| options.path     | string   | yes      | -                    | Path to the worker file  | Typically `__filename` for self-referential workers. |
| options.WTInit   | class    | yes      | -                    | Worker thread init class | Extends `WorkerThreadInit`.                          |
| options.WTLaunch | class    | no       | `WorkerThreadLaunch` | Main thread launch class | Extends `WorkerThreadLaunch`.                        |
| options.wrap     | function | no       | -                    | Custom wrapper function  | Adds custom methods to returned object.              |

- **returns: object** - Proxied object with `launchWorker`, `launchGatewayClient`, and worker methods.
- **ai_notes:** In worker thread context, only returns `launchGatewayClient`. In main thread, returns full proxy.

```typescript
import { WorkerThreadExport, WorkerThreadInit } from "gramstax";

class MyWorker extends WorkerThreadInit {
  count = 0;

  increment() {
    this.count += 1;
    return this.count;
  }

  getCount() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: MyWorker,
});
```

&nbsp;

### `.launchGatewayClient(serverPath)`

Create a typed launchGatewayClient proxy for inter-worker communication.

| parameter  | type   | required | default | description                    | ai_notes                       |
| ---------- | ------ | -------- | ------- | ------------------------------ | ------------------------------ |
| serverPath | string | no       | -       | Path to the target worker file | Must match target init `path`. |

- **returns: WorkerThreadGatewayProxy & { new(owner): WorkerThreadAsyncMethods }**
- **ai_notes:** Can be used as static methods or as constructor.

```typescript
// Static usage
const OtherWorker =
  WorkerThreadExport.launchGatewayClient<OtherWorkerClass>("/path/to/other.ts");
await OtherWorker.someMethod(this, arg1, arg2);

// Constructor usage
const client = new OtherWorker(this);
await client.someMethod(arg1, arg2);
```

&nbsp;

## Returned Object Methods

### `.launchWorker(argv?)`

Launch the worker thread from the main thread.

| parameter | type  | required | default | description            | ai_notes                                 |
| --------- | ----- | -------- | ------- | ---------------------- | ---------------------------------------- |
| argv      | any[] | no       | `[]`    | Command line arguments | Accessible via `process.argv` in worker. |

- **returns: Promise<WorkerThreadLaunch>**
- **ai_notes:** Resolves when worker signals ready.

```typescript
// In main thread
await CounterJob.launchWorker([5000]);
```

### `.launchGatewayClient(path)`

Get a launchGatewayClient proxy for inter-worker communication.

- Same as static `WorkerThreadExport.launchGatewayClient()`.

### `.[methodName](...args)`

Call any method defined in the worker's `WTInit` class.

- **returns: Promise<ReturnType>**
- **ai_notes:** Automatically proxied via RPC.

```typescript
// In main thread, after launchWorker
const count = await CounterJob.increment();
const current = await CounterJob.getCount();
```

&nbsp;

## Usage

```typescript
// jobs/counter.ts
import { WorkerThreadExport, WorkerThreadInit, log } from "gramstax";

class Worker extends WorkerThreadInit {
  count = 0;

  constructor() {
    super();
    const interval = parseInt(process.argv[3]) || 1000;
    setInterval(() => {
      this.count += 1;
      log.debug(`Count: ${this.count}`);
    }, interval);
  }

  mtdGetCount() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});

// index.ts
// area main thread
import { CounterJob } from "./jobs/counter";

await CounterJob.launchWorker([1000]); // launch worker first

const count = await CounterJob.mtdGetCount();
console.log(`Current count: ${count}`);
```

#### Implementation Details (packages/gramstax/src/worker-thread/export.ts)

- `init()` checks `process.argv[2]` for a unique `for-<path>` marker to detect worker mode.
- Worker mode constructs `WTInit` and returns only `launchGatewayClient`.
- Main thread returns a proxy that forwards method calls to `WorkerThreadLaunch.request()` once launched.
- `launchGatewayClient()` creates a dual static/constructor proxy to call methods through gateway clients.

### WorkerThreadInit

Source: `docs/api/worker-thread/init.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadInit

The `WorkerThreadInit` class is the base class for worker thread implementations. It handles communication with the main thread and provides RPC functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadInit` base class for worker threads.
> - **Usage:** Extend this class when defining worker thread behavior.
> - **Communication:** Uses `parentPort` for messaging with main thread.

&nbsp;

## Constructor

### `new WorkerThreadInit()`

Initializes the worker thread, sets up message handling, and signals readiness to the main thread.

```typescript
import { WorkerThreadInit } from "gramstax";

class MyWorker extends WorkerThreadInit {
  constructor() {
    super(); // Required - signals ready to main thread
    // Your initialization code
  }
}
```

&nbsp;

## Static Properties

### `.isMainThread`

Check if currently running in the main thread.

- **type: boolean**
- **ai_notes:** Re-exported from `node:worker_threads`.

```typescript
if (WorkerThreadInit.isMainThread) {
  console.log("Running in main thread");
} else {
  console.log("Running in worker thread");
}
```

### `.gatewayServerPath`

Path gateway server. (if need server gateway you can overrides)

- **type: string | undefined**
- **ai_notes:** Overrides if need gateway server`.

&nbsp;

## Instance Properties

### `.argv`

Command line arguments passed to the worker.

- **type: string[]**
- **ai_notes:** Same as `process.argv`. Custom args start at index 3.

### `.id`

The worker thread ID.

- **type: number**
- **ai_notes:** From `node:worker_threads` `threadId`.

### `.pid`

The process ID.

- **type: number**
- **ai_notes:** Same as `process.pid`.

### `.rpc`

RPC handler for method invocations.

- **type: WorkerThreadRpc**

### `.parentPort`

Reference to the parent port for messaging.

- **type: MessagePort | null**
- **ai_notes:** From `node:worker_threads`.

### `.gatewayServer`

Gateway server instance if created.

- **type: WorkerThreadGatewayServer | undefined**

### `.gatewayServerPath`

Path gateway server from static .gatewayServerPath.

- **type: string | undefined**

### `.gatewayClients`

Map of gateway clients for inter-worker communication.

- **type: Map<string, WorkerThreadGatewayClient>**

### `.gatewayClient`

The most recently created gateway client.

- **type: WorkerThreadGatewayClient | undefined**

&nbsp;

## Methods

### `.send(payload)`

Send a message to the main thread.

| parameter | type | required | default | description  | ai_notes                |
| --------- | ---- | -------- | ------- | ------------ | ----------------------- |
| payload   | any  | yes      | -       | Data to send | Payload to main thread. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
this.send({ status: "processing", progress: 50 });
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the main thread.

| parameter | type    | required | default | description         | ai_notes                        |
| --------- | ------- | -------- | ------- | ------------------- | ------------------------------- |
| method    | string  | yes      | -       | Method name to call | Targets main-thread RPC method. |
| params    | any     | yes      | -       | Method parameters   | Sent as positional array.       |
| wait      | boolean | no       | `true`  | Wait for response   | If false, fire-and-forget.      |
| others    | object  | no       | -       | Additional RPC data | Merged into RPC payload.        |

- **returns: Promise<any>**
- **ai_notes:** Resolves with main-thread response.

```typescript
const result = await this.request("getConfig", ["key"]);
```

### `.createGatewayServer(path, methods?)`

Create a gateway server for inter-worker communication.

| parameter | type   | required | default                            | description                           | ai_notes                   |
| --------- | ------ | -------- | ---------------------------------- | ------------------------------------- | -------------------------- |
| methods   | object | no       | this                               | Methods with value function to expose | Called by gateway clients. |
| path      | string | no       | this.constructor.gatewayServerPath | Unix socket path                      | Gateway identifier.        |

- **returns: Promise<boolean>**
- **ai_notes:** Resolves when gateway is ready.

```typescript
// recomended
await this.createGatewayServer(); // method will automatic set with default "this" and path will automatic get from "this.gatewayServerPath"

// not recomended
await this.createGatewayServer(
  {
    ping: () => "pong",
  },
  "/tmp/my-worker.sock"
);
```

### `.createGatewayClient(serverPath)`

Create a gateway client to connect to another worker. (not recomended, use init "launchGatewayClient" from export directly from source)

| parameter  | type   | required | default | description                 | ai_notes                |
| ---------- | ------ | -------- | ------- | --------------------------- | ----------------------- |
| serverPath | string | yes      | -       | Unix socket path to connect | Matches server gateway. |

- **returns: Promise<WorkerThreadGatewayClient>**
- **ai_notes:** Resolves with connected client.

```typescript
// set path directly
const client = await this.createGatewayClient("/tmp/other-worker.sock");
const result = await client.request("ping", []);
```

&nbsp;

## Usage

```typescript
// ./worker/my.ts
import { WorkerThreadInit, WorkerThreadExport, log } from "gramstax";

class Worker extends WorkerThreadInit {
  private data: Map<string, any> = new Map();

  constructor() {
    super();
    log.info(`Worker ${this.id} started with PID ${this.pid}`);
  }

  mtdSet(key: string, value: any) {
    this.data.set(key, value);
    return true;
  }

  mtdGet(key: string) {
    return this.data.get(key);
  }

  mtdGetAll() {
    return Object.fromEntries(this.data);
  }
}

export const MyWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});

// main.ts
// in main thread area
import { MyWorker } from "./worker/my";

await MyWorker.launchWorker(); // launch first (required)
await MyWorker.mtdSet(`name`, `damar`); // true

const data = await MyWorker.mtdGet(`name`);
console.log(data); // damar
```

#### Implementation Details (packages/gramstax/src/worker-thread/init.ts)

- `constructor()` sets up RPC and sends `{ method: "mtdReady" }` immediately after `super()`.
- `init()` listens to `parentPort` messages and routes through `WorkerThreadRpc`.
- `createGatewayServer()` stores `gatewayServerPath` on the class after start.
- `createGatewayClient()` caches clients in `gatewayClients` and stores the most recent one in `gatewayClientLatest`.

### WorkerThreadLaunch

Source: `docs/api/worker-thread/launch.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadLaunch

> This is an internal class never used by user.

The `WorkerThreadLaunch` class manages worker thread lifecycle from the main thread. It handles spawning, communication, and termination of worker threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadLaunch` class for managing workers from main thread.
> - **Graceful shutdown:** Automatically registers SIGINT/SIGTERM handlers to terminate workers.
> - **Ready signaling:** Uses promise-based ready detection.

&nbsp;

## Constructor

### `new WorkerThreadLaunch(path, argv)`

| parameter | type   | required | default | description                 | ai_notes                                       |
| --------- | ------ | -------- | ------- | --------------------------- | ---------------------------------------------- |
| path      | string | yes      | -       | Path to the worker file     | **Must be:** valid JavaScript/TypeScript file. |
| argv      | any[]  | yes      | -       | Arguments to pass to worker | **Accessible:** via `process.argv` in worker.  |

```typescript
import { WorkerThreadLaunch } from "gramstax";

const worker = new WorkerThreadLaunch("./worker.ts", ["arg1", "arg2"]);
await worker.ready();
```

&nbsp;

## Static Properties

### `.isMainThread`

Check if currently running in the main thread.

- **type: boolean**
- **ai_notes:** Re-exported from `node:worker_threads`.

&nbsp;

## Instance Properties

### `.pid`

The main process ID.

- **type: number**

### `.thread`

The underlying Node.js Worker instance.

- **type: Worker**
- **ai_notes:** From `node:worker_threads`.

### `.threadId`

The worker thread ID.

- **type: number**

### `.rpc`

RPC handler for method invocations.

- **type: WorkerThreadRpc**

### `.path`

Path to the worker file.

- **type: string**

### `.argv`

Arguments passed to the worker.

- **type: any[]**

&nbsp;

## Methods

### `.ready()`

Wait for the worker to signal it's ready.

- **returns: Promise<void>**
- **ai_notes:** Resolves when worker calls `super()` in `WorkerThreadInit`.

```typescript
const worker = new WorkerThreadLaunch("./worker.ts", []);
await worker.ready();
console.log("Worker is ready");
```

### `.send(payload)`

Send a message to the worker thread.

| parameter | type | required | default | description  | ai_notes               |
| --------- | ---- | -------- | ------- | ------------ | ---------------------- |
| payload   | any  | yes      | -       | Data to send | Sent to worker thread. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
worker.send({ action: "process", data: [1, 2, 3] });
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the worker thread.

| parameter | type    | required | default | description                   | ai_notes                                                  |
| --------- | ------- | -------- | ------- | ----------------------------- | --------------------------------------------------------- |
| method    | string  | yes      | -       | Method name to call in worker | Must exist on WorkerThreadInit.                           |
| params    | any     | yes      | -       | Method parameters             | Passed as array to worker method.                         |
| wait      | boolean | no       | `true`  | Wait for response             | If false fire-and-forget.                                 |
| others    | object  | no       | -       | Additional RPC data           | Additional key value aligned position with method, params |

- **returns: Promise<any>**
- **ai_notes:** Resolves with worker response.

```typescript
const result = await worker.request("processData", [[1, 2, 3]]);
console.log("Result:", result);
```

### `.kill()`

Terminate the worker thread immediately.

- **returns: void**
- **ai_notes:** Calls `thread.terminate()`.

```typescript
worker.kill();
```

&nbsp;

## Graceful Shutdown

`WorkerThreadLaunch` automatically handles graceful shutdown:

- Listens for `SIGINT` and `SIGTERM` signals
- Terminates the worker thread on process exit
- Cleans up on worker thread exit

```typescript
// Worker will be automatically terminated when:
// - Process receives SIGINT (Ctrl+C)
// - Process receives SIGTERM
// - Worker exits normally or crashes
```

&nbsp;

## Usage

```typescript
import { WorkerThreadLaunch } from "gramstax";

async function main() {
  // Launch worker
  const worker = new WorkerThreadLaunch("./jobs/processor.ts", ["config.json"]);
  await worker.ready();
  console.log(`Worker ${worker.threadId} is ready`);

  // Make requests
  const result = await worker.request("process", [{ data: "test" }]);
  console.log("Result:", result);

  // Later: manual termination
  worker.kill();
}

main();
```

#### Implementation Details (packages/gramstax/src/worker-thread/launch.ts)

- Starts the worker in `init()` and listens for `message` and `exit` events.
- Resolves readiness via `mtdReady()` which is invoked by `WorkerThreadInit`.
- Registers `SIGINT` and `SIGTERM` handlers per instance to call `kill()`.

### WorkerThreadPool

Source: `docs/api/worker-thread/pool.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadPool

The `WorkerThreadPool` class manages multiple worker thread instances, providing pooled access and broadcast functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadPool` class for managing multiple workers.
> - **Thread registry:** Uses `Map` with `threadId` as key.
> - **Broadcast:** Supports sending requests to all workers.

&nbsp;

## Constructor

### `new WorkerThreadPool(instances)`

| parameter | type                 | required | default | description              |
| --------- | -------------------- | -------- | ------- | ------------------------ |
| instances | WorkerThreadLaunch[] | yes      | -       | Initial worker instances |

```typescript
import { WorkerThreadPool, WorkerThreadLaunch } from "gramstax";

const worker1 = new WorkerThreadLaunch("./worker.ts", ["1"]);
const worker2 = new WorkerThreadLaunch("./worker.ts", ["2"]);
await Promise.all([worker1.ready(), worker2.ready()]);

const pool = new WorkerThreadPool([worker1, worker2]);
```

&nbsp;

## Properties

### `.thread`

Map of all worker instances by thread ID.

- **type: Map<number, WorkerThreadLaunch>**

### `.threadCount`

Current number of workers in the pool.

- **type: number**

&nbsp;

## Methods

### `.add(instance)`

Add a single worker to the pool.

| parameter | type               | required | default | description   | ai_notes               |
| --------- | ------------------ | -------- | ------- | ------------- | ---------------------- |
| instance  | WorkerThreadLaunch | yes      | -       | Worker to add | Registers by threadId. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
const newWorker = new WorkerThreadLaunch("./worker.ts", ["3"]);
await newWorker.ready();
pool.add(newWorker);
```

### `.addMany(instances)`

Add multiple workers to the pool.

| parameter | type                 | required | default | description    | ai_notes               |
| --------- | -------------------- | -------- | ------- | -------------- | ---------------------- |
| instances | WorkerThreadLaunch[] | yes      | -       | Workers to add | Registers all workers. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
pool.addMany([worker4, worker5]);
```

### `.getInstance(threadId)`

Get a specific worker by thread ID.

| parameter | type   | required | default | description      | ai_notes                 |
| --------- | ------ | -------- | ------- | ---------------- | ------------------------ |
| threadId  | number | yes      | -       | Worker thread ID | Lookup in pool registry. |

- **returns: WorkerThreadLaunch | undefined**
- **ai_notes:** Worker instance or undefined.

```typescript
const worker = pool.getInstance(123);
if (worker) {
  await worker.request("process", [data]);
}
```

### `.kill(threadId)`

Kill and remove a specific worker from the pool.

| parameter | type   | required | default | description      | ai_notes           |
| --------- | ------ | -------- | ------- | ---------------- | ------------------ |
| threadId  | number | yes      | -       | Worker thread ID | Terminates worker. |

- **returns: number | undefined** - The killed worker's threadId.
- **ai_notes:** Undefined if worker not found.

```typescript
const killedId = pool.kill(123);
console.log(`Killed worker ${killedId}`);
```

### `.killAll()`

Kill and remove all workers from the pool.

- **returns: void**
- **ai_notes:** No return value.

```typescript
pool.killAll();
console.log(`All workers terminated`);
```

### `.request(threadId, method, params, wait?, others?)`

Send a request to a specific worker.

| parameter | type    | required | default | description             | ai_notes                   |
| --------- | ------- | -------- | ------- | ----------------------- | -------------------------- |
| threadId  | number  | yes      | -       | Target worker thread ID | Lookup in pool registry.   |
| method    | string  | yes      | -       | Method name to call     | Targets worker RPC method. |
| params    | any     | yes      | -       | Method parameters       | Sent as positional array.  |
| wait      | boolean | no       | `true`  | Wait for response       | If false, fire-and-forget. |
| others    | object  | no       | -       | Additional RPC data     | Merged into RPC payload.   |

- **returns: Promise<any>**
- **ai_notes:** Resolves with worker response.

```typescript
const result = await pool.request(123, "process", [data]);
```

### `.broadcastRequest(method, params)`

Send a request to all workers and collect results.

| parameter | type   | required | default | description         | ai_notes                  |
| --------- | ------ | -------- | ------- | ------------------- | ------------------------- |
| method    | string | yes      | -       | Method name to call | Invoked on every worker.  |
| params    | any    | yes      | -       | Method parameters   | Sent as positional array. |

- **returns: Promise<any[]>** - Array of results from all workers.
- **ai_notes:** Order follows worker list.

```typescript
const results = await pool.broadcastRequest("getStatus", []);
console.log("All statuses:", results);
```

&nbsp;

## Usage

```typescript
import { WorkerThreadPool, WorkerThreadLaunch } from "gramstax";

async function main() {
  // Create worker pool
  const workers = await Promise.all(
    [1, 2, 3, 4].map(async (i) => {
      const w = new WorkerThreadLaunch("./processor.ts", [String(i)]);
      await w.ready();
      return w;
    })
  );

  const pool = new WorkerThreadPool(workers);
  console.log(`Pool has ${pool.threadCount} workers`);

  // Broadcast to all workers
  const statuses = await pool.broadcastRequest("getStatus", []);
  console.log("Worker statuses:", statuses);

  // Request from specific worker
  const result = await pool.request(workers[0].threadId, "process", [data]);

  // Cleanup
  pool.killAll();
}

main();
```

#### Implementation Details (packages/gramstax/src/worker-thread/pool.ts)

- Stores workers in `thread: Map<number, WorkerThreadLaunch>` and updates `threadCount` on add/kill.
- `broadcastRequest()` uses `Promise.all` on `Object.values(this.thread)`; because `thread` is a `Map`, this currently yields an empty list unless converted to `Array.from(this.thread.values())`.
- `killAll()` iterates through the map and calls `kill()` on each instance.

### WorkerThreadRpc

Source: `docs/api/worker-thread/rpc.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadRpc

> This is an internal class never used by user.

The `WorkerThreadRpc` class handles JSON-RPC style communication between threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadRpc` class for RPC handling.
> - **Protocol:** Uses simple JSON-RPC style messages with `id`, `method`, `params`, `result`, `error`.
> - **Internal:** Typically used internally by `WorkerThreadInit` and `WorkerThreadLaunch`.

&nbsp;

## Constructor

### `new WorkerThreadRpc(send, register)`

| parameter | type     | required | default | description                  | ai_notes                 |
| --------- | -------- | -------- | ------- | ---------------------------- | ------------------------ |
| send      | function | yes      | -       | Function to send data        | Called with RPC payload. |
| register  | object   | yes      | -       | Object with callable methods | Exposed RPC method map.  |

```typescript
import { WorkerThreadRpc } from "gramstax";

const rpc = new WorkerThreadRpc((data) => postMessage(data), {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
});
```

&nbsp;

## Properties

### `.map`

Map of pending requests by ID.

- **type: Map<any, { resolve, reject }>**
- **ai_notes:** Stores promise handlers for pending requests.

### `.send`

Function used to send messages.

- **type: (data: any) => any**

### `.register`

Object containing registered methods.

- **type: Record<string, Function>**

&nbsp;

## Methods

### `.make(data)`

Process an incoming RPC message.

| parameter | type   | required | default | description        | ai_notes                       |
| --------- | ------ | -------- | ------- | ------------------ | ------------------------------ |
| data      | object | yes      | -       | RPC message object | Shape is request/result/error. |

- **returns: Promise<void>**
- **ai_notes:** Handles requests, results, and errors.

**Message Types:**

1. **Request:** `{ id, method, params }` - Calls registered method and sends result/error back.
2. **Result:** `{ id, result }` - Resolves pending request promise.
3. **Error:** `{ id, error }` - Rejects pending request promise.

```typescript
// Handle incoming message
worker.on("message", (data) => {
  rpc.make(data);
});
```

### `.makeId()`

Generate a unique request ID.

- **returns: number**
- **ai_notes:** Uses `Math.random()`.

```typescript
const id = rpc.makeId();
```

### `.makeRequest(method, params, wait?, others?)`

Create and send an RPC request.

| parameter | type    | required | default | description                | ai_notes                       |
| --------- | ------- | -------- | ------- | -------------------------- | ------------------------------ |
| method    | string  | yes      | -       | Method name to call        | Targets registered method.     |
| params    | any     | yes      | -       | Method parameters          | Sent as positional array.      |
| wait      | boolean | no       | `true`  | Wait for response          | If false, returns send result. |
| others    | object  | no       | -       | Additional data to include | Merged into RPC payload.       |

- **returns: Promise<any>**
- **ai_notes:** If `wait=false`, returns result of `send()` directly.

```typescript
// Wait for response
const result = await rpc.makeRequest("add", [1, 2]);
console.log(result); // 3

// Fire and forget
rpc.makeRequest("log", ["message"], false);
```

&nbsp;

## Message Protocol

### Request Message

```typescript
{
  id: number,      // Unique request ID
  method: string,  // Method name to call
  params: any      // Parameters to pass
}
```

### Result Message

```typescript
{
  id: number,      // Request ID
  result: any      // Return value
}
```

### Error Message

```typescript
{
  id: number,
  error: {
    message: string,
    stack?: string,
    name: string
  }
}
```

&nbsp;

## Usage

```typescript
import { WorkerThreadRpc } from "gramstax";

// Define methods
const methods = {
  async processData(data: number[]) {
    return data.reduce((a, b) => a + b, 0);
  },

  getInfo() {
    return { pid: process.pid, time: Date.now() };
  },
};

// Create RPC handler
const rpc = new WorkerThreadRpc(
  (data) => parentPort.postMessage(data),
  methods
);

// Handle incoming messages
parentPort.on("message", (data) => {
  rpc.make(data);
});
```

#### Implementation Details (packages/gramstax/src/worker-thread/rpc.ts)

- Validates target method and throws `Method <name> not found or not function` if missing.
- Resolves or rejects pending requests from `map` based on `result` or `error` payloads.
- `makeRequest()` stores `resolve/reject` handlers for each `id` generated by `makeId()`.

### WorkerThreadGatewayClient

Source: `docs/api/worker-thread/gateway-client.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadGatewayClient

The `WorkerThreadGatewayClient` class provides IPC client functionality for inter-worker communication using Unix domain sockets.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadGatewayClient` for IPC.
> - **Transport:** Uses `net-ipc` library for Unix domain socket communication.
> - **Usage:** Created via `WorkerThreadInit.createGatewayClient()`.

&nbsp;

## Constructor

### `new WorkerThreadGatewayClient()`

Creates a new gateway client instance. Typically not called directly; use `WorkerThreadInit.createGatewayClient()`.

```typescript
import { WorkerThreadGatewayClient } from "gramstax";

const client = new WorkerThreadGatewayClient();
await client.connect("/tmp/my-server.sock");
```

&nbsp;

## Properties

### `.client`

The underlying `net-ipc` Client instance.

- **type: Client**

### `.rpc`

RPC handler for messaging.

- **type: WorkerThreadRpc**

&nbsp;

## Methods

### `.connect(path)`

Connect to a gateway server.

| parameter | type   | required | default | description      | ai_notes                |
| --------- | ------ | -------- | ------- | ---------------- | ----------------------- |
| path      | string | yes      | -       | Unix socket path | Matches server gateway. |

- **returns: Promise<WorkerThreadGatewayClient>**
- **ai_notes:** Resolves when connection is ready.

```typescript
await client.connect("/tmp/worker-server.sock");
console.log("Connected to gateway server");
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the server.

| parameter | type    | required | default | description           | ai_notes                   |
| --------- | ------- | -------- | ------- | --------------------- | -------------------------- |
| method    | string  | yes      | -       | Server method to call | Targets server RPC method. |
| params    | any     | yes      | -       | Method parameters     | Sent as positional array.  |
| wait      | boolean | no       | `true`  | Wait for response     | If false, fire-and-forget. |
| others    | object  | no       | -       | Additional RPC data   | Merged into RPC payload.   |

- **returns: Promise<any>**
- **ai_notes:** Resolves with server response.

```typescript
const result = await client.request("ping", []);
console.log("Server responded:", result);
```

&nbsp;

## Usage

```typescript
// ./worker/server.ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";

export class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-main`;

  constructor() {
    super();
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`);
    return `Hello ${from}, I am Worker-Server!`;
  }

  async mtdStart() {
    const res = await this.createGatewayServer();
    console.log(
      `[Worker-Server] Gateway '${this.gatewayServerPath}' is active.`
    );
    return res;
  }
}

export const WorkerServer = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
export const WorkerServerGateway = WorkerServer.launchGatewayClient();

// ./worker/client.ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";
import { WorkerServerGateway } from "./server";

class Worker extends WorkerThreadInit {
  async mtdTest() {
    const data = await WorkerServerGateway.mtdHello(`worker client`);
    console.log("Data:", data);
  }
}

export const WorkerClient = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});

// ./main.ts
import { WorkerServer } from "./worker/server";
import { WorkerClient } from "./worker/client";

await WorkerServer.launchWorker(); // launch worker server
await WorkerClient.launchWorker(); // launch worker client

await WorkerServer.mtdStart(); // launch server gateway
await WorkerClient.mtdTest(); // call mtdHello to WorkerServer in mtdTest from WorkerClient
```

#### Implementation Details (packages/gramstax/src/worker-thread/gateway-client.ts)

- Initializes `WorkerThreadRpc` with `client.send` and listens to `client.on("message")`.
- `connect()` sets `client.options.path` then resolves once `ready` is emitted.
- `request()` proxies to `WorkerThreadRpc.makeRequest()`.

### WorkerThreadGatewayServer

Source: `docs/api/worker-thread/gateway-server.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.5.2

# WorkerThreadGatewayServer

The `WorkerThreadGatewayServer` class provides IPC server functionality for inter-worker communication using Unix domain sockets.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadGatewayServer` for IPC.
> - **Transport:** Uses `net-ipc` library for Unix domain socket communication.
> - **Multi-client:** Supports connections from multiple gateway clients.
> - **Usage:** Created via `WorkerThreadInit.createGatewayServer()`.

&nbsp;

## Constructor

### `new WorkerThreadGatewayServer()`

Creates a new gateway server instance. Typically not called directly; use `WorkerThreadInit.createGatewayServer()`.

```typescript
import { WorkerThreadGatewayServer } from "gramstax";

const server = new WorkerThreadGatewayServer();
await server.start("/tmp/my-server.sock", {
  ping: () => "pong",
});
```

&nbsp;

## Properties

### `.server`

The underlying `net-ipc` Server instance.

- **type: Server**

### `.rpc`

Map of RPC handlers per connection.

- **type: Map<string, WorkerThreadRpc>**
- **ai_notes:** Key is the connection ID.

### `.methods`

Methods exposed to clients.

- **type: object**

&nbsp;

## Methods

### `.start(path, methods?)`

Start the gateway server.

| parameter | type   | required | default | description                  | ai_notes                     |
| --------- | ------ | -------- | ------- | ---------------------------- | ---------------------------- |
| path      | string | yes      | -       | Unix socket path to bind     | Gateway path identifier.     |
| methods   | object | no       | `{}`    | Methods to expose to clients | Called by connected clients. |

- **returns: Promise<WorkerThreadGatewayServer>**
- **ai_notes:** Resolves when server is ready.

```typescript
await server.start("/tmp/data-worker.sock", {
  ping: () => "pong",
  getData: (key) => database.get(key),
  setData: (key, value) => database.set(key, value),
});
console.log("Gateway server started");
```

&nbsp;

## Server Events

The underlying `net-ipc` server emits these events:

- **`connect`**: New client connected
- **`disconnect`**: Client disconnected
- **`message`**: Message received from client
- **`error`**: Server error occurred

&nbsp;

## Usage

```typescript
// worker-a.ts (Server)
class Worker extends WorkerThreadInit {
  static gatewayServerPath = "/tmp/worker-a.sock";
  data = { count: 0 };

  constructor() {
    super();
  }

  async mtdRunServer() {
    return await this.createGatewayServer();
  }

  mtdGetCount() {
    return this.data.count;
  }

  mtdIncrement() {
    return (this.data.count += 1);
  }
}

// for interact between worker to main
export const WorkerA = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
// for interact between worker to worker
export const WorkerAGateway = Worker.gatewayServerPath();

// worker-b.ts (Client)
import { WorkerAGateway } from "./worker-a";

class WorkerB extends WorkerThreadInit {
  async mtdConnectToA() {
    const count = await WorkerAGateway.mtdGetCount();
    console.log("Count from Worker A:", count);
  }
}

// main.ts (Main Thread)
import { WorkerA } from "./worker-a";
import { WorkerB } from "./worker-a";

await WorkerA.launchWorker(); // launch worker-a
await WorkerB.launchWorker(); // launch worker-b
await WorkerA.mtdRunServer(); // run server with trigger in main thread
await WorkerB.mtdConnectToA(); // run with trigger in main thread
```

#### Implementation Details (packages/gramstax/src/worker-thread/gateway-server.ts)

- Creates a `WorkerThreadRpc` per connection in `server.on("connect")` and stores it in `rpc` map by connection id.
- Forwards incoming `message` events to the per-connection RPC handler.
- Logs server errors via `console.error`.

## Worker Thread Examples

### worker-main.ts

Source: `docs/api/worker-thread/_example/worker-main.ts`

```typescript
import { WorkerServer } from "./worker-server";
import { WorkerClient } from "./worker-client";

async function main() {
  console.log(`--- STARTING WORKER THREAD CLUSTER ---`);

  // 1. Launch Server
  await WorkerServer.launchWorker([`Main-Server`]);

  // // 2. Start Gateway
  await WorkerServer.mtdStart();

  // // 3. Launch Multiple Clients (Sequentially)
  await WorkerClient.launchWorker([`Client-A`]);

  console.log(`(${process.pid}) Cluster launched successfully.`);
}

main().catch(console.error);
setInterval(() => {}, 60000);
```

### worker-server.ts

Source: `docs/api/worker-thread/_example/worker-server.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";

export class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-main`;

  constructor() {
    super();
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`);
    return `Hello ${from}, I am Worker-Server!`;
  }

  async mtdStart() {
    const res = await this.createGatewayServer();
    if (res) {
      console.log(
        `[Worker-Server] Gateway '${this.gatewayServerPath}' is active.`
      );
      return res;
    }
    return false;
  }
}

export const WorkerServer = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
export const WorkerServerGateway = WorkerServer.launchGatewayClient();
```

### worker-client.ts

Source: `docs/api/worker-thread/_example/worker-client.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";
import { WorkerServerGateway } from "./worker-server";

class Worker extends WorkerThreadInit {
  private name: string = `Unknown`;

  constructor() {
    super();
    this.name = this.argv[3] || `Unknown`;
    this.mtdAutoRun();
  }

  async mtdAutoRun() {
    console.log(`[Worker-Client-${this.name}] Starting autoRun...`);
    try {
      console.log(`[Worker-Client-${this.name}] Connecting to gateway...`);
      const res = await WorkerServerGateway.mtdHello(
        this,
        `Worker-Client-${this.name}`
      );
      console.log(`[Worker-Client-${this.name}] Server response: ${res}`);
    } catch (err: any) {
      console.error(`[Worker-Client-${this.name}] Error:`, err.message || err);
    }
  }
}

export const WorkerClient = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
```

### test-final-main.ts

Source: `docs/api/worker-thread/_example/test-final-main.ts`

```typescript
import { ServerMain } from "./test-final-server-main";
import { WorkerA } from "./test-final-worker-a";
import { WorkerB } from "./test-final-worker-b";
import { WorkerC } from "./test-final-worker-c";

async function run() {
  console.log(`--- STARTING FINAL 1-SERVER / 3-CLIENTS TEST ---`);

  // Launch Server
  await ServerMain.launchWorker([`Server`]);
  await ServerMain.mtdStart();
  await ServerMain.mtdHello(`From Main Thread`);

  // Launch Clients
  await WorkerA.launchWorker([`A`]);
  await WorkerB.launchWorker([`B`]);
  await WorkerC.launchWorker([`C`]);

  console.log(`All workers launched. Interaction is autonomous.`);

  // Keep alive to see all logs
  await new Promise((r) => setTimeout(r, 8000));
  console.log(`Final test complete. Exiting.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(`Final Test Error:`, err);
  process.exit(1);
});
```

### test-final-server-main.ts

Source: `docs/api/worker-thread/_example/test-final-server-main.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";

class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-final`;
  constructor() {
    super();
  }

  mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`);
    return `Hello ${from}, I am Server-Main!`;
  }

  async mtdStart() {
    const res = await this.createGatewayServer();
    if (res) {
      console.log(
        `[Server-Main] Gateway '${this.gatewayServerPath}' is active.`
      );
      return res;
    }
    return false;
  }
}

export const ServerMain = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
export const ServerMainGateway = ServerMain.launchGatewayClient();
```

### test-final-worker-a.ts

Source: `docs/api/worker-thread/_example/test-final-worker-a.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";
import { ServerMainGateway } from "./test-final-server-main";

class Worker extends WorkerThreadInit {
  constructor() {
    super();
    this.mtdAutoRun();
  }

  async mtdAutoRun() {
    console.log(`[Worker-A] Starting autoRun...`);
    try {
      console.log(`[Worker-A] Connecting to gateway-final...`);
      const res = await ServerMainGateway.mtdHello(this, `Worker-A`);
      console.log(`[Worker-A] Server response: ${res}`);
    } catch (err: any) {
      console.error(`[Worker-A] Error:`, err.message || err);
    }
  }
}

export const WorkerA = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
```

### test-final-worker-b.ts

Source: `docs/api/worker-thread/_example/test-final-worker-b.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";
import { ServerMainGateway } from "./test-final-server-main";

class Worker extends WorkerThreadInit {
  constructor() {
    super();
    this.mtdAutoRun();
  }

  async mtdAutoRun() {
    console.log(`[Worker-B] Starting autoRun...`);
    try {
      console.log(`[Worker-B] Connecting to gateway-final...`);
      const res = await ServerMainGateway.mtdHello(this, `Worker-B`);
      console.log(`[Worker-B] Server response: ${res}`);
    } catch (err: any) {
      console.error(`[Worker-B] Error:`, err.message || err);
    }
  }
}

export const WorkerB = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
```

### test-final-worker-c.ts

Source: `docs/api/worker-thread/_example/test-final-worker-c.ts`

```typescript
import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init";
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export";
import { ServerMainGateway } from "./test-final-server-main";

class Worker extends WorkerThreadInit {
  constructor() {
    super();
    this.mtdAutoRun();
  }

  async mtdAutoRun() {
    console.log(`[Worker-C] Starting autoRun...`);
    try {
      console.log(`[Worker-C] Connecting to gateway-final...`);
      const res = await ServerMainGateway.mtdHello(this, `Worker-C`);
      console.log(`[Worker-C] Server response: ${res}`);
    } catch (err: any) {
      console.error(`[Worker-C] Error:`, err.message || err);
    }
  }
}

export const WorkerC = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
```

## Source Exports

Source: `packages/gramstax/src/index.ts`

- `export * from "./utils/log"`
- `export * from "./cache/external"`
- `export * from "./core/bot"`
- `export * from "./core/ctx"`
- `export * from "./template/engine"`
- `export * from "./template/manager"`
- `export * from "./blocks/keyboard"`
- `export * from "./labels/keyboard"`
- `export * from "./worker-thread/export"`
- `export * from "./worker-thread/gateway-client"`
- `export * from "./worker-thread/gateway-server"`
- `export * from "./worker-thread/init"`
- `export * from "./worker-thread/launch"`
- `export * from "./worker-thread/pool"`
- `export * from "./worker-thread/rpc"`
