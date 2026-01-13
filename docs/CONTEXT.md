# Gramstax Framework API Context

> **Documentation Info**
>
> - **Last Updated:** Sunday, January 11, 2026 at 20:53:59 PM (UTC+07:00)
> - **Framework Version:** v0.3.17
> - **Status:** Full API Context

This document contains the COMPLETE API documentation for the Gramstax framework.

---

# Core

## Gramstax

_(Source: docs/api/core/bot.md)_

The `Gramstax` class is the main bot framework class that handles initialization, routing, and lifecycle management for Telegram bots.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Gramstax` main class for bot initialization.
> - **Extends:** Uses grammY under the hood for Telegram API.
> - **Deploy modes:** polling, webhook, serverless.
> - **Routing:** Automatic page-based routing with session support.

&nbsp;

### Constructor

#### `new Gramstax(params)`

| parameter                            | type               | required | default     | description                | ai_notes                                                              |
| ------------------------------------ | ------------------ | -------- | ----------- | -------------------------- | --------------------------------------------------------------------- |
| params.token                         | string             | yes      | -           | Telegram bot token         | **Obtained from:** @BotFather.                                        |
| params.deploy                        | string             | yes      | -           | Deployment mode            | **Values:** `"polling"`, `"webhook:<url>"`, `"serverless:<adapter>"`. |
| params.log                           | LoggingPretty/bool | no       | -           | Logger instance or boolean | **If true:** creates new LoggingPretty.                               |
| params.cacheSession                  | CacheExternal      | no       | memory      | Session cache adapter      | **Default:** in-memory cache.                                         |
| params.cacheKeyboard                 | Map                | no       | `new Map()` | Keyboard cache             | **Purpose:** cache keyboard layouts.                                  |
| params.templateManager               | TemplateManager    | no       | auto        | Template manager instance  | **Default:** loads from `src/pages`.                                  |
| params.optionsPage.shortCallbackData | boolean            | no       | `false`     | Use short callback data    | **If true:** uses index numbers instead of page names.                |

```typescript
import { Gramstax } from "gramstax";

const bot = new Gramstax({
  token: "YOUR_BOT_TOKEN",
  deploy: "polling",
  log: true,
  optionsPage: {
    shortCallbackData: true,
  },
});
```

&nbsp;

### Deploy Modes

#### Polling

Long-polling mode for development.

```typescript
new Gramstax({
  token: "TOKEN",
  deploy: "polling",
});
```

#### Webhook

Webhook mode for production with Bun.

```typescript
new Gramstax({
  token: "TOKEN",
  deploy: "webhook:https://example.com/webhook",
});
```

#### Serverless

Serverless mode for platforms like Vercel, Cloudflare Workers.

```typescript
new Gramstax({
  token: "TOKEN",
  deploy: "serverless:bun",
});

// Access handler for serverless
export const handler = bot.handlerBotUpdate;
```

&nbsp;

### Properties

#### `.bot`

The underlying grammY Bot instance.

- **type: Bot**

#### `.pages`

Loaded page registry with routing maps.

- **type: object**

#### `.templateManager`

Template manager instance.

- **type: TemplateManager**

#### `.cacheSession`

Session cache adapter.

- **type: CacheExternal**

#### `.cacheKeyboard`

Keyboard cache.

- **type: Map**

#### `.log`

Logger instance.

- **type: LoggingPretty | undefined**

#### `.handlerBotUpdate`

Update handler for serverless deployments.

- **type: function**

&nbsp;

### Lifecycle Hooks

Override these methods in subclass to customize behavior.

#### `.hookBeforeStart()`

Called before bot starts.

```typescript
class MyBot extends Gramstax {
  hookBeforeStart() {
    console.log("Bot is about to start");
  }
}
```

#### `.hookAfterStart()`

Called after bot starts successfully.

```typescript
class MyBot extends Gramstax {
  hookAfterStart() {
    console.log("Bot started successfully");
  }
}
```

#### `.hookBeforeRoute(ctx, listenerName)`

Called before routing each update. Return `false` to skip routing.

| parameter    | type   | description      |
| ------------ | ------ | ---------------- |
| ctx          | Ctx    | Context instance |
| listenerName | string | Event type       |

- **returns: Promise\<boolean\>**

```typescript
class MyBot extends Gramstax {
  async hookBeforeRoute(ctx, listenerName) {
    // Ban check
    if (await isBanned(ctx.userId)) {
      return false;
    }
    return true;
  }
}
```

#### `.hookErrorPage(ctx, listenerName, error, isEdit)`

Called when page throws an error.

| parameter    | type    | description           |
| ------------ | ------- | --------------------- |
| ctx          | Ctx     | Context instance      |
| listenerName | string  | Event type            |
| error        | any     | The error             |
| isEdit       | boolean | Was it an edit action |

```typescript
class MyBot extends Gramstax {
  async hookErrorPage(ctx, listenerName, error, isEdit) {
    console.error(`Error in ${listenerName}:`, error);
    await ctx.reply(undefined, { message: "An error occurred" });
  }
}
```

#### `.hookErrorInputNotFoundPage(ctx)`

Called when no matching route found.

```typescript
class MyBot extends Gramstax {
  async hookErrorInputNotFoundPage(ctx) {
    await ctx.reply(undefined, { message: "Unknown command" });
  }
}
```

&nbsp;

### Routing Priority

Routes are matched in this order:

1. **staticSession** - Session-based routing (if session exists and entity has no own route)
2. **static** - Exact match (e.g., `/start`, `help`)
3. **staticIntent** - Payload match (e.g., `/start payload`, `callback:data`)
4. **dynamicSpecific** - Type-specific free routes (e.g., `textFree`, `photoFree`)
5. **dynamic** - Generic `free()` method

&nbsp;

### Complete Example

```typescript
import { Gramstax, Ctx, CacheExternal } from "gramstax";

