# Gramstax Context Specification

> AI-readable documentation for building Telegram bots with Gramstax framework.

---

## Document Index

| #   | File                                                   | Purpose                                  |
| --- | ------------------------------------------------------ | ---------------------------------------- |
| 0   | [00-overview.md](./00-overview.md)                     | Framework architecture and core concepts |
| 1   | [01-gramstax-class.md](./01-gramstax-class.md)         | Main bot class API                       |
| 2   | [02-ctx-class.md](./02-ctx-class.md)                   | Page base class API                      |
| 3   | [03-template-engine.md](./03-template-engine.md)       | Template syntax                          |
| 4   | [04-routing-system.md](./04-routing-system.md)         | Routing rules                            |
| 5   | [05-session-management.md](./05-session-management.md) | Session state                            |
| 6   | [06-project-structure.md](./06-project-structure.md)   | File structure                           |
| 7   | [07-examples.md](./07-examples.md)                     | Complete examples                        |
| 8   | [08-best-practices.md](./08-best-practices.md)         | Best practices                           |
| 9   | [09-thread-management.md](./09-thread-management.md)   | Thread management                        |

---

## Quick Start

```typescript
// src/index.ts
import { Gramstax } from "gramstax";

new Gramstax({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  deploy: `polling`,
});
```

```typescript
// src/pages/start.ts
import { Ctx } from "gramstax";

export class StartPage extends Ctx {
  public static data = this.buildData();

  public async textCommand() {
    await this.reply(this.kb());
  }

  public kb() {
    return this.inlineKeyboard((kb, arr) =>
      kb.text(arr[0]!, this.data.callbackData())
    );
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Refresh</keyboard>
      <message>Welcome!</message>
    </base>
  `;
}
```

---

## Key Rules

| Rule                    | Pattern                                             |
| ----------------------- | --------------------------------------------------- |
| File → Command          | `start.ts` → `/start`                               |
| Callback no payload     | `PageName.data.callbackData()` → `"page-name"`      |
| Callback with payload   | `PageName.data.callbackData("x")` → `"page-name:x"` |
| Handler: command        | `textCommand()` → `/page-name`                      |
| Handler: button         | `callback()` → exact match                          |
| Handler: button+payload | `callbackPayload()` → with `:`                      |
| Handler: free input     | `textFree()` → requires session                     |

---

## AI Generation Rules

1. **Extend PageBase** (not Ctx directly)
2. **Define `static data`** using `this.buildData()`
3. **Define `static template`** with `<base>` wrapper
4. **Match `arr[index]`** to button order in template
5. **Use `edit()`** for callbacks, **`reply()`** for commands
6. **Clear session** after multi-step flows

---

## Cross-Reference Guide

| Topic           | Primary Doc                                         | Also See                                          |
| --------------- | --------------------------------------------------- | ------------------------------------------------- |
| Page structure  | [02-ctx-class](./02-ctx-class.md)                   | [06-project-structure](./06-project-structure.md) |
| Route handlers  | [04-routing-system](./04-routing-system.md)         | [02-ctx-class](./02-ctx-class.md)                 |
| Template syntax | [03-template-engine](./03-template-engine.md)       | -                                                 |
| Session flow    | [05-session-management](./05-session-management.md) | [04-routing-system](./04-routing-system.md)       |
| Working code    | [07-examples](./07-examples.md)                     | All docs                                          |
