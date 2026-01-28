> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 18:09:06

> - **Framework Version:** v0.5.3

# Ctx

The `Ctx` class is the context/page base class that provides access to user data, session management, template rendering, and reply methods.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Ctx` base class for pages.
> - **Usage:** Extend this class to create page handlers.
> - **Template:** Define static `template` property for HTML-like templates.
> - **Data:** Define static `data` via `buildData()` if need with payloads. for routing configuration (this is automaticly handle by system if not defined).

&nbsp;

## Static Properties

### `.template`

- **type:** string
- **description:** HTML-like template string for the page. must be have block \<base\>\</base\>
- **example:**

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

- **type:** IPageData
- **description:** Page routing data created by `this.buildData()`. Only defined when you want to override the intent and have a callback payload. Do not define if nothing is needed; let the system automatic handle it.
- **example:**

```typescript
import { PageBase } from "~/base/page";

class MyPage extends PageBase {
  // only defined for callback payload route
  static data = this.buildData((confirm?: string) => [confirm])

  // defined for callback payload route and text. textCommand trigger route
  static data = this.buildData({
    callback: (confirm?: string) => [confirm])
    intentText: `my_page`,
    intentTextCommand: `hello`
  })
}
```

&nbsp;

## Static Methods

### `.buildData(params?)`

- **args:**
  - **params:**
    - **type:** object
    - **required:** no
    - **default:** void | undefined
    - **value:**
      - **callback:**
        - **type:** function
        - **required:** no
        - **default:** void | undefined
        - **return:** Array<string> (internal) | string (public)
        - **description:** Function that returns an array of callback payloads. Must return an array; if there is a payload, it will be directed to `callbackPayload()`, if not, to `callback()`. leave unset unless needed.
        - **example:** `((confirm: string) => [confirm])`
      - **intentText:**
        - **type:** string
        - **required:** no
        - **default:** void | undefined
        - **return:** string
        - **description:** Trigger route function `text` and `textPayload`
        - **example:** "home"
      - **intentTextCommand:**
        - **type:** string
        - **required:** no
        - **default:** void | undefined
        - **return:** string
        - **description:** Trigger route function `textCommand` and `textCommandPayload`
        - **example:** "product_detail"
- **return:**
  - **name:**
    - **type:** string
    - **description:** Page name assigned by the framework.
  - **callback:**
    - **type:** function
    - **return:** string
    - **description:** see [this.args.params.value.callback.description]()
  - **intentText:**:
    - **type:** string
    - **description:** see [this.args.params.value.intentText.description]()
  - **intentTextCommand:**:
    - **type:** string
    - **description:** see [this.args.params.value.intentTextCommand.description]()
  - **intentCallback:**:
    - **type:** string
    - **description:** Callback intent key (may be numeric if `shortCallbackData` is enabled).
  - **\_positionPayloadText:**
    - **type:** number | undefined
    - **description:** Payload index for `text` triggers (max 2 when `intentText` contains one space).
- **description:** Create page data configuration. Accepts an optional callback or an options object.
- **example:**

```typescript
import { PageBase } from "~/base/page";

class MyPage extends PageBase {
  // Make payload for callback data
  static data = this.buildData((id: string) => [id]);