class MyBot extends Gramstax<Ctx> {
  hookBeforeStart() {
    this.log?.info("Initializing...");
  }

  hookAfterStart() {
    this.log?.success("Bot is ready!");
  }

  async hookBeforeRoute(ctx: Ctx, listenerName: string) {
    // Log all incoming updates
    this.log?.debug(`[${listenerName}] ${ctx.userId}`);
    return true;
  }

  async hookErrorPage(ctx: Ctx, listenerName: string, error: any) {
    this.log?.error(`Error: ${error.message}`);
    await ctx.reply(undefined, { message: "Sorry, something went wrong." });
  }
}

new MyBot({
  token: process.env.BOT_TOKEN!,
  deploy: "polling",
  log: true,
  cacheSession: new CacheExternal("redis://localhost:6379", "session"),
});
```

---

## Ctx

_(Source: docs/api/core/ctx.md)_

The `Ctx` class is the context/page base class that provides access to user data, session management, template rendering, and reply methods.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Ctx` base class for pages.
> - **Usage:** Extend this class to create page handlers.
> - **Template:** Define static `template` property for HTML-like templates.
> - **Data:** Define static `data` via `buildData()` for routing configuration.

&nbsp;

### Static Properties

#### `.template`

HTML-like template string for the page.

- **type: string | undefined**

```typescript
class MyPage extends Ctx {
  static template = `
    <base>
      <keyboard>Button 1, Button 2</keyboard>
      <message>Hello {{name}}!</message>
    </base>
  `;
}
```

#### `.data`

Page routing data created by `buildData()`.

- **type: IPageData**

&nbsp;

### Static Methods

#### `.buildData(callbackData?)`

Create page data configuration.

| parameter    | type     | required | description                             |
| ------------ | -------- | -------- | --------------------------------------- |
| callbackData | function | no       | Function returning callback data string |

- **returns: IPageData**

```typescript
class MyPage extends Ctx {
  // Simple - uses page name as callback data
  static data = this.buildData();

  // With payload function
  static data = this.buildData((id: string) => id);

  // Custom callback data
  static data = this.buildData({
    callbackData: (action: string) => `custom-${action}`,
    textCommand: "mycommand",
  });
}
```

&nbsp;

### User Properties

#### `.userId`

Get current user's Telegram ID.

- **type: number**

#### `.userName`

Get current user's username.

- **type: string | undefined**

#### `.userFirstName`

Get current user's first name.

- **type: string**

#### `.userLastName`

Get current user's last name.

- **type: string | undefined**

#### `.userFullName`

Get current user's full name.

- **type: string**

#### `.userLanguage`

Get or set current user's language code.

- **type: string**

#### `.userIsPremium`

Check if user has Telegram Premium.

- **type: boolean**

#### `.userIsBot`

Check if user is a bot.

- **type: boolean**

&nbsp;

### Message Properties

#### `.msgText`

Get message text.

- **type: string | undefined**

#### `.msgTextPayload`

Get first payload from text message.

- **type: string | undefined**

#### `.msgTextPayloads`

Get all payloads from text message.

- **type: string[]**

#### `.msgCaption`

Get message caption.

- **type: string | undefined**

#### `.msgPhoto`

Get photo message data.

- **type: PhotoSize[] | undefined**

#### `.msgVideo`

Get video message data.

- **type: Video | undefined**

#### `.msgAudio`

Get audio message data.

- **type: Audio | undefined**

&nbsp;

### Callback Properties

#### `.callbackData`

Get callback query data.

- **type: string | undefined**

#### `.callbackDataPayload`

