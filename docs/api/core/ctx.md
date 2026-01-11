# Ctx

The `Ctx` class is the context/page base class that provides access to user data, session management, template rendering, and reply methods.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Ctx` base class for pages.
> - **Usage:** Extend this class to create page handlers.
> - **Template:** Define static `template` property for JSX-like templates.
> - **Data:** Define static `data` via `buildData()` for routing configuration.

&nbsp;

## Static Properties

### `.template`

JSX-like template string for the page.

- **type: string | undefined**

```typescript
class MyPage extends Ctx {
  static template = /*jsx*/ `
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

### `.buildData(callbackData?)`

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

### `.callbackDataParts`

Get all parts split by colon.

- **type: string[]**

&nbsp;

## Session Methods

### `.sessionGet()`

Get current session data.

- **returns: Promise\<{ method: string; params: any } | undefined\>**

### `.sessionSet(method, params)`

Set session data.

| parameter | type   | required | description        |
| --------- | ------ | -------- | ------------------ |
| method    | string | yes      | Session method     |
| params    | any    | no       | Session parameters |

- **returns: Promise\<boolean\>**

### `.sessionClear()`

Clear current session.

- **returns: Promise\<boolean\>**

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

| parameter | type   | required | default     | description         |
| --------- | ------ | -------- | ----------- | ------------------- |
| keyboard  | IKb    | no       | -           | Keyboard markup     |
| data      | object | no       | -           | Template data       |
| baseId    | string | no       | `"default"` | Template base ID    |
| options   | object | no       | -           | grammY send options |

- **returns: Promise\<Message\>**

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

- **returns: Promise\<boolean\>**

### `.sleep(ms)`

Wait for specified milliseconds.

| parameter | type   | required | description  |
| --------- | ------ | -------- | ------------ |
| ms        | number | yes      | Milliseconds |

- **returns: Promise\<void\>**

### `.callbackQueryAnswer(text?, options?)`

Answer callback query (show toast).

| parameter | type   | required | description    |
| --------- | ------ | -------- | -------------- |
| text      | string | no       | Toast text     |
| options   | object | no       | Answer options |

### `.inlineKeyboard(builder)`

Create inline keyboard using builder pattern.

| parameter | type     | required | description      |
| --------- | -------- | -------- | ---------------- |
| builder   | function | yes      | Builder callback |

- **returns: InlineKeyboard**

```typescript
const kb = this.inlineKeyboard((kb, arr) => {
  return kb
    .text(arr[0], "action1")
    .text(arr[1], "action2")
    .row()
    .text(arr[2], "action3");
});
```

### `.bottomKeyboard(builder)`

Create reply keyboard (bottom keyboard).

### `.transition(PageClass, method?, data?)`

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

## Route Methods

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

## Complete Example

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

  static template = /*jsx*/ `
    <base>
      <keyboard>Confirm, Cancel</keyboard>
      <message>Hello {{name}}, please choose:</message>
    </base>
  `;
}
```
