# 04 - Routing System

> Route types, resolution order, handler specifications.

---

## Table of Contents

- [Resolution Order](#resolution-order)
- [Route Types](#route-types)
- [Callback Format](#callback-format)
- [Text Format](#text-format)
- [Return Values](#return-values)

---

## Resolution Order

| Priority | Type    | Methods                           |
| -------- | ------- | --------------------------------- |
| 1        | Static  | `callback`, `text`, `textCommand` |
| 2        | Session | Session-based match               |
| 3        | Intent  | `callbackPayload`, `textPayload`  |
| 4        | Dynamic | `textFree`, `photoFree`           |
| 5        | Global  | `free`                            |

---

## Route Types

### Static (Exact Match)

File name = trigger value.

```typescript
// File: start.ts → triggers: /start, button "start"
export class StartPage extends Ctx {
  public static data = this.buildData();

  public async textCommand() {
    await this.reply(this.kb());
  }
  public async callback() {
    await this.edit(this.kb());
  }
}
```

### Intent (With Payload)

```typescript
// File: counter.ts
export class CounterPage extends Ctx {
  public static data = this.buildData((action: string = ``) => action);

  // Triggered by: "counter:I" or "counter:D"
  public async callbackPayload() {
    const action = this.callbackDataPayload;
    if (action === `I`) {
      /* increment */
    }
    if (action === `D`) {
      /* decrement */
    }
  }
}
```

### Session (Free Input)

> Full guide: [05-session-management.md](./05-session-management.md)

```typescript
export class InputPage extends Ctx {
  public async callback() {
    await this.sessionToTextFree();
    await this.edit(this.kb());
  }

  public async textFree() {
    const input = this.msgText;
    await this.sessionClear();
    await this.reply(this.kb("result"), { input }, "result");
  }
}
```

### Global Fallback

```typescript
public async free() {
  if (this.msgText?.includes("help")) {
    await this.reply(this.kb())
    return true  // Stop routing
  }
  return null  // Continue
}
```

---

## Callback Format

```
No payload:    page-name           → callback()
With payload:  page-name:value     → callbackPayload()
```

### Building

```typescript
this.data.callbackData(); // "page-name"
this.data.callbackData("val"); // "page-name:val"
this.data.callbackData("x", "y"); // "page-name:x+y"
```

### Parsing

```typescript
// "counter:I"
this.callbackDataIntent; // "counter"
this.callbackDataPayload; // "I"

// "page:a:b"
this.callbackDataPayloads; // ["a", "b"]

// "page:x+y"
this.callbackDataParts; // ["x", "y"]
```

---

## Text Format

```
page-name            → text()
page-name payload    → textPayload()
/page-name           → textCommand()
/page-name payload   → textCommandPayload()
```

### Parsing

```typescript
// "/search hello world"
this.msgTextIntent; // "/search"
this.msgTextPayload; // "hello"
this.msgTextPayloads; // ["hello", "world"]
```

---

## Return Values

| Return      | Behavior         |
| ----------- | ---------------- |
| `undefined` | Stop routing     |
| `null`      | Continue to next |
| Any value   | Stop routing     |

---

## Handler Summary

| Method                 | Trigger                |
| ---------------------- | ---------------------- |
| `callback()`           | `page-name`            |
| `callbackPayload()`    | `page-name:*`          |
| `textCommand()`        | `/page-name`           |
| `textCommandPayload()` | `/page-name *`         |
| `textFree()`           | Any text (session)     |
| `photoFree()`          | Any photo (session)    |
| `documentFree()`       | Any document (session) |
| `free()`               | Global fallback        |

---

## Navigation

| Previous                                         | Next                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| [03-template-engine.md](./03-template-engine.md) | [05-session-management.md](./05-session-management.md) |