Get first payload from callback data.

- **type: string | undefined**

#### `.callbackDataPayloads`

Get all payloads from callback data.

- **type: string[]**

#### `.callbackDataParts`

Get all parts split by colon.

- **type: string[]**

&nbsp;

### Session Methods

#### `.sessionGet()`

Get current session data.

- **returns: Promise\<{ method: string; params: any } | undefined\>**

#### `.sessionSet(method, params)`

Set session data.

| parameter | type   | required | description        |
| --------- | ------ | -------- | ------------------ |
| method    | string | yes      | Session method     |
| params    | any    | no       | Session parameters |

- **returns: Promise\<boolean\>**

#### `.sessionClear()`

Clear current session.

- **returns: Promise\<boolean\>**

#### `.sessionCallback(params?, name?)`

Set session for callback route.

#### `.sessionCallbackPayload(params?, name?)`

Set session for callbackPayload route.

#### `.sessionText(params?, name?)`

Set session for text route.

#### `.sessionTextPayload(params?, name?)`

Set session for textPayload route.

#### `.sessionTextFree(params?, name?)`

Set session for textFree route.

&nbsp;

### Reply Methods

#### `.reply(keyboard?, data?, baseId?, options?)`

Send a text message reply.

| parameter | type    | required | default     | description         |
| --------- | ------- | -------- | ----------- | ------------------- |
| keyboard  | IInBoKb | no       | -           | Keyboard markup     |
| data      | object  | no       | -           | Template data       |
| baseId    | string  | no       | `"default"` | Template base ID    |
| options   | object  | no       | -           | grammY send options |

- **returns: Promise\<Message\>**

```typescript
await this.reply(this.kb(), { name: "John" });
```

#### `.replyPhoto(keyboard?, data?, baseId?, options?)`

Send a photo message.

#### `.replyVideo(keyboard?, data?, baseId?, options?)`

Send a video message.

#### `.replyAudio(keyboard?, data?, baseId?, options?)`

Send an audio message.

#### `.replyDocument(keyboard?, data?, baseId?, options?)`

Send a document message.

#### `.replyAnimation(keyboard?, data?, baseId?, options?)`

Send an animation/GIF.

#### `.replyVoice(keyboard?, data?, baseId?, options?)`

Send a voice message.

#### `.replyVideoNote(keyboard?, data?, baseId?, options?)`

Send a video note.

#### `.replySticker(keyboard?, data?, baseId?, options?)`

Send a sticker.

#### `.replyLocation(keyboard?, data?, baseId?, options?)`

Send a location.

#### `.replyContact(keyboard?, data?, baseId?, options?)`

Send a contact.

&nbsp;

### Edit Methods

#### `.edit(keyboard?, data?, baseId?, options?)`

Edit the current message text.

#### `.editPhoto(keyboard?, data?, baseId?, options?)`

Edit media to photo.

#### `.editVideo(keyboard?, data?, baseId?, options?)`

Edit media to video.

#### `.editAudio(keyboard?, data?, baseId?, options?)`

Edit media to audio.

#### `.editDocument(keyboard?, data?, baseId?, options?)`

Edit media to document.

#### `.editAnimation(keyboard?, data?, baseId?, options?)`

Edit media to animation.

&nbsp;

### Other Methods

#### `.delete()`

Delete the current message.

- **returns: Promise\<boolean\>**

#### `.sleep(ms)`

Wait for specified milliseconds.

| parameter | type   | required | description  |
| --------- | ------ | -------- | ------------ |
| ms        | number | yes      | Milliseconds |

- **returns: Promise\<void\>**

#### `.callbackQueryAnswer(text?, options?)`

Answer callback query (show toast).

| parameter | type   | required | description    |
| --------- | ------ | -------- | -------------- |
| text      | string | no       | Toast text     |
| options   | object | no       | Answer options |

#### `.inlineKeyboard(builder)`

Create inline keyboard using builder pattern.

| parameter | type     | required | description      |
| --------- | -------- | -------- | ---------------- |
| builder   | function | yes      | Builder callback |

- **returns: InlineKeyboard**

```typescript
const kb = this.inlineKeyboard((kb, arr) => {
  return kb //
    .text(arr[0], "action1")
    .text(arr[1], "action2")
    .row()
    .text(arr[2], "action3");
});
```

#### `.bkb(builder) or .bottomKeyboard(builder)`

Create reply keyboard using builder pattern.

| parameter | type     | required | description      |
| --------- | -------- | -------- | ---------------- |
| builder   | function | yes      | Builder callback |

- **returns: BottomKeyboard**

```typescript
const kb = this.bkb((kb, arr) => {
  return kb //
    .text(arr[0])
    .text(arr[1])
    .row()
    .text(arr[2])
    .oneTime();
});
```

