# 02 - Ctx Class (Page Base)

> Base class for all pages. Provides user data, message handling, sessions, keyboards.

---

## Table of Contents

- [Static Properties](#static-properties)
- [User Properties](#user-properties)
- [Message Properties](#message-properties)
- [Response Methods](#response-methods)
- [Keyboard Building](#keyboard-building)
- [Route Handlers](#route-handlers)

---

## Static Properties

### data

```typescript
// No payload
public static data = this.buildData()
// Usage: PageName.data.callbackData() → "page-name"

// Optional payload
public static data = this.buildData((x?: string) => x)
// Usage: PageName.data.callbackData() → "page-name"
// Usage: PageName.data.callbackData("val") → "page-name:val"

// Required payload
public static data = this.buildData((x: string) => x)
// Usage: PageName.data.callbackData("val") → "page-name:val"

// Multiple payloads
public static data = this.buildData((a: string, b: string) => `${a}+${b}`)
// Usage: PageName.data.callbackData("x", "y") → "page-name:x+y"
```

### template

> Syntax: [03-template-engine.md](./03-template-engine.md)

```typescript
public static template = /*jsx*/ `
  <base>
    <keyboard type="inline">Button1, Button2</keyboard>
    <message>Content</message>
  </base>
`
```

---

## User Properties

| Property        | Type     | Description             |
| --------------- | -------- | ----------------------- |
| `userId`        | `number` | Telegram user ID        |
| `userName`      | `string` | Username (no @)         |
| `userFirstName` | `string` | First name              |
| `userLastName`  | `string` | Last name               |
| `userFullName`  | `string` | Full name               |
| `userLanguage`  | `string` | Language code (get/set) |

---

## Message Properties

### Text

| Property          | Type       | Description       |
| ----------------- | ---------- | ----------------- |
| `msgText`         | `string`   | Full text         |
| `msgTextPayload`  | `string`   | Second word       |
| `msgTextPayloads` | `string[]` | Words after first |

### Callback

| Property               | Type       | Description          |
| ---------------------- | ---------- | -------------------- |
| `callbackData`         | `string`   | Full data            |
| `callbackDataPayload`  | `string`   | First after `:`      |
| `callbackDataPayloads` | `string[]` | All after `:`        |
| `callbackDataParts`    | `string[]` | Payload split by `+` |

---

## Response Methods

| Method                       | Purpose           |
| ---------------------------- | ----------------- |
| `reply(kb?, data?, baseId?)` | Send new message  |
| `edit(kb?, data?, baseId?)`  | Edit current      |
| `delete()`                   | Delete current    |
| `replyPhoto(...)`            | Send photo        |
| `editPhoto(...)`             | Edit to photo     |
| `replyAnimation(...)`        | Send animation    |
| `editAnimation(...)`         | Edit to animation |

---

## Keyboard Building

### inlineKeyboard

```typescript
public kb(baseId?: string) {
  return this.inlineKeyboard(
    (kb, arr) => {
      return kb //
        .text(arr[0]!, PageA.data.callbackData())
        .text(arr[1]!, PageB.data.callbackData())
        .row()
        .text(arr[2]!, this.data.callbackData())
    },
    { baseId }
  )
}
```

**Rules:**

- `arr` = button labels from template `<keyboard>`
- `arr` indices match comma order
- `.row()` = new row

---

## Route Handlers

> Full rules: [04-routing-system.md](./04-routing-system.md)

### Callback

| Method              | Trigger       |
| ------------------- | ------------- |
| `callback()`        | `page-name`   |
| `callbackPayload()` | `page-name:*` |

### Text

| Method                 | Trigger        |
| ---------------------- | -------------- |
| `textCommand()`        | `/page-name`   |
| `textCommandPayload()` | `/page-name *` |
| `textFree()`           | Any (session)  |

### Media

| Method           | Trigger                |
| ---------------- | ---------------------- |
| `photoFree()`    | Any photo (session)    |
| `documentFree()` | Any document (session) |

---

## Common Patterns

### internal()

```typescript
public async internal(edit = false) {
  const kb = this.kb()
  const data = { name: this.userFirstName }

  if (edit) await this.edit(kb, data)
  else await this.reply(kb, data)
}

public async textCommand() { await this.internal() }
public async callback() { await this.internal(true) }
```

### transition()

```typescript
public async transition(edit = false) {
  await this.sessionClear()
  if (edit) await this.edit(this.kb())
  else await this.reply(this.kb())
}
```

---

## Navigation

| Previous                                       | Next                                             |
| ---------------------------------------------- | ------------------------------------------------ |
| [01-gramstax-class.md](./01-gramstax-class.md) | [03-template-engine.md](./03-template-engine.md) |