  // Custom all data
  static data = this.buildData({
    callback: (action: string) => [action],
    intentTextCommand: "mycommand", // overrides trigger route function textCommand
    intentText: "hi", // overrides trigger route function text
  });
}
```

- **best_practice:**

  - Use `buildData(callbackFn)` when you need callback payloads. The callback must return an array (do not define if there is no payload purpose).
  - Prefer `intentText` + `text()` handlers for bottom-keyboard actions in single-language flows.
  - If the text input includes payloads (e.g., `start 123`), it routes to `textPayload()`. If a command includes payloads (e.g., `/start 123`), it routes to `textCommandPayload()`.
  - `intentText` applies to both `text()` and `textPayload()` routes; `intentTextCommand` applies to `textCommand()` and `textCommandPayload()` routes.
  - Do not set `intentText` or `intentTextCommand` unless you need to override the auto-derived intent (it defaults to `this.data.name`, based on the filename). You can also change the page filename (e.g., `reset.ts` → `Reset.ts`) to alter the derived intent without overriding it.

&nbsp;

## User Properties

### `.userId`

- **type:** number
- **description:** Telegram user ID from the current update context.
- **example:**

```typescript
this.userId; // 12345678
```

### `.userName`

- **type:** string | undefined
- **description:** Telegram username from the user profile.
- **example:**

```typescript
this.userName; // `gramstax_user`
```

### `.userFirstName`

- **type:** string
- **description:** User's first name from Telegram profile data.
- **example:**

```typescript
this.userFirstName; // `Alya`
```

### `.userLastName`

- **type:** string | undefined
- **description:** User's last name from Telegram profile data.
- **example:**

```typescript
this.userLastName; // `Putri`
```

### `.userFullName`

- **type:** string
- **description:** Combined first and last name derived from profile fields.
- **example:**

```typescript
this.userFullName; // `Alya Putri`
```

### `.userLanguage`

- **type:** string
- **description:** User language code from Telegram.
- **example:**

```typescript
this.userLanguage; // `en`
```

### `.userIsPremium`

- **type:** boolean
- **description:** True when the user has Telegram Premium.
- **example:**

```typescript
this.userIsPremium; // true
```

### `.userIsBot`

- **type:** boolean
- **description:** True when the user account is a bot.
- **example:**

```typescript
this.userIsBot; // false
```

&nbsp;

## Message Properties

### `.msgText`

- **type:** string | undefined
- **description:** Message text from the current update.
- **example:**

```typescript
this.msgText; // `Hello`
```

### `.msgTextPayload`

- **type:** string | undefined
- **description:** First payload token parsed from message text.
- **example:**

```typescript
this.msgTextPayload; // `123`
```

### `.msgTextPayloads`

- **type:** string[]
- **description:** All payload tokens parsed from message text.
- **example:**

```typescript
this.msgTextPayloads; // [`start`, `123`]
```

### `.msgCaption`

- **type:** string | undefined
- **description:** Caption text for media messages.
- **example:**

```typescript
this.msgCaption; // `Photo caption`
```

### `.msgPhoto`

- **type:** PhotoSize[] | undefined
- **description:** Photo sizes attached to the message.
- **example:**

```typescript
this.msgPhoto; // [/* PhotoSize */]
```

### `.msgVideo`

- **type:** Video | undefined
- **description:** Video payload attached to the message.
- **example:**

```typescript
this.msgVideo; // { /* Video */ }
```

### `.msgAudio`

- **type:** Audio | undefined
- **description:** Audio payload attached to the message.
- **example:**

```typescript
this.msgAudio; // { /* Audio */ }
```

&nbsp;

## Callback Properties

### `.callbackData`

- **type:** string | undefined
- **description:** Raw callback query data from inline keyboard interactions.
- **example:**

```typescript
this.callbackData; // `menu:settings:ok`
```

### `.callbackDataPayload`

- **type:** string | undefined
- **description:** First payload token parsed from callback data.
- **example:**

```typescript
this.callbackDataPayload; // `settings`
```

### `.callbackDataPayloads`

- **type:** string[]
- **description:** All payload tokens parsed from callback data.
- **example:**

```typescript
this.callbackDataPayloads; // [`settings`, `ok`]
```

&nbsp;

## Session Methods

### `.sessionGet()`

- **description:** Get current session data.
- **return:**
  - **type:** Promise<{ method: string; params: any } | undefined>
  - **description:** Resolves with stored session payload.
- **example:**

```typescript
await this.sessionGet(); // { method: `text`, params: { id: `123` } }
```

### `.sessionSet(method, params)`

- **description:** Set session data.
- **args:**
  - **method:**
    - **type:** string
    - **required:** yes
    - **description:** Session method. Matches route handler name.
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters. Stored in session payload.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionSet(`text`, { id: `123` }); // true
```

### `.sessionClear()`

- **description:** Clear current session.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionClear(); // true
```

### `.sessionCallback(params?, name?)`

- **description:** Set session for callback route.
- **args:**
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters.
  - **name:**
    - **type:** string
    - **required:** no
    - **description:** Optional page name override.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionCallback({ action: `next` }); // true
```

### `.sessionCallbackPayload(params?, name?)`

- **description:** Set session for callbackPayload route.
- **args:**
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters.
  - **name:**
    - **type:** string
    - **required:** no
    - **description:** Optional page name override.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionCallbackPayload({ id: `123` }); // true
```

### `.sessionText(params?, name?)`

- **description:** Set session for text route.
- **args:**
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters.
  - **name:**
    - **type:** string
    - **required:** no
    - **description:** Optional page name override.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionText({ step: `name` }); // true
```

### `.sessionTextPayload(params?, name?)`

- **description:** Set session for textPayload route.
- **args:**
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters.
  - **name:**
    - **type:** string
    - **required:** no
    - **description:** Optional page name override.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionTextPayload({ id: `123` }); // true