#### `.transition(PageClass, method?, data?)`

Transition to another page.

| parameter | type   | required | description       |
| --------- | ------ | -------- | ----------------- |
| PageClass | class  | yes      | Target page class |
| method    | string | no       | Method to call    |
| data      | any    | no       | Data to pass      |

```typescript
await this.transition(HomePage, "callback", { refresh: true });
```

&nbsp;

### Route Methods

Define these methods in your page class to handle specific routes:

| Method                 | Trigger                         |
| ---------------------- | ------------------------------- |
| `callback()`           | Exact callback data match       |
| `callbackPayload()`    | Callback with payload           |
| `text()`               | Exact text match                |
| `textPayload()`        | Text with payload               |
| `textCommand()`        | Command match                   |
| `textCommandPayload()` | Command with payload            |
| `textFree()`           | Any text (with session or not)  |
| `photoFree()`          | Any photo (with session or not) |
| `free()`               | Fallback for any unmatched      |

&nbsp;

### Complete Example

```typescript
import { Ctx } from "gramstax";
import { OtherPage } from "./other";

export class MyPage extends Ctx {
  static data = this.buildData((action: string) => action);

  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb
        .text(arr[0], this.data.callbackData("confirm"))
        .text(arr[1], this.data.callbackData("cancel"));
    });
  }

  async textCommand() {
    await this.reply(this.kb(), { name: this.userFirstName });
  }

  async callbackPayload() {
    const action = this.callbackDataPayload;

    if (action === "confirm") {
      await this.edit(undefined, { message: "Confirmed!" });
    } else {
      await this.transition(OtherPage, "callback");
    }
  }

  static template = `
    <base>
      <keyboard>Confirm, Cancel</keyboard>
      <message>Hello {{name}}, please choose:</message>
    </base>
  `;
}
```

---

# Page System

## PageManager

_(Source: docs/api/page/manager.md)_

The `PageManager` class provides static utilities for loading and managing page modules dynamically.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `PageManager` static methods for page loading.
> - **Usage:** Used internally by `Gramstax` to load page classes from the `src/pages` directory.
> - **Module format:** Pages must export a class (not default export) that extends `Ctx`.

&nbsp;

### Static Methods

#### `.getFilePath()`

Returns the default pages directory path.

- **returns: string**
- **ai_notes:** Returns `join(process.cwd(), 'src', 'pages')`.

```typescript
import { PageManager } from "gramstax";

const pagesPath = PageManager.getFilePath();
// => "/path/to/project/src/pages"
```

#### `.getFileSync(path?, positionModule?)`

Synchronously load a single page module.

| parameter      | type   | required | default         | description                 | ai_notes                                      |
| -------------- | ------ | -------- | --------------- | --------------------------- | --------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the page file       | **If omitted:** uses default pages directory. |
| positionModule | number | no       | `0`             | Index of the exported class | **Purpose:** when file has multiple exports.  |

- **returns: typeof Ctx**
- **throws:** Error if file has no exports.

```typescript
const StartPage = PageManager.getFileSync(
  "/path/to/project/src/pages/start.ts"
);
```

#### `.getFile(path?, positionModule?)`

Asynchronously load a single page module with cache busting.

| parameter      | type   | required | default         | description                 | ai_notes                                        |
| -------------- | ------ | -------- | --------------- | --------------------------- | ----------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the page file       | **If omitted:** uses default pages directory.   |
| positionModule | number | no       | `0`             | Index of the exported class | **Cache busting:** appends timestamp to import. |

- **returns: Promise\<typeof Ctx\>**

```typescript
const StartPage = await PageManager.getFile(
  "/path/to/project/src/pages/start.ts"
);
```

#### `.getFileManySync(path?, positionModule?)`

Synchronously load all page modules from a directory.

| parameter      | type   | required | default         | description                 | ai_notes                                       |
| -------------- | ------ | -------- | --------------- | --------------------------- | ---------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the pages directory | **If omitted:** uses default pages directory.  |
| positionModule | number | no       | `0`             | Index of the exported class | **Purpose:** when files have multiple exports. |

- **returns: Array\<{ path: string; page: typeof Ctx }\>**
- **throws:** Error if directory does not exist.

```typescript
const pages = PageManager.getFileManySync();
// => [{ path: "/path/to/start.ts", page: StartPage }, ...]
```

#### `.clearCacheRequire(path?)`

Clear the require cache for all page modules.

| parameter | type   | required | default         | description                 | ai_notes                                    |
| --------- | ------ | -------- | --------------- | --------------------------- | ------------------------------------------- |
| path      | string | no       | `getFilePath()` | Path to the pages directory | **Purpose:** enable hot-reloading of pages. |

