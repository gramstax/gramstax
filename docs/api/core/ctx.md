> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
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

### `.buildData(callbackData?)`

Create page data configuration.

| parameter    | type     | required | description                             | ai_notes                              |
| ------------ | -------- | -------- | --------------------------------------- | ------------------------------------- |
| callbackData | function | no       | Function returning callback data string | Overrides default page name when set. |

- **returns: IPageData**
- **ai_notes:** Metadata used for routing.

```typescript
import { PageBase } from "~/base/page";

class MyPage extends PageBase {
  // Simple data (dont create like below because its already create in background)
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

### `.callbackDataParts`

Get all parts split by colon.

- **type: string[]**

&nbsp;

## Session Methods

### `.sessionGet()`

Get current session data.

- **returns: Promise\<{ method: string; params: any } | undefined\>**
- **ai_notes:** Resolves with stored session payload.

### `.sessionSet(method, params)`

Set session data.

| parameter | type   | required | description        | ai_notes                    |
| --------- | ------ | -------- | ------------------ | --------------------------- |
| method    | string | yes      | Session method     | Matches route handler name. |
| params    | any    | no       | Session parameters | Stored in session payload.  |

- **returns: Promise\<boolean\>**
- **ai_notes:** Resolves with operation result.

### `.sessionClear()`

Clear current session.

- **returns: Promise\<boolean\>**
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

- **returns: Promise\<Message\>**
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

- **returns: Promise\<boolean\>**
- **ai_notes:** Resolves with operation result.

### `.sleep(ms)`

Wait for specified milliseconds.

| parameter | type   | required | description  | ai_notes             |
| --------- | ------ | -------- | ------------ | -------------------- |
| ms        | number | yes      | Milliseconds | Delay before resume. |

- **returns: Promise\<void\>**
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
