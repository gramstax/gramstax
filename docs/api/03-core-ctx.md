# Ctx

- **Type:** Class
- **Description:** The core Context class extending Grammy's Context to provide Gramstax features.

## Constructor

### `new Ctx(params)`

- **Description:** Creates a new Ctx instance.
- **Params:**
  - `params.ct`: `[Context]` - The original Grammy Context.
  - `params.cacheSession`: `[CacheExternal]` - Session storage adapter.
  - `params.cacheKeyboard`: `[Map<any, any>]` - Keyboard cache map.
  - `params.templateManager`: `[TemplateManager]` - Template manager instance.
  - `params.temp`: `[ITemp]` - Temporary per-request storage.
- **Returns:** `Ctx` instance.
- **Example:** `const ctx = new Ctx({ ct, ... });`

## Properties

### `template`

- **Type:** `string` (Static)
- **Description:** The HTML template string for the page (static).
- **Example:** `Page.template = "<message>Hi</message>";`

### `data`

- **Type:** `IPageData` (Static)
- **Description:** Metadata for external access (e.g. callback builder).
- **Example:** `StartPage.data.callbackData("arg");`

### `data`

- **Type:** `IPageData` (Instance)
- **Description:** Metadata for internal access within a page instance.
- **Example:** `this.data.name;`

### `userIsPremium`

- **Type:** `boolean`
- **Description:** Checks if the user has Telegram Premium.
- **Example:** `if (ctx.userIsPremium) ...`

### `userIsBot`

- **Type:** `boolean`
- **Description:** Checks if the user is a bot.
- **Example:** `if (ctx.userIsBot) return;`

### `userId`

- **Type:** `number`
- **Description:** The Telegram user ID.
- **Example:** `const id = ctx.userId;`

### `userName`

- **Type:** `string`
- **Description:** The Telegram username.
- **Example:** `console.log(ctx.userName);`

### `userFullName`

- **Type:** `string`
- **Description:** The full name (First Last).
- **Example:** `await ctx.reply(ctx.userFullName);`

### `userFirstName`

- **Type:** `string`
- **Description:** The user's first name.
- **Example:** `console.log(ctx.userFirstName);`

### `userLastName`

- **Type:** `string`
- **Description:** The user's last name.
- **Example:** `console.log(ctx.userLastName);`

### `userLanguage`

- **Type:** `string`
- **Description:** The user's language code. Setting this updates the temporary session.
- **Example:** `ctx.userLanguage = "id";`

### `msgText`

- **Type:** `string`
- **Description:** The text content of the message.
- **Example:** `if (ctx.msgText === "/start") ...`

### `msgTextIntent`

- **Type:** `string`
- **Description:** The first word of the message text (e.g., command).
- **Example:** `if (ctx.msgTextIntent === "/cmd") ...`

### `msgTextPayloads`

- **Type:** `string[]`
- **Description:** Arguments following the intent in the message text.
- **Example:** `const args = ctx.msgTextPayloads;`

### `msgTextPayload`

- **Type:** `string`
- **Description:** The first argument of the message text.
- **Example:** `const arg1 = ctx.msgTextPayload;`

### `msgCaption`

- **Type:** `string`
- **Description:** The caption of a media message.
- **Example:** `if (ctx.msgCaption) ...`

### `msgCaptionIntent`

- **Type:** `string`
- **Description:** The first word of the caption.
- **Example:** `const cmd = ctx.msgCaptionIntent;`

### `msgPhoto`

- **Type:** `PhotoSize[]`
- **Description:** Array of photo sizes if the message contains a photo.
- **Example:** `const photo = ctx.msgPhoto;`

### `msgVideo`

- **Type:** `Video`
- **Description:** Video object if the message contains a video.
- **Example:** `const video = ctx.msgVideo;`

### `msgAudio`

- **Type:** `Audio`
- **Description:** Audio object if the message contains audio.
- **Example:** `const audio = ctx.msgAudio;`

### `callbackData`

- **Type:** `string`
- **Description:** The data from a callback query.
- **Example:** `const data = ctx.callbackData;`

### `callbackDataIntent`