- **returns: boolean**
- **throws:** Error if directory does not exist.

```typescript
PageManager.clearCacheRequire();
```

---

# Template System

## TemplateEngine

_(Source: docs/api/template/engine.md)_

The `TemplateEngine` class provides static methods for parsing and compiling HTML-like templates into executable functions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateEngine` static methods for template parsing.
> - **Internal:** Typically used internally by `TemplateManager`.
> - **Format:** Parses HTML-like syntax with custom blocks.

&nbsp;

### Template Syntax

#### Base Block

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

#### Message Block

Text content with variable interpolation.

```html
<message>Hello {{name}}!</message>

<message lang="id">Halo {{name}}!</message>
```

#### Keyboard Block

Comma-separated button labels.

```html
<keyboard>Yes, No</keyboard>
<keyboard type="bottom">Button 1, Button 2</keyboard>
<keyboard lang="id">Ya, Tidak</keyboard>
```

#### Description Block

Bot command descriptions for Telegram menu.

```html
<description>Start the bot</description>
<description lang="id">Mulai bot</description>
<description scope="chat_administrators">Admin command</description>
```

#### Media Blocks

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

#### Control Blocks

##### Switch Block

Conditional rendering.

```html
<switch value="{{status}}">
  <case is="active">Active status</case>
  <case is="pending">Pending status</case>
  <default>Unknown status</default>
</switch>
```

##### Map Block

Loop over arrays.

```html
<map for="item" in="{{items}}"> - {{item.name}}: {{item.value}} </map>
```

##### Import Block

Import from another template.

```html
<import src="other-page" base="kb-section" />
```

##### Space Block

Preserve whitespace.

```html
<space>Line 1 Line 2</space>
```

##### Div Block

Text container.

```html
<div>Content here</div>
```

&nbsp;

### Static Methods

#### `.compileMessages(template, baseBlocks?)`

Compile message blocks from template.

| parameter  | type   | required | description            |
| ---------- | ------ | -------- | ---------------------- |
| template   | string | yes      | Raw template string    |
| baseBlocks | object | no       | Pre-parsed base blocks |

- **returns: object** - `{ [baseId]: { [lang]: (data) => string } }`

#### `.compileKeyboards(template, baseBlocks?)`

Compile keyboard blocks from template.

| parameter  | type   | required | description            |
| ---------- | ------ | -------- | ---------------------- |
| template   | string | yes      | Raw template string    |
| baseBlocks | object | no       | Pre-parsed base blocks |

- **returns: object** - `{ [baseId]: { [lang]: { inline, bottom } } }`

#### `.compileMedia(template, baseBlocks?)`

Compile media blocks from template.

| parameter  | type   | required | description            |
| ---------- | ------ | -------- | ---------------------- |
| template   | string | yes      | Raw template string    |
| baseBlocks | object | no       | Pre-parsed base blocks |

- **returns: object** - `{ [baseId]: { [lang]: (data) => IMediaBlock } }`

#### `.compileDescription(template, baseBlocks?)`

Compile description blocks from template.

| parameter  | type   | required | description            |
| ---------- | ------ | -------- | ---------------------- |
| template   | string | yes      | Raw template string    |
| baseBlocks | object | no       | Pre-parsed base blocks |

- **returns: object** - `{ [baseId]: { [scope]: { [lang]: (data) => string } } }`

#### `.processImportBlocks(template, resolver, depth?, importCache?)`

Process import blocks recursively.

| parameter   | type     | required | default | description                 |
| ----------- | -------- | -------- | ------- | --------------------------- |
| template    | string   | yes      | -       | Template with imports       |
| resolver    | function | yes      | -       | Function to resolve imports |
| depth       | number   | no       | 0       | Current recursion depth     |
| importCache | Map      | no       | -       | Cache for resolved imports  |

- **returns: string** - Template with imports resolved.

&nbsp;

### Variable Interpolation

Variables use double curly braces:

```html
<message>Hello {{name}}, you have {{count}} items. </message>
```

Supports nested properties:

```html
<message>User: {{user.name}}, Email: {{user.email}}</message>
```

&nbsp;

### Complete Example

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

---

## TemplateManager

_(Source: docs/api/template/manager.md)_

The `TemplateManager` class manages template loading, compilation, caching, and hot-reloading from page files.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateManager` for template management.
> - **Hot-reload:** Supports file watching for development.
> - **Sources:** Templates from static `template` property or `.tpl` files.

&nbsp;

### Constructor

#### `new TemplateManager(options)`