```

### `.sessionTextFree(params?, name?)`

- **description:** Set session for textFree route.
- **args:**
  - **params:**
    - **type:** any
    - **required:** no
    - **description:** Session parameters.
  - **name:**
    - **type:** string
    - **required:** no
    - **description:** Optional page name override.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.sessionTextFree({ note: `any` }); // true
```

&nbsp;

## Reply Methods

### Reply Argument Notes

<a id="reply-arg-keyboard"></a>

- **keyboard:** Keyboard markup from `inlineKeyboard()` or `bottomKeyboard()` builders.

<a id="reply-arg-data"></a>

- **data:** Template data used for interpolation.

<a id="reply-arg-baseid"></a>

- **baseId:** Template base ID. Defaults to `default`.

### `.reply(keyboard?, data?, baseId?, options?)`

- **description:** Send a text message reply.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReply
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.reply(); // Message
```

### `.replyPhoto(keyboard?, data?, baseId?, options?)`

- **description:** Send a photo message.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyPhoto
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyPhoto(); // Message
```

### `.replyVideo(keyboard?, data?, baseId?, options?)`

- **description:** Send a video message.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyVideo
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyVideo(); // Message
```

### `.replyAudio(keyboard?, data?, baseId?, options?)`

- **description:** Send an audio message.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyAudio
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyAudio(); // Message
```

### `.replyDocument(keyboard?, data?, baseId?, options?)`

- **description:** Send a document message.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyDocument
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyDocument(); // Message
```

### `.replyAnimation(keyboard?, data?, baseId?, options?)`

- **description:** Send an animation/GIF.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyAnimation
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyAnimation(); // Message
```

### `.replyVoice(keyboard?, data?, baseId?, options?)`

- **description:** Send a voice message.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyVoice
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyVoice(); // Message
```

### `.replyVideoNote(keyboard?, data?, baseId?, options?)`

- **description:** Send a video note.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyVideoNote
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyVideoNote(); // Message
```

### `.replySticker(keyboard?, data?, baseId?, options?)`

- **description:** Send a sticker.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplySticker
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replySticker(); // Message
```

### `.replyLocation(keyboard?, data?, baseId?, options?)`

- **description:** Send a location.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyLocation
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyLocation(); // Message
```

### `.replyContact(keyboard?, data?, baseId?, options?)`