- **Type:** `string`
- **Description:** The intent part of the callback data (before `:`).
- **Example:** `if (ctx.callbackDataIntent === "menu") ...`

### `callbackDataPayloads`

- **Type:** `string[]`
- **Description:** The payload parts of the callback data (after `:`).
- **Example:** `const payloads = ctx.callbackDataPayloads;`

### `callbackDataPayload`

- **Type:** `string`
- **Description:** The first payload part.
- **Example:** `const id = ctx.callbackDataPayload;`

### `callbackDataParts`

- **Type:** `string[]`
- **Description:** The first payload split by `+`.
- **Example:** `const [x, y] = ctx.callbackDataParts;`

### `session`

- **Type:** `object`
- **Description:** Accessor for session data stored in `temp.session`.
- **Example:** `const currentMethod = ctx.session.method;`

### `ct`

- **Type:** `[Context]`
- **Description:** The underlying Grammy context.
- **Example:** `await ctx.ct.reply("Raw");`

### `cacheSession`

- **Type:** `[CacheExternal]`
- **Description:** Adapter for session storage.
- **Example:** `await ctx.cacheSession.get("key");`

### `cacheKeyboard`

- **Type:** `[Map]`
- **Description:** In-memory cache for compiled keyboards.
- **Example:** `ctx.cacheKeyboard.clear();`

### `templateManager`

- **Type:** `[TemplateManager]`
- **Description:** Manager for loading and rendering templates.
- **Example:** `const msg = ctx.templateManager.getMessage(...);`

### `temp`

- **Type:** `[ITemp]`
- **Description:** Temporary storage for the lifespan of the request.
- **Example:** `ctx.temp.myVar = 123;`

## Methods

### `reply(keyboard?, data?, baseId?, options?)`

- **Description:** Sends a message using the active page's template.
- **Params:**
  - `keyboard`: `[InlineKeyboard | Keyboard]` - Optional keyboard object.
  - `data`: `[object]` - Data object for template variables.
  - `baseId`: `[string]` - Template base ID (default: "default").
  - `options`: `[object]` - Extra Telegram send options.
- **Returns:** `Promise<Message>`
- **Example:** `await this.reply(this.mainKb(), { name: "User" });`

### `edit(keyboard?, data?, baseId?, options?, fallbackReply?)`

- **Description:** Edits the current message.
- **Params:**
  - `keyboard`: `[InlineKeyboard]` - Optional keyboard.
  - `data`: `[object]` - Template data.
  - `baseId`: `[string]` - Template base ID.
  - `options`: `[object]` - Extra options.
  - `fallbackReply`: `[boolean]` - (default true). If edit fails, send a new message instead.
- **Returns:** `Promise<Message | true>`
- **Example:** `await this.edit(this.mainKb(), { step: 2 });`

### `delete()`

- **Description:** Deletes the current message.
- **Params:** None.
- **Returns:** `Promise<boolean>`
- **Example:** `await this.delete();`

### `sessionSet(method, params, moreRoot?)`

- **Description:** Updates the session state in the cache.
- **Params:**
  - `method`: `[string]` - The next routing method string (e.g., "1-nextStep").
  - `params`: `[object]` - Object with session variables.
  - `moreRoot`: `[object]` - Additional root-level session data.
- **Returns:** `Promise<boolean>`
- **Example:** `await this.sessionSet("waitName", { tries: 0 });`

### `sessionGet()`

- **Description:** Retrieves the current session data.
- **Params:** None.
- **Returns:** `Promise<object | null>`
- **Example:** `const session = await this.sessionGet();`

### `sessionClear()`

- **Description:** Deletes the current session.
- **Params:** None.
- **Returns:** `Promise<boolean>`
- **Example:** `await this.sessionClear();`

### `inlineKeyboard(callback, params?)`

- **Description:** Constructs an Inline Keyboard using template labels.
- **Params:**
  - `callback`: `[Function]` - Builder function `(kb, labels) => kb...`.
  - `params`: `[object]` - Data for label interpolation.
- **Returns:** `InlineKeyboard`
- **Example:** `this.inlineKeyboard((kb, labels) => kb.text(labels[0], "next"));`