| parameter            | type     | required | default | description             | ai_notes                                     |
| -------------------- | -------- | -------- | ------- | ----------------------- | -------------------------------------------- |
| options.path         | string[] | yes      | -       | Paths to scan for pages | **Typically:** `["src/pages"]`.              |
| options.enableWatch  | boolean  | no       | `false` | Enable file watching    | **For development:** auto-reload on changes. |
| options.watchOptions | object   | no       | -       | Chokidar watch options  | **Passed to:** chokidar watcher.             |

```typescript
import { TemplateManager } from "gramstax";

const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: process.env.NODE_ENV === "development",
});
```

&nbsp;

### Template Sources

Templates can come from:

#### 1. Static Template Property

```typescript
class MyPage extends Ctx {
  static template = `
    <base>
      <message>Hello World</message>
    </base>
  `;
}
```

#### 2. External .tpl File

Create `my-page.tpl` alongside `my-page.ts`:

```html
<base>
  <message>Hello World</message>
</base>
```

&nbsp;

### Methods

#### `.getMessage(key, baseId?, language?, data?)`

Get compiled message string.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| data      | object | no       | -           | Template variables   |

- **returns: string**

#### `.getKeyboard(key, baseId?, language?, type?, data?)`

Get compiled keyboard labels.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| type      | string | no       | `"inline"`  | Keyboard type        |
| data      | object | no       | -           | Template variables   |

- **returns: string[]**

#### `.getMedia(key, baseId?, language?, data?)`

Get compiled media data.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| data      | object | no       | -           | Template variables   |

- **returns: IMediaBlock | undefined**

#### `.getDescription(key, baseId?, language?, scope?, data?)`

Get command description for Telegram menu.

| parameter | type   | required | default     | description          |
| --------- | ------ | -------- | ----------- | -------------------- |
| key       | string | yes      | -           | Page name (filename) |
| baseId    | string | no       | `"default"` | Base block ID        |
| language  | string | no       | `"default"` | Language code        |
| scope     | string | no       | `"default"` | Bot command scope    |
| data      | object | no       | -           | Template variables   |

- **returns: string**

#### `.has(key)`

Check if template exists.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| key       | string | yes      | Page name   |

- **returns: boolean**

#### `.destroy()`

Cleanup resources and close watchers.

- **returns: Promise\<void\>**

&nbsp;

### In-Depth Example

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
```

---

# Components & Data

## ComponentKeyboard

_(Source: docs/api/components/keyboard.md)_

The `ComponentKeyboard` class provides static methods for generating keyboard template blocks from `DataKeyboard` definitions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Connects `DataKeyboard` structured data to HTML templates.
> - **Usage:** Use `getTemplate()` methods to inject dynamic keyboards into templates.

&nbsp;

### Static Methods

#### `.getTemplateBottom(data)`

Generate a `<keyboard type="bottom">` template string.

| parameter | type         | required | description                                             |
| --------- | ------------ | -------- | ------------------------------------------------------- |
| data      | DataKeyboard | yes      | Instance or subclass of DataKeyboard containing buttons |

- **returns: string** - `<keyboard type="bottom">Btn1, Btn2</keyboard>`

```typescript
// definition
class MyKeyboard extends DataKeyboard {
  static btn1 = "Button 1";
  static btn2 = "Button 2";
  static list = [this.btn1, this.btn2];
}

// usage in template
const tpl = `
  <base>
    ${ComponentKeyboard.getTemplateBottom(MyKeyboard)}
    <message>Choose an option</message>
  </base>
`;
```

#### `.getTemplateInline(data)`

Generate a `<keyboard>` (inline) template string.

| parameter | type         | required | description                                             |
| --------- | ------------ | -------- | ------------------------------------------------------- |
| data      | DataKeyboard | yes      | Instance or subclass of DataKeyboard containing buttons |

- **returns: string** - `<keyboard>Btn1, Btn2</keyboard>`

---

## DataKeyboard

_(Source: docs/api/data/keyboard.md)_

The `DataKeyboard` class provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order (RTL support etc).

&nbsp;

### Static Methods

#### `.reverse(src)`

Reverses the order of comma-separated button labels.

| parameter | type   | required | description            |
| --------- | ------ | -------- | ---------------------- |
| src       | string | yes      | Comma-separated labels |

- **returns: string**

```typescript
DataKeyboard.reverse("A, B, C"); // "C, B, A"
```

#### `.reverseArr(arr)`

Reverses an array of strings (helper).

- **returns: string[]**

---

# Utils

## LoggingUtils

_(Source: docs/api/utils/log.md)_

The `LoggingUtils` class extends [LoggingPretty](https://www.npmjs.com/package/logging-pretty) to provide enhanced logging functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Standard logger for Gramstax.
> - **Extends:** `logging-pretty`.

&nbsp;

### Static Properties

#### `log`

Exported singleton instance.

- **type: LoggingUtils**

### Methods

#### `.errorMake(error, constructorName?, funcName?)`

Log formatted error with context.

| parameter       | type   | required | description         |
| --------------- | ------ | -------- | ------------------- |
| error           | any    | yes      | Error object        |
| constructorName | string | no       | Class name context  |
| funcName        | string | no       | Method name context |

```typescript
try {
  // code
} catch (e) {
  log.errorMake(e, "MyClass", "myMethod");
}
```

---

# Cache

## CacheExternal

_(Source: docs/api/cache/external.md)_

The `CacheExternal` class extends [Keyv](https://github.com/jaredwray/keyv) to provide a unified caching interface with built-in support for memory and Redis storage.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Unified cache interface.
> - **Backends:** Memory (default), Redis.
> - **Usage:** Used for session and keyboard caching.

&nbsp;

### Constructor

#### `new CacheExternal(url?, namespace?)`

| parameter | type   | required | default     | description          | ai_notes                              |
| --------- | ------ | -------- | ----------- | -------------------- | ------------------------------------- |
| url       | string | no       | undefined   | Connection URL       | **Prefix `redis://`** enables Redis.  |
| namespace | string | no       | `"default"` | Key namespace prefix | **Separation:** distinct cache areas. |