- **description:** Send a contact.
- **args:**
  - **keyboard:**
    - **type:** IInBoKb
    - **required:** no
    - **description:** See [keyboard](#reply-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#reply-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#reply-arg-baseid).
  - **options:**
    - **type:** IOptReplyContact
    - **required:** no
    - **description:** Options passed to the `grammY` reply call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with sent message.
- **example:**

```typescript
await this.replyContact(); // Message
```

&nbsp;

## Edit Methods

### Edit Argument Notes

<a id="edit-arg-keyboard"></a>

- **keyboard:** Inline keyboard markup from `inlineKeyboard()`.

<a id="edit-arg-data"></a>

- **data:** Template data used for interpolation.

<a id="edit-arg-baseid"></a>

- **baseId:** Template base ID. Defaults to `default`.

### `.edit(keyboard?, data?, baseId?, options?)`

- **description:** Edit the current message text.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEdit
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.edit(); // Message
```

### `.editPhoto(keyboard?, data?, baseId?, options?)`

- **description:** Edit media to photo.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEditMedia1
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.editPhoto(); // Message
```

### `.editVideo(keyboard?, data?, baseId?, options?)`

- **description:** Edit media to video.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEditMedia1
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.editVideo(); // Message
```

### `.editAudio(keyboard?, data?, baseId?, options?)`

- **description:** Edit media to audio.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEditMedia1
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.editAudio(); // Message
```

### `.editDocument(keyboard?, data?, baseId?, options?)`

- **description:** Edit media to document.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEditMedia1
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.editDocument(); // Message
```

### `.editAnimation(keyboard?, data?, baseId?, options?)`

- **description:** Edit media to animation.
- **args:**
  - **keyboard:**
    - **type:** IInlineKb
    - **required:** no
    - **description:** See [keyboard](#edit-arg-keyboard).
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** See [data](#edit-arg-data).
  - **baseId:**
    - **type:** string
    - **required:** no
    - **description:** See [baseId](#edit-arg-baseid).
  - **options:**
    - **type:** IOptEditMedia1
    - **required:** no
    - **description:** Options passed to the `grammY` edit call.
- **return:**
  - **type:** Promise<Message>
  - **description:** Resolves with edited message.
- **example:**

```typescript
await this.editAnimation(); // Message
```

&nbsp;

## Other Methods

### `.delete()`

- **description:** Delete the current message.
- **return:**
  - **type:** Promise<boolean>
  - **description:** Resolves with operation result.
- **example:**

```typescript
await this.delete(); // true
```

### `.callbackQueryAnswer(options?)`

- **description:** Answer callback query (show toast). Call this only when you need a custom toast or extra acknowledgment.
- **args:**
  - **options:**
    - **type:** object
    - **required:** no
    - **description:** Options passed to grammY `answerCallbackQuery`.
- **return:**
  - **type:** Promise<boolean | null>
  - **description:** Resolves with operation result or null on error.
- **example:**

```typescript
await this.callbackQueryAnswer({ text: `Saved` }); // true
```

### `.inlineKeyboard(builder)` and `.bottomKeyboard(builder)`

- **description:** Create a keyboard using the builder pattern.
- **args:**
  - **builder:**
    - **type:** function
    - **required:** yes
    - **description:** Builder callback. Receives (kb, labels).
  - **builderArgs:**
    - **k:**
      - **type:** object
      - **required:** yes
      - **description:** InlineKeyboard (inline) or Keyboard (bottom) from grammY.
    - **a:**
      - **type:** string[]
      - **required:** yes
      - **description:** Labels from `<keyboard>` block split by commas.
- **return:**
  - **type:** InlineKeyboard | BottomKeyboard
  - **description:** Builder instance for inline buttons and bottom buttons.
- **example:**

```typescript
// inline keyboard (will show on below message)
const ik = this.inlineKeyboard((k, a) => {
  return k //
    .text(a[0]!, `action1`)
    .text(a[1]!, `action2`)
    .row()
    .text(a[2]!, `action3`);
}); // InlineKeyboard

// bottom keyboard (will show on below position keyboard phone)
const bk = this.bottomKeyboard((k, a) => {
  return k //
    .text(a[0]!)
    .text(a[1]!)
    .row()
    .text(a[2])
    .oneTime();
}); // BottomKeyboard
```

### `.to(data: {})`

- **description:** Transition to another page.
- **args:**
  - **data:**
    - **type:** object
    - **required:** no
    - **description:** Data to pass. Provide the data from the previous page to this page that is only needed.
- **return:**
  - **type:** Promise<void>
  - **description:** Resolves after the transition completes.
- **example:**

```typescript
// ./pages/home.ts
async to(data: {inputName: any}) {
  await edit(undefined, data)
}

// ./pages/others.ts
await new HomePage(this).to({ inputName: `test` }); // navigates to HomePage
```

&nbsp;

## Route Methods

Define these methods in your page class to handle specific routes:

| Method                             | Trigger Process (automatically by system)                                                                                                                                                                                                                                                   | Trigger Example                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `callback()`                       | this.callbackData === this.data.intentCallback                                                                                                                                                                                                                                              | k.text(`title button`, `start`)                        |
| `callbackPayload()`                | this.callbackData && this.callbackData.includes(` `) && this.data.intentCallback === getIntent(this.callbackData, `colon`, 1)                                                                                                                                                               | k.text(`title button`, `start:123`)                    |
| `text()`                           | this.msgText === this.data.intentText                                                                                                                                                                                                                                                       | message: start                                         |
| `textPayload()`                    | this.msgText && this.msgText.includes(` `) && this.data.intentText === getIntent(this.msgText, `space`, this.data.\_positionPayloadText)                                                                                                                                                    | message: start 123 AAA                                 |
| `textCommand()`                    | this.msgText && this.msgText.startsWith(`/`) && "/" + this.data.intentTextCommand === this.msgText                                                                                                                                                                                          | message: /start                                        |
| `textCommandPayload()`             | this.msgText && this.msgText.startsWith(`/`) && this.msgText.includes(` `) && "/" + this.data.intentTextCommand === getIntent(this.msgText, `space`, 1)                                                                                                                                     | message: /start 123 AAA                                |
| `textFree()`                       | this.msgText (fallback route if set)                                                                                                                                                                                                                                                        | message: <A-Za-z0-9> (no need to guard for empty text) |
| `photoCaption()`                   | this.msgPhoto && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                      | caption: start                                         |
| `photoCaptionPayload()`            | this.msgPhoto && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                              | caption: start 123 AAA                                 |
| `photoCaptionCommand()`            | this.msgPhoto && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                             | caption: /start                                        |
| `photoCaptionCommandPayload()`     | this.msgPhoto && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                     | caption: /start 123 AAA                                |
| `photoFree()`                      | this.msgPhoto (fallback route if set)                                                                                                                                                                                                                                                       | photo: <A-Za-z0-9>                                     |
| `videoCaption()`                   | this.msgVideo && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                      | caption: start                                         |
| `videoCaptionPayload()`            | this.msgVideo && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                              | caption: start 123 AAA                                 |
| `videoCaptionCommand()`            | this.msgVideo && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                             | caption: /start                                        |
| `videoCaptionCommandPayload()`     | this.msgVideo && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                     | caption: /start 123 AAA                                |
| `videoFree()`                      | this.msgVideo (fallback route if set)                                                                                                                                                                                                                                                       | video: <A-Za-z0-9>                                     |
| `audioCaption()`                   | this.msgAudio && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                      | caption: start                                         |
| `audioCaptionPayload()`            | this.msgAudio && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                              | caption: start 123 AAA                                 |
| `audioCaptionCommand()`            | this.msgAudio && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                             | caption: /start                                        |
| `audioCaptionCommandPayload()`     | this.msgAudio && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                     | caption: /start 123 AAA                                |
| `audioFree()`                      | this.msgAudio (fallback route if set)                                                                                                                                                                                                                                                       | audio: <A-Za-z0-9>                                     |
| `documentCaption()`                | this.msgDocument && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                   | caption: start                                         |
| `documentCaptionPayload()`         | this.msgDocument && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                           | caption: start 123 AAA                                 |
| `documentCaptionCommand()`         | this.msgDocument && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                          | caption: /start                                        |
| `documentCaptionCommandPayload()`  | this.msgDocument && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                  | caption: /start 123 AAA                                |
| `documentFree()`                   | this.msgDocument (fallback route if set)                                                                                                                                                                                                                                                    | document: <A-Za-z0-9>                                  |
| `animationCaption()`               | this.msgAnimation && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                  | caption: start                                         |
| `animationCaptionPayload()`        | this.msgAnimation && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                          | caption: start 123 AAA                                 |
| `animationCaptionCommand()`        | this.msgAnimation && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                         | caption: /start                                        |
| `animationCaptionCommandPayload()` | this.msgAnimation && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                 | caption: /start 123 AAA                                |
| `animationFree()`                  | this.msgAnimation (fallback route if set)                                                                                                                                                                                                                                                   | animation: <A-Za-z0-9>                                 |
| `voiceCaption()`                   | this.msgVoice && this.msgCaption && this.data.name === this.msgCaption                                                                                                                                                                                                                      | caption: start                                         |
| `voiceCaptionPayload()`            | this.msgVoice && this.msgCaption && this.msgCaption.includes(` `) && this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                                                              | caption: start 123 AAA                                 |
| `voiceCaptionCommand()`            | this.msgVoice && this.msgCaption && this.msgCaption.startsWith(`/`) && "/" + this.data.name === this.msgCaption                                                                                                                                                                             | caption: /start                                        |
| `voiceCaptionCommandPayload()`     | this.msgVoice && this.msgCaption && this.msgCaption.startsWith(`/`) && this.msgCaption.includes(` `) && "/" + this.data.name === getIntent(this.msgCaption, `space`, 1)                                                                                                                     | caption: /start 123 AAA                                |
| `voiceFree()`                      | this.msgVoice (fallback route if set)                                                                                                                                                                                                                                                       | voice: <A-Za-z0-9>                                     |
| `videoNoteFree()`                  | this.msgVideoNote (fallback route if set)                                                                                                                                                                                                                                                   | videoNote: <A-Za-z0-9>                                 |
| `stickerFree()`                    | this.msgSticker (fallback route if set)                                                                                                                                                                                                                                                     | sticker: <A-Za-z0-9>                                   |
| `locationFree()`                   | this.msgLocation (fallback route if set)                                                                                                                                                                                                                                                    | location: <A-Za-z0-9>                                  |
| `contactFree()`                    | this.msgContact (fallback route if set)                                                                                                                                                                                                                                                     | contact: <A-Za-z0-9>                                   |
| `free()`                           | this.callbackData \|\| this.msgText \|\| this.msgPhoto \|\| this.msgVideo \|\| this.msgAudio \|\| this.msgDocument \|\| this.msgAnimation \|\| this.msgVoice \|\| this.msgVideoNote \|\| this.msgSticker \|\| this.msgLocation \|\| this.msgContact (Any all route) (fallback route if set) | <A-Za-z0-9>                                            |

&nbsp;

## Usage

```typescript
import { PageBase } from "~/base/page";
import { OtherPage } from "./other";

export class MyPage extends PageBase {
  static data = this.buildData((action: string) => [action]);

  kb() {
    return this.inlineKeyboard((k, a) => {
      return k
        .text(a[0]!, this.data.callback("confirm"))
        .text(a[1]!, this.data.callback("cancel"));
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
