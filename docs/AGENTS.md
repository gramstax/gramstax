# Gramstax API Reference (AGENTS)

Consolidates `docs/api` content with implementation notes from `packages/gramstax/src`.

## Summary

- Aggregates all API docs from `docs/api`.
- Adds implementation cross-references from `packages/gramstax/src`.
- Notes mismatches between docs and code where relevant.

## Table of Contents

- [Summary](#summary)
- [Documentation Overview](#documentation-overview)
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
- [Components](#components)
  - [ComponentKeyboard](#componentkeyboard)
- [Data](#data)
  - [DataKeyboard](#datakeyboard)
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
> - **Last Updated:** 13/01/2026 23:40:00
> - **Framework Version:** v0.3.20

# CacheExternal

The `CacheExternal` class extends [Keyv](https://github.com/jaredwray/keyv) to provide a unified caching interface with built-in support for memory and Redis storage.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `CacheExternal` public API surface (constructor, inherited methods from Keyv).
> - **Storage modes:**
>   - **Memory mode:** when `url` is `"memory"` (default), uses an in-memory `Map`.
>   - **Redis mode:** when `url` starts with `"redis"`, uses `@keyv/redis` adapter.
>   - **Custom mode:** when `more.forceStore` is provided, uses the custom store.

&nbsp;

## Constructor

### `new CacheExternal(url?, namespace?, ttl?, more?)`

| parameter | type   | required | default    | description                          | ai_notes                                             |
| --------- | ------ | -------- | ---------- | ------------------------------------ | ---------------------------------------------------- |
| url       | string | no       | `"memory"` | Storage connection URL               | Memory uses `"memory"`; Redis uses `"redis://..."`.  |
| namespace | string | no       | -          | Key namespace prefix                 | Isolates keys by namespace.                          |
| ttl       | number | no       | -          | Default time-to-live in milliseconds | Applies to all keys unless overridden per operation. |
| more      | IMore  | no       | -          | Additional Keyv options              | `forceStore` overrides automatic store selection.    |

```typescript
import { CacheExternal } from "gramstax";

// Memory cache (default)
const memoryCache = new CacheExternal();

// Redis cache
const redisCache = new CacheExternal(
  "redis://localhost:6379",
  "session",
  3600000
);

// With namespace and TTL
const cache = new CacheExternal("memory", "myapp", 60000);
```

&nbsp;

## Inherited Methods

`CacheExternal` inherits all methods from [Keyv](https://github.com/jaredwray/keyv):

### `.get(key)`

Get a value by key.

| parameter | type   | required | description | ai_notes      |
| --------- | ------ | -------- | ----------- | ------------- |
| key       | string | yes      | The key     | Cache lookup. |

- **returns: Promise<any>**
- **ai_notes:** Resolves with stored value or undefined.

```typescript
const value = await cache.get("user:123");
```

### `.set(key, value, ttl?)`

Set a value with optional TTL.

| parameter | type   | required | default | description         | ai_notes                        |
| --------- | ------ | -------- | ------- | ------------------- | ------------------------------- |
| key       | string | yes      | -       | The key             | cache lookup.                   |
| value     | any    | yes      | -       | The value to store  | Persisted cache payload.        |
| ttl       | number | no       | -       | TTL in milliseconds | Overrides default TTL when set. |

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

```typescript
await cache.set("user:123", { name: "John" }, 60000);
```

### `.delete(key)`

Delete a key.

| parameter | type   | required | description | ai_notes             |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | The key     | Cache key to remove. |

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

```typescript
await cache.delete("user:123");
```

### `.clear()`

Clear all keys in the namespace.

- **returns: Promise<void>**
- **ai_notes:** Resolves when cache is cleared.

```typescript
await cache.clear();
```

### `.has(key)`

Check if a key exists.

| parameter | type   | required | description | ai_notes      |
| --------- | ------ | -------- | ----------- | ------------- |
| key       | string | yes      | The key     | Cache lookup. |

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

```typescript
const exists = await cache.has("user:123");
```

## Usage

```typescript
import { CacheExternal } from "gramstax";

const cache = new CacheExternal(`memory`);

// set data
const key = `anything:123`;
await cache.set(key, { name: `Alya` });

// get data
const user = await cache.get(key);
console.log(user);

// delete data
const status = await cache.delete(key);
console.log(`status delete: ${status}`);

// has data
const isAvl = await cache.has(key);
console.log(`data is available: ${isAvl}`);
```

#### Implementation Details (packages/gramstax/src/cache/external.ts)

- Extends `Keyv` and sets `store` based on `url` (`redis` → `@keyv/redis`, `memory` → `Map`).
- Supports `more.forceStore` to override the auto-selected store.
- Uses `namespace` and `ttl` directly in the parent `Keyv` constructor.

## Core

### Gramstax

Source: `docs/api/core/bot.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 22:59:25
> - **Framework Version:** v0.3.20

### Ctx

Source: `docs/api/core/ctx.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2026 22:59:25
> - **Framework Version:** v0.3.20

# Ctx

The `Ctx` class is the context/page base class that provides access to user data, session management, template rendering, and reply methods.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Ctx` base class for pages.
> - **Usage:** Extend this class to create page handlers.
> - **Template:** Define static `template` property for HTML-like templates.
> - **Data:** Define static `data` via `buildData()` for routing configuration.

&nbsp;

## Static Properties

### `.template`

HTML-like template string for the page.

- **type: string | undefined**

```typescript
import { PageBase } from "~/base/page";

class MyPage extends PageBase {
  static template = `
    <base>
      <keyboard>Button 1, Button 2</keyboard>
      <message>Hello {{name}}!</message>
    </base>
  `;
}
```

### `.data`

Page routing data created by `buildData()`.

- **type: IPageData**

&nbsp;

## Static Methods

### `.buildData(params?)`

Create page data configuration. Accepts an optional callback or an options object.

**Supported signatures**

- `buildData()`
- `buildData(callbackDataFn)`
- `buildData({ callbackData?, text?, textCommand? })`

**Options**

| key          | type     | required | description                                           | ai_notes                                                                                       |
| ------------ | -------- | -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| callbackData | function | no       | Function returning callback payload                   | Appends `:<payload>` to the auto-generated callback key;                                       |
| text         | string   | no       | Overrides trigger value for the `text()` route        | Only a single space is supported (max two words, e.g. `"🏠 Home"`); leave unset unless needed. |
| textCommand  | string   | no       | Overrides trigger value for the `textCommand()` route | Useful when the default name contains `-`; leave unset unless needed.                          |

**Internal fields (auto-set)**

- `name`: internal page name assigned by the framework.
- `_callbackData`: internal callback key (may be numeric if `shortCallbackData` is enabled).
- `_positionPayloadText`: internal payload index for `text` triggers (max 2 when `text` contains one space).

- **returns: IPageData**
- **ai_notes:** Metadata used for routing.

```typescript
import { PageBase } from "~/base/page";

class MyPage extends PageBase {
  // Basic usage (auto-generated name and callback key)
  static data = this.buildData();

  // With payload function for callback data
  static data = this.buildData((id: string) => id);

  // Custom data
  static data = this.buildData({
    callbackData: (action: string) => action,
    textCommand: "mycommand", // overrides trigger route function textCommand
    text: "hi", // overrides trigger route function text
  });
}
```

&nbsp;

## User Properties

### `.userId`

Get current user's Telegram ID.

- **type: number**

### `.userName`

Get current user's username.

- **type: string | undefined**

### `.userFirstName`

Get current user's first name.

- **type: string**

### `.userLastName`

Get current user's last name.

- **type: string | undefined**

### `.userFullName`

Get current user's full name.

- **type: string**

### `.userLanguage`

Get or set current user's language code.

- **type: string**

### `.userIsPremium`

Check if user has Telegram Premium.

- **type: boolean**

### `.userIsBot`

Check if user is a bot.

- **type: boolean**

&nbsp;

## Message Properties

### `.msgText`

Get message text.

- **type: string | undefined**

### `.msgTextPayload`

Get first payload from text message.

- **type: string | undefined**

### `.msgTextPayloads`

Get all payloads from text message.

- **type: string[]**

### `.msgCaption`

Get message caption.

- **type: string | undefined**

### `.msgPhoto`

Get photo message data.

- **type: PhotoSize[] | undefined**

### `.msgVideo`

Get video message data.

- **type: Video | undefined**

### `.msgAudio`

Get audio message data.

- **type: Audio | undefined**

&nbsp;

## Callback Properties

### `.callbackData`

Get callback query data.

- **type: string | undefined**

### `.callbackDataPayload`

Get first payload from callback data.

- **type: string | undefined**

### `.callbackDataPayloads`

Get all payloads from callback data.

- **type: string[]**

&nbsp;

## Session Methods

### `.sessionGet()`

Get current session data.

- **returns: Promise<{ method: string; params: any } | undefined>**
- **ai_notes:** Resolves with stored session payload.

### `.sessionSet(method, params)`

Set session data.

| parameter | type   | required | description        | ai_notes                    |
| --------- | ------ | -------- | ------------------ | --------------------------- |
| method    | string | yes      | Session method     | Matches route handler name. |
| params    | any    | no       | Session parameters | Stored in session payload.  |

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

### `.sessionClear()`

Clear current session.

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

### `.sessionCallback(params?, name?)`

Set session for callback route.

### `.sessionCallbackPayload(params?, name?)`

Set session for callbackPayload route.

### `.sessionText(params?, name?)`

Set session for text route.

### `.sessionTextPayload(params?, name?)`

Set session for textPayload route.

### `.sessionTextFree(params?, name?)`

Set session for textFree route.

&nbsp;

## Reply Methods

### `.reply(keyboard?, data?, baseId?, options?)`

Send a text message reply.

| parameter | type    | required | default   | description         | ai_notes                          |
| --------- | ------- | -------- | --------- | ------------------- | --------------------------------- |
| keyboard  | IInBoKb | no       | -         | Keyboard markup     | From `ikb()` or `bkb()` builders. |
| data      | object  | no       | -         | Template data       | Used for template interpolation.  |
| baseId    | string  | no       | "default" | Template base ID    | Matches `<base id="...">`.        |
| options   | object  | no       | -         | grammY send options | Passed to grammY `reply` options. |

- **returns: Promise<Message>**
- **ai_notes:** Resolves with sent message.

```typescript
await this.reply(this.kb(), { name: "John" });
```

### `.replyPhoto(keyboard?, data?, baseId?, options?)`

Send a photo message.

### `.replyVideo(keyboard?, data?, baseId?, options?)`

Send a video message.

### `.replyAudio(keyboard?, data?, baseId?, options?)`

Send an audio message.

### `.replyDocument(keyboard?, data?, baseId?, options?)`

Send a document message.

### `.replyAnimation(keyboard?, data?, baseId?, options?)`

Send an animation/GIF.

### `.replyVoice(keyboard?, data?, baseId?, options?)`

Send a voice message.

### `.replyVideoNote(keyboard?, data?, baseId?, options?)`

Send a video note.

### `.replySticker(keyboard?, data?, baseId?, options?)`

Send a sticker.

### `.replyLocation(keyboard?, data?, baseId?, options?)`

Send a location.

### `.replyContact(keyboard?, data?, baseId?, options?)`

Send a contact.

&nbsp;

## Edit Methods

### `.edit(keyboard?, data?, baseId?, options?)`

Edit the current message text.

### `.editPhoto(keyboard?, data?, baseId?, options?)`

Edit media to photo.

### `.editVideo(keyboard?, data?, baseId?, options?)`

Edit media to video.

### `.editAudio(keyboard?, data?, baseId?, options?)`

Edit media to audio.

### `.editDocument(keyboard?, data?, baseId?, options?)`

Edit media to document.

### `.editAnimation(keyboard?, data?, baseId?, options?)`

Edit media to animation.

&nbsp;

## Other Methods

### `.delete()`

Delete the current message.

- **returns: Promise<boolean>**
- **ai_notes:** Resolves with operation result.

### `.sleep(ms)`

Wait for specified milliseconds.

| parameter | type   | required | description  | ai_notes             |
| --------- | ------ | -------- | ------------ | -------------------- |
| ms        | number | yes      | Milliseconds | Delay before resume. |

- **returns: Promise<void>**
- **ai_notes:** Resolves after delay.

### `.callbackQueryAnswer(text?, options?)`

Answer callback query (show toast).

| parameter | type   | required | description    | ai_notes                         |
| --------- | ------ | -------- | -------------- | -------------------------------- |
| text      | string | no       | Toast text     | Shown as notification to user.   |
| options   | object | no       | Answer options | Passed to grammY answer options. |

### `.ikb(builder) or .inlineKeyboard(builder)` and `.bkb(builder) or .bottomKeyboard(builder)`

Create using builder pattern.

| parameter | type     | required | description      | ai_notes               |
| --------- | -------- | -------- | ---------------- | ---------------------- |
| builder   | function | yes      | Builder callback | Receives (kb, labels). |

parameter builder.

| parameter | type     | required | description        | ai_notes                                                                    |
| --------- | -------- | -------- | ------------------ | --------------------------------------------------------------------------- |
| k         | object   | yes      | For build keyboard | init class InlineKeyboard (for inline) or Keyboard (for bottom) from grammY |
| a         | string[] | yes      | For text keyboard  | each value is obtained from the <keyboard> block with a comma separator     |

- **returns: InlineKeyboard or BottomKeyboard**
- **ai_notes:** Builder instance for inline buttons and bottom buttons.

```typescript
// inline keyboard (will show on below message)
const ik = this.ikb((k, a) => {
  return k //
    .text(a[0]!, "action1")
    .text(a[1]!, "action2")
    .row()
    .text(a[2]!, "action3");
});

// bottom keyboard (will show on below position keyboard phone)
const bk = this.bkb((k, a) => {
  return k //
    .text(a[0]!)
    .text(a[1]!)
    .row()
    .text(a[2])
    .oneTime();
});
```

### `.to(data: {})`

Transition to another page.

| parameter | type   | required | description  | ai_notes                                                                 |
| --------- | ------ | -------- | ------------ | ------------------------------------------------------------------------ |
| data      | object | no       | Data to pass | Provide the data from the previous page to this page that is only needed |

```typescript
// ./pages/home.ts
async to(data: {inputName: any}) {
  await edit(undefined, data)
}

// ./pages/others.ts
await new HomePage(this).to({ inputName: `test` });
```

&nbsp;

## Route Methods

Define these methods in your page class to handle specific routes:

| Method                             | Trigger                                                        | Trigger Example                     |
| ---------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `callback()`                       | Exact callback data match                                      | k.text(`title button`, `start`)     |
| `callbackPayload()`                | Callback with payload (tested only 1 payload after symbol ":") | k.text(`title button`, `start:123`) |
| `text()`                           | Exact text match with.                                         | message: start                      |
| `textPayload()`                    | Text with payload                                              | message: start 123 AAA              |
| `textCommand()`                    | Command match                                                  | message: /start                     |
| `textCommandPayload()`             | Command with payload                                           | message: /start 123 AAA             |
| `textFree()`                       | Any text (fallback route if set)                               | message: <A-Za-z0-9>                |
| `photoCaption()`                   | Exact caption match                                            | caption: start                      |
| `photoCaptionPayload()`            | Caption with payload                                           | caption: start 123 AAA              |
| `photoCaptionCommand()`            | Caption Command match                                          | caption: /start                     |
| `photoCaptionCommandPayload()`     | Caption Command with payload                                   | caption: /start 123 AAA             |
| `photoFree()`                      | Any photo (fallback route if set)                              | photo: <A-Za-z0-9>                  |
| `videoCaption()`                   | Exact caption match                                            | caption: start                      |
| `videoCaptionPayload()`            | Caption with payload                                           | caption: start 123 AAA              |
| `videoCaptionCommand()`            | Caption Command match                                          | caption: /start                     |
| `videoCaptionCommandPayload()`     | Caption Command with payload                                   | caption: /start 123 AAA             |
| `videoFree()`                      | Any video (fallback route if set)                              | video: <A-Za-z0-9>                  |
| `audioCaption()`                   | Exact caption match                                            | caption: start                      |
| `audioCaptionPayload()`            | Caption with payload                                           | caption: start 123 AAA              |
| `audioCaptionCommand()`            | Caption Command match                                          | caption: /start                     |
| `audioCaptionCommandPayload()`     | Caption Command with payload                                   | caption: /start 123 AAA             |
| `audioFree()`                      | Any audio (fallback route if set)                              | audio: <A-Za-z0-9>                  |
| `documentCaption()`                | Exact caption match                                            | caption: start                      |
| `documentCaptionPayload()`         | Caption with payload                                           | caption: start 123 AAA              |
| `documentCaptionCommand()`         | Caption Command match                                          | caption: /start                     |
| `documentCaptionCommandPayload()`  | Caption Command with payload                                   | caption: /start 123 AAA             |
| `documentFree()`                   | Any document (fallback route if set)                           | document: <A-Za-z0-9>               |
| `animationCaption()`               | Exact caption match                                            | caption: start                      |
| `animationCaptionPayload()`        | Caption with payload                                           | caption: start 123 AAA              |
| `animationCaptionCommand()`        | Caption Command match                                          | caption: /start                     |
| `animationCaptionCommandPayload()` | Caption Command with payload                                   | caption: /start 123 AAA             |
| `animationFree()`                  | Any animation (fallback route if set)                          | animation: <A-Za-z0-9>              |
| `voiceCaption()`                   | Exact caption match                                            | caption: start                      |
| `voiceCaptionPayload()`            | Caption with payload                                           | caption: start 123 AAA              |
| `voiceCaptionCommand()`            | Caption Command match                                          | caption: /start                     |
| `voiceCaptionCommandPayload()`     | Caption Command with payload                                   | caption: /start 123 AAA             |
| `voiceFree()`                      | Any voice (fallback route if set)                              | voice: <A-Za-z0-9>                  |
| `videoNoteCaption()`               | Exact caption match                                            | caption: start                      |
| `videoNoteCaptionPayload()`        | Caption with payload                                           | caption: start 123 AAA              |
| `videoNoteCaptionCommand()`        | Caption Command match                                          | caption: /start                     |
| `videoNoteCaptionCommandPayload()` | Caption Command with payload                                   | caption: /start 123 AAA             |
| `videoNoteFree()`                  | Any video note (fallback route if set)                         | videoNote: <A-Za-z0-9>              |
| `stickerFree()`                    | Any sticker (fallback route if set)                            | sticker: <A-Za-z0-9>                |
| `locationFree()`                   | Any location (fallback route if set)                           | location: <A-Za-z0-9>               |
| `contactFree()`                    | Any contact (fallback route if set)                            | contact: <A-Za-z0-9>                |
| `free()`                           | Any all route (fallback route if set)                          | <A-Za-z0-9>                         |

&nbsp;

## Usage

```typescript
import { PageBase } from "~/base/page";
import { OtherPage } from "./other";

export class MyPage extends PageBase {
  static data = this.buildData((action: string) => action);

  kb() {
    return this.ikb((k, a) => {
      return k
        .text(a[0]!, this.data.callbackData("confirm"))
        .text(a[1]!, this.data.callbackData("cancel"));
    });
  }

  async textCommand() {
    // will render message and keyboard from base without id
    await this.reply(this.kb(), { name: this.userFirstName });
  }

  async callbackPayload() {
    const action = this.callbackDataPayload;
    if (action === "confirm") {
      // will render message from base id "confirmed"
      await this.edit(undefined, {}, "confirmed");
    } else {
      // transition to other page
      await new OtherPage(this).to();
    }
  }

  static template = `
    <base>
      <keyboard>Confirm, Cancel</keyboard>
      <message>Hello {{name}}, please choose:</message>
    </base>
    <base id="confirmed">
      <message>You click button confirmed!</message>
    </base>
  `;
}
```

#### Implementation Details (packages/gramstax/src/core/ctx.ts)

- `Ctx` exposes additional getters: `msgTextCommandPayloads`, `msgTextCommandPayload`, `msgCaptionPayloads`, `msgCaptionCommandPayloads`, and media getters (`msgPhoto`, `msgVideo`, `msgAudio`).
- `broadcast(ids, languageCode, ...)` sends messages with per-user language, throttling every 30 messages via `setTimeout(1200)`.
- `replyMedia` and `editMedia` route through template media blocks from `TemplateManager.getMedia()`.
- `replyAction` wraps grammY `replyWithChatAction`.
- `edit()` can fallback to `reply()` when editing fails unless `fallbackReply` is `false`.
- Session methods return `null` on error and store session payloads in `CacheExternal` using key `userId`.
- Adds helpers for keyboard caching: `inlineKeyboard` and `bottomKeyboard` support `{ cache: true }` and store keyboards in `cacheKeyboard` with keys like `"<page>:<lang>:i"` and `"<page>:<lang>:b"`.
- Adds string parsing helpers: `getSeperatorTag`, `havePayloads`, `getPayloads`, `getIntent`.
- Provides extensive session validation, setting, and merging helpers for every route type (`sessionToText`, `sessionToPhotoCaptionPayload`, etc.).
- `buildData()` assigns `_callbackData` and `_positionPayloadText`, wraps `callbackData()` to append `:` payloads, and derives `text` payload position when a single space is used.
- Session method identifiers are numeric prefixes (`1-45`) built via `methodSession()`.
- `sleep(ms)` is documented but not implemented in `Ctx` (no method in `packages/gramstax/src/core/ctx.ts`).

## Page

### PageManager

Source: `docs/api/page/manager.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# TemplateEngine

The `TemplateEngine` class provides static methods for parsing and compiling HTML-like templates into executable functions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateEngine` static methods for template parsing.
> - **Internal:** Typically used internally by `TemplateManager`.
> - **Format:** Parses HTML-like syntax with custom blocks.

&nbsp;

## Template Syntax

### Base Block

Container for template sections with optional ID and language variants.

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

Text content with variable interpolation.

```html
<message>Hello {{name}}!</message> <message lang="id">Halo {{name}}!</message>
```

### Keyboard Block

Comma-separated button labels.

```html
<keyboard>Yes, No</keyboard>
<keyboard type="bottom">Button 1, Button 2</keyboard>
<keyboard lang="id">Ya, Tidak</keyboard>
```

### Description Block

Bot command descriptions for Telegram menu.

```html
<description>Start the bot</description>
<description lang="id">Mulai bot</description>
<description scope="chat_administrators">Admin command</description>
```

### Media Blocks

Various media types.

```html
<photo src="path/to/image.jpg">Caption text</photo>
<video src="path/to/video.mp4">Video caption</video>
<audio src="path/to/audio.mp3">Audio title</audio>
<document src="path/to/file.pdf">Document caption</document>
<animation src="path/to/gif.gif">GIF caption</animation>
<voice src="path/to/voice.ogg" />
<video_note src="path/to/note.mp4" />
<sticker src="sticker_file_id" />
<location latitude="123.456" longitude="78.90" />
<contact phone="+1234567890" first_name="John" last_name="Doe" />
```

### Control Blocks

#### Switch Block

Conditional rendering.

```html
<switch value="{{status}}">
  <case is="active">Active status</case>
  <case is="pending">Pending status</case>
  <default>Unknown status</default>
</switch>
```

#### Map Block

Loop over arrays.

```html
<map for="item" in="{{items}}"> - {{item.name}}: {{item.value}} </map>
```

#### Import Block

Import from another template.

```html
<import src="other-page" base="kb-section" />
```

#### Space Block

Preserve whitespace.

```html
<space>Line 1 Line 2</space>
```

#### Div Block

Text container.

```html
<div>Content here</div>
```

&nbsp;

## Static Methods

### `.compileMessages(template, baseBlocks?)`

Compile message blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => string } }`
- **ai_notes:** Compiled message functions by base/lang.

### `.compileKeyboards(template, baseBlocks?)`

Compile keyboard blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: { inline, bottom } } }`
- **ai_notes:** Compiled keyboard builders per base/lang.

### `.compileMedia(template, baseBlocks?)`

Compile media blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => IMediaBlock } }`
- **ai_notes:** Compiled media builders per base/lang.

### `.compileDescription(template, baseBlocks?)`

Compile description blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [scope]: { [lang]: (data) => string } } }`
- **ai_notes:** Compiled description functions by scope.

### `.processImportBlocks(template, resolver, depth?, importCache?)`

Process import blocks recursively.

| parameter   | type     | required | default | description                 | ai_notes                           |
| ----------- | -------- | -------- | ------- | --------------------------- | ---------------------------------- |
| template    | string   | yes      | -       | Template with imports       | Contains `<import>` directives.    |
| resolver    | function | yes      | -       | Function to resolve imports | Returns template content string.   |
| depth       | number   | no       | 0       | Current recursion depth     | Stops at depth limit.              |
| importCache | Map      | no       | -       | Cache for resolved imports  | Optional reuse of resolved blocks. |

- **returns: string** - Template with imports resolved.
- **ai_notes:** Returns template with `<import>` blocks replaced.

&nbsp;

## Variable Interpolation

Variables use double curly braces:

```html
<message> Hello {{ name }}, you have {{ count }} items. </message>
```

Supports nested properties:

```html
<message> User: {{user.name}}, Email: {{user.email}} </message>
```

&nbsp;

## Usage

```typescript
import { TemplateEngine } from "gramstax";

const template = `
  <base>
    <keyboard>Back, Next</keyboard>
    <keyboard lang="id">Kembali, Lanjut</keyboard>
    <message>
      Welcome {{name}}!
      
      Your balance: {{balance}}
    </message>
    <message lang="id">
      Selamat datang {{name}}!
      
      Saldo Anda: {{balance}}
    </message>
  </base>
  
  <base id="error">
    <message>Error: {{error}}</message>
  </base>
`;

const messages = TemplateEngine.compileMessages(template);
const keyboards = TemplateEngine.compileKeyboards(template);

// Get English message
const msg = messages.default.default({ name: "John", balance: "$100" });

// Get Indonesian keyboard
const kb = keyboards.default.id.inline({ name: "John" });
```

#### Implementation Details (packages/gramstax/src/template/engine.ts)

- Supports additional template blocks not explicit in docs: `<script>`, `{~ ... ~}` (inline JS expression), and `<media>` blocks with `type`/`lang` attributes.
- Template media parsing only recognizes `<media type="...">` blocks; `<photo>`, `<video>`, etc. are not parsed in `TemplateEngine`.
- `TemplateEngine._processBaseBlocks()` extracts `<base>` content and normalizes indentation.
- `TemplateEngine._processMapBlocks()` expects `src="<arrayKey>"` and optional `join`, not `for`/`in` attributes; it substitutes `{{e}}`, `{{e.<prop>}}`, and `{{i}}` placeholders.
- `_processSwitchBlocks()` supports multiple comma-separated `is` values and `default` fallbacks.
- `_processKeyboardBlocks()` splits labels using `/((?<!\\),\s*)/` to respect escaped commas and strips `\\,`.
- Import processing caches blocks via `processImportBlocks()` with a recursion depth limit of 10 and supports `block`, `base`, `lang`, and `section` attributes.
- `_processSpaceBlocks()` only strips self-closing `<space />` lines (not `<space>...</space>` content).
- `compileMedia()` resolves media block properties at runtime by compiling individual properties into functions.

### TemplateManager

Source: `docs/api/template/manager.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type   | required | description | ai_notes               |
| --------- | ------ | -------- | ----------- | ---------------------- |
| key       | string | yes      | Page name   | Template cache lookup. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

## Components

### ComponentKeyboard

Source: `docs/api/components/keyboard.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# ComponentKeyboard

The `ComponentKeyboard` class provides static methods for generating keyboard template blocks from `DataKeyboard` definitions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `ComponentKeyboard` static methods.
> - **Dependency:** Requires `DataKeyboard` to be set via `ComponentKeyboard.data`.
> - **Output:** Generates HTML-like `<keyboard>` blocks for template engine.

&nbsp;

## Static Properties

### `.data`

Reference to the `DataKeyboard` class containing keyboard definitions.

- **type: typeof DataKeyboard**
- **required:** Must be set before using `_build()`.

```typescript
import { ComponentKeyboard, DataKeyboard } from "gramstax";

class MyKeyboards extends DataKeyboard {
  static backNext() {
    return { en: "Back, Next", id: "Kembali, Lanjut" };
  }
}

ComponentKeyboard.data = MyKeyboards;
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
ComponentKeyboard._process(obj, { type: "inline" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard> <keyboard type="inline" lang="id">Kembali, Lanjut</keyboard>`

// Single language
ComponentKeyboard._process(obj, { type: "inline", lang: "en" });
// => `<keyboard type="inline" lang="en">Back, Next</keyboard>`

// Reversed
ComponentKeyboard._process(obj, { type: "inline", reverse: true });
// => `<keyboard type="inline" lang="en">Next, Back</keyboard> ...`
```

&nbsp;

### `._build(key, lang?, type?)`

Build keyboard blocks by calling a method from the linked `DataKeyboard`.

| parameter | type   | required | default    | description                 | ai_notes                               |
| --------- | ------ | -------- | ---------- | --------------------------- | -------------------------------------- |
| key       | string | yes      | -          | Method name in DataKeyboard | Must exist or throws.                  |
| lang      | string | no       | -          | Target language             | If set, returns single language block. |
| type      | string | no       | `"inline"` | Keyboard type               | Values are `"inline"` or `"bottom"`.   |

- **returns: string**
- **ai_notes:** Returns keyboard block string.
- **throws:** Error if `data` not set or method not found.

```typescript
// Assuming ComponentKeyboard.data = MyKeyboards with backNext() method

ComponentKeyboard._build("backNext");
// => '<keyboard type="inline" lang="en">Back, Next</keyboard> ...'

ComponentKeyboard._build("backNext", "en", "bottom");
// => '<keyboard type="bottom" lang="en">Back, Next</keyboard>'
```

&nbsp;

## Usage

```typescript
import { ComponentKeyboard, DataKeyboard, Ctx } from "gramstax";

// ./data/keyboard.ts
class KeyboardD extends DataKeyboard {
  static navigation() {
    return {
      en: "Back, Home, Next",
      id: "Kembali, Beranda, Lanjut",
    };
  }
}

// ./components/keyboard.ts
export class KeyboardC extends ComponentKeyboard {
  static data = KeyboardD;
  static navigation(lang?: string, type?: string) {
    return this._build(`navigation`, lang, type);
  }
}

// ./base/page.ts
export class PageBase extends Ctx {
  static kbc = KeyboardC;
  static kbd = KeyboardC.data;
}

// ./pages/my.ts
// Use in page template
export class MyPage extends PageBase {
  static template = `
    <base>
      ${this.kbc.navigation()}
      <message>Choose an option</message>
    </base>
  `;
}
```

#### Implementation Details (packages/gramstax/src/components/keyboard.ts)

- `_process()` defaults `type` to `inline` and supports generating multiple `<keyboard>` tags when `lang` is omitted.
- `_process()` reverses button order through `DataKeyboard._reverse()` when `params.reverse` is `true`.
- `_build()` throws when `data` or method is missing and calls the DataKeyboard method with `lang` before rendering.

## Data

### DataKeyboard

Source: `docs/api/data/keyboard.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# DataKeyboard

The `DataKeyboard` class provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `DataKeyboard` static utility methods.
> - **Usage:** Used as base class for user-defined keyboard data classes.
> - **Purpose:** Provides button order manipulation for multi-language keyboards.

&nbsp;

## Static Methods

### `._reverse(input)`

Reverse the order of comma-separated button labels.

| parameter | type   | required | description                   | ai_notes                              |
| --------- | ------ | -------- | ----------------------------- | ------------------------------------- |
| input     | string | yes      | Comma-separated button labels | Escaped commas (`\\,`) are preserved. |

- **returns: string**
- **ai_notes:** Reversed comma-separated labels.

```typescript
import { DataKeyboard } from "gramstax";

const reversed = DataKeyboard._reverse("Back, Next, Submit");
// => "Submit, Next, Back"

// Escaped commas are preserved
const preserved = DataKeyboard._reverse("Option A\\, B, Option C");
// => "Option C, Option A\\, B"
```

&nbsp;

### `._reverseObj(input)`

Reverse button order for all languages in an object.

| parameter | type   | required | description                                 | ai_notes                            |
| --------- | ------ | -------- | ------------------------------------------- | ----------------------------------- |
| input     | object | yes      | Object with language keys and button values | Applies `_reverse()` to each value. |

- **returns: object**
- **ai_notes:** Returns object with reversed labels.

```typescript
const reversed = DataKeyboard._reverseObj({
  en: "Back, Next",
  id: "Kembali, Lanjut",
});
// => { en: "Next, Back", id: "Lanjut, Kembali" }
```

&nbsp;

### `._build(lang, reverse, obj)`

Build keyboard string with optional language selection and reversal.

| parameter | type    | required | description                     | ai_notes                                       |
| --------- | ------- | -------- | ------------------------------- | ---------------------------------------------- |
| lang      | string  | no       | Target language code            | If provided, returns only that language value. |
| reverse   | boolean | no       | Whether to reverse button order | If true, applies `_reverse()` to result.       |
| obj       | object  | yes      | Object with language keys       | Structure is `{ en: "...", id: "...", ... }`.  |

- **returns: string | object**
- **ai_notes:** Returns string if `lang` provided, object otherwise.

```typescript
const keyboards = {
  en: "Back, Next",
  id: "Kembali, Lanjut",
};

// Get specific language
DataKeyboard._build("en", false, keyboards);
// => "Back, Next"

// Get specific language reversed
DataKeyboard._build("en", true, keyboards);
// => "Next, Back"

// Get all languages
DataKeyboard._build(undefined, false, keyboards);
// => { en: "Back, Next", id: "Kembali, Lanjut" }
```

&nbsp;

## Usage

Extend `DataKeyboard` to define reusable keyboard configurations:

```typescript
import { DataKeyboard } from "gramstax";

export class KeyboardData extends DataKeyboard {
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

#### Implementation Details (packages/gramstax/src/data/keyboard.ts)

- `_reverse()` splits with `/((?<!\\), *)/` so escaped commas are preserved.
- `_build()` returns a string for a specific language or an object for all languages.

## Worker Thread

### WorkerThreadExport

Source: `docs/api/worker-thread/export.md`

> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter  | type   | required | description                    | ai_notes                       |
| ---------- | ------ | -------- | ------------------------------ | ------------------------------ |
| serverPath | string | no       | Path to the target worker file | Must match target init `path`. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type | required | description  | ai_notes                |
| --------- | ---- | -------- | ------------ | ----------------------- |
| payload   | any  | yes      | Data to send | Payload to main thread. |

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

| parameter  | type   | required | description                 | ai_notes                |
| ---------- | ------ | -------- | --------------------------- | ----------------------- |
| serverPath | string | yes      | Unix socket path to connect | Matches server gateway. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type   | required | description                 | ai_notes                                       |
| --------- | ------ | -------- | --------------------------- | ---------------------------------------------- |
| path      | string | yes      | Path to the worker file     | **Must be:** valid JavaScript/TypeScript file. |
| argv      | any[]  | yes      | Arguments to pass to worker | **Accessible:** via `process.argv` in worker.  |

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

| parameter | type | required | description  | ai_notes               |
| --------- | ---- | -------- | ------------ | ---------------------- |
| payload   | any  | yes      | Data to send | Sent to worker thread. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type                 | required | description              |
| --------- | -------------------- | -------- | ------------------------ |
| instances | WorkerThreadLaunch[] | yes      | Initial worker instances |

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

| parameter | type               | required | description   | ai_notes               |
| --------- | ------------------ | -------- | ------------- | ---------------------- |
| instance  | WorkerThreadLaunch | yes      | Worker to add | Registers by threadId. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
const newWorker = new WorkerThreadLaunch("./worker.ts", ["3"]);
await newWorker.ready();
pool.add(newWorker);
```

### `.addMany(instances)`

Add multiple workers to the pool.

| parameter | type                 | required | description    | ai_notes               |
| --------- | -------------------- | -------- | -------------- | ---------------------- |
| instances | WorkerThreadLaunch[] | yes      | Workers to add | Registers all workers. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
pool.addMany([worker4, worker5]);
```

### `.getInstance(threadId)`

Get a specific worker by thread ID.

| parameter | type   | required | description      | ai_notes                 |
| --------- | ------ | -------- | ---------------- | ------------------------ |
| threadId  | number | yes      | Worker thread ID | Lookup in pool registry. |

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

| parameter | type   | required | description      | ai_notes           |
| --------- | ------ | -------- | ---------------- | ------------------ |
| threadId  | number | yes      | Worker thread ID | Terminates worker. |

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

| parameter | type   | required | description         | ai_notes                  |
| --------- | ------ | -------- | ------------------- | ------------------------- |
| method    | string | yes      | Method name to call | Invoked on every worker.  |
| params    | any    | yes      | Method parameters   | Sent as positional array. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type     | required | description                  | ai_notes                 |
| --------- | -------- | -------- | ---------------------------- | ------------------------ |
| send      | function | yes      | Function to send data        | Called with RPC payload. |
| register  | object   | yes      | Object with callable methods | Exposed RPC method map.  |

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

| parameter | type   | required | description        | ai_notes                       |
| --------- | ------ | -------- | ------------------ | ------------------------------ |
| data      | object | yes      | RPC message object | Shape is request/result/error. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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

| parameter | type   | required | description      | ai_notes                |
| --------- | ------ | -------- | ---------------- | ----------------------- |
| path      | string | yes      | Unix socket path | Matches server gateway. |

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
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

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
- `export * from "./components/keyboard"`
- `export * from "./data/keyboard"`
- `export * from "./worker-thread/export"`
- `export * from "./worker-thread/gateway-client"`
- `export * from "./worker-thread/gateway-server"`
- `export * from "./worker-thread/init"`
- `export * from "./worker-thread/launch"`
- `export * from "./worker-thread/pool"`
- `export * from "./worker-thread/rpc"`