```typescript
// Memory
const memCache = new CacheExternal();

// Redis
const redisCache = new CacheExternal("redis://localhost:6379", "sessions");
```

&nbsp;

### Methods

#### `.get(key)`

Get value by key.

- **returns: Promise\<any\>**

#### `.set(key, value, ttl?)`

Set value with optional TTL.

| parameter | type   | required | description       |
| --------- | ------ | -------- | ----------------- |
| key       | string | yes      | Cache key         |
| value     | any    | yes      | Value to store    |
| ttl       | number | no       | Time to live (ms) |

- **returns: Promise\<boolean\>**

#### `.delete(key)`

Delete value by key.

- **returns: Promise\<boolean\>**

#### `.clear()`

Clear all keys in namespace.

- **returns: Promise\<void\>**

---

# Worker Thread System

## WorkerThreadExport

_(Source: docs/api/worker-thread/export.md)_

The `WorkerThreadExport` class provides a unified interface for creating and managing worker threads with automatic RPC proxying.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Entry point for worker system in `index.ts`.
> - **Role:** Abstracts Main Thread vs Worker Thread logic.
> - **Proxy:** Auto-exposes worker methods to main thread.

&nbsp;

### Methods

#### `.init(options)`

Initialize the worker system.

| parameter           | type                 | required | description              | ai_notes                              |
| ------------------- | -------------------- | -------- | ------------------------ | ------------------------------------- |
| options.workers     | WorkerThreadLaunch[] | yes      | List of worker instances | **Instantiated:** `new MyWorker()`.   |
| options.onReady     | function             | no       | Callback when ready      | **Trigger:** all workers initialized. |
| options.autoRestart | boolean              | no       | Auto-restart workers     | **Default:** false.                   |

- **returns: Promise\<void\>**

```typescript
// index.ts
import { WorkerThreadExport } from "gramstax";
import { MyWorker } from "./workers/my-worker";

const exportWorker = new WorkerThreadExport();
const myWorker = new MyWorker(); // extends WorkerThreadLaunch

await exportWorker.init({
  workers: [myWorker],
  onReady: () => console.log("System ready"),
});

// RPC Call
await myWorker.rpc.someMethod();
```

#### `.launchGatewayClient(serverPath?)`

Create a typed gateway proxy for inter-worker communication.

| parameter  | type   | required | description |
| ---------- | ------ | -------- | ----------- |
| serverPath | string | no       | Socket path |

- **returns: Proxy\<T\>**

---

## WorkerThreadInit

_(Source: docs/api/worker-thread/init.md)_

The `WorkerThreadInit` class is the base class for worker thread implementations (the code running INSIDE the worker).

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Base class for worker logic.
> - **Extends:** `WorkerThreadRpc` (implicitly via composition or inheritance structure).
> - **Usage:** Extend this class in your worker file.

&nbsp;

### Lifecycle Methods

#### `.start()`

Entry point for the worker. Must be called at the end of the file.

```typescript
// worker.ts
class MyWorker extends WorkerThreadInit {
  // implementations
}

new MyWorker().start();
```

### RPC Methods

Methods defined in this class (prefixed with `mtd`) are automatically exposed to the main thread via RPC.

```typescript
class MyWorker extends WorkerThreadInit {
  async mtdHello(name: string) {
    return `Hello ${name} from worker`;
  }
}
```

### Properties

#### `.parent`

MessagePort to the main thread.

- **type: MessagePort**

---

## WorkerThreadLaunch

_(Source: docs/api/worker-thread/launch.md)_

The `WorkerThreadLaunch` class manages worker thread lifecycle from the main thread side.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** representation of a worker in the Main Thread.
> - **Role:** Spawns `Worker`, handles signals, manages RPC proxy.

&nbsp;

### Properties

#### `.path`

Path to the worker script (absolute).

- **type: string**
- **required:** yes (abstract)

#### `.rpc`

Typed RPC proxy to call methods on the worker.

- **type: Proxy\<WorkerThreadInit\>**

### Methods

#### `.launch()`

Start the worker thread.

- **returns: Promise\<void\>**

#### `.kill()`

Terminate the worker thread.

- **returns: Promise\<void\>**

#### `.ready()`

Wait until worker signals it is ready.

- **returns: Promise\<void\>**

#### `.restart()`

Kill and restart the worker.

- **returns: Promise\<void\>**

### Graceful Shutdown

Automatically handles `SIGINT` and `SIGTERM` to kill workers before exit.

```typescript
// main.ts
class MyWorkerLaunch extends WorkerThreadLaunch {
  path = join(__dirname, "./worker.js");
}

const worker = new MyWorkerLaunch();
// worker.launch() is called by WorkerThreadExport.init()
```

---

## WorkerThreadPool

_(Source: docs/api/worker-thread/pool.md)_

The `WorkerThreadPool` class manages a collection of `WorkerThreadLaunch` instances.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Manager for multiple worker instances.
> - **Role:** Aggregates workers, handles broadcast, lookup.

&nbsp;

### Methods

#### `.add(worker)`

Add a worker to the pool.

| parameter | type               | required | description     |
| --------- | ------------------ | -------- | --------------- |
| worker    | WorkerThreadLaunch | yes      | Worker instance |

#### `.get(name)`

Get a worker by its class name.

| parameter | type   | required | description              |
| --------- | ------ | -------- | ------------------------ |
| name      | string | yes      | Class name of the worker |

- **returns: WorkerThreadLaunch | undefined**

#### `.getAll()`

Get all workers.

- **returns: WorkerThreadLaunch[]**

#### `.killAll()`

Terminate all workers in the pool.

- **returns: Promise\<void[]\>**

#### `.broadcast(method, args)`

Call a method on ALL workers via RPC.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| method    | string | yes      | Method name |
| args      | any[]  | no       | Arguments   |

- **returns: Promise\<any[]\>**

---

## WorkerThreadRpc

_(Source: docs/api/worker-thread/rpc.md)_

The `WorkerThreadRpc` class handles JSON-RPC style communication between threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Low-level RPC implementation.
> - **Protocol:** JSON-RPC 2.0 style `{ id, method, params }`.
> - **Usage:** Internal base for Init and Launch classes.

&nbsp;

### Methods

#### `.rpcResolve(id, data)`

Resolve a pending RPC request.

#### `.rpcReject(id, error)`

Reject a pending RPC request.

#### `.rpcRequest(target, method, params)`

Send an RPC request.

| parameter | type        | required | description |
| --------- | ----------- | -------- | ----------- |
| target    | MessagePort | yes      | Target port |
| method    | string      | yes      | Method name |
| params    | any         | no       | Parameters  |

- **returns: Promise\<any\>**

---

## WorkerThreadGatewayClient

_(Source: docs/api/worker-thread/gateway-client.md)_

The `WorkerThreadGatewayClient` class provides IPC communication client between worker threads using Unix domain sockets (or Windows named pipes).

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Inter-worker communication (Client side).
> - **Transport:** `net.Socket`.
> - **Usage:** Use `WorkerThreadExport.launchGatewayClient()` instead of using this directly.

&nbsp;

### Methods

#### `.request(method, params)`

Send a request to the gateway server.

| parameter | type   | required | description   |
| --------- | ------ | -------- | ------------- |
| method    | string | yes      | Target method |
| params    | any[]  | no       | Arguments     |

- **returns: Promise\<any\>**

---

## WorkerThreadGatewayServer

_(Source: docs/api/worker-thread/gateway-server.md)_

The `WorkerThreadGatewayServer` class provides IPC communication server between worker threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** Inter-worker communication (Server side).
> - **Role:** Exposes worker methods to other workers via socket.

&nbsp;

### Constructor

#### `new WorkerThreadGatewayServer(worker, path)`

| parameter | type             | required | description         |
| --------- | ---------------- | -------- | ------------------- |
| worker    | WorkerThreadInit | yes      | The worker instance |
| path      | string           | yes      | Socket path         |

### Methods

#### `.start()`

Start the socket server.

- **returns: Promise\<void\>**

#### `.close()`

Stop the socket server.

- **returns: Promise\<void\>**

---

_Generated from docs/api source files._
