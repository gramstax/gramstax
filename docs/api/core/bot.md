> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# Gramstax

The `Gramstax` class is the main bot framework class that handles initialization, routing, and lifecycle management for Telegram bots.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Gramstax` main class for bot initialization.
> - **Extends:** Uses grammY under the hood for Telegram API.
> - **Deploy modes:** polling, webhook, serverless.
> - **Routing:** Automatic page-based routing with session support.

&nbsp;

## Constructor

### `new Gramstax(params)`

| parameter                            | type               | required | default     | description                | ai_notes                                                       |
| ------------------------------------ | ------------------ | -------- | ----------- | -------------------------- | -------------------------------------------------------------- |
| params.token                         | string             | yes      | -           | Telegram bot token         | Obtained from @BotFather.                                      |
| params.deploy                        | string             | yes      | -           | Deployment mode            | Values are "polling", "webhook:<url>", "serverless:<adapter>". |
| params.log                           | LoggingPretty/bool | no       | -           | Logger instance or boolean | If true, creates new LoggingPretty.                            |
| params.cacheSession                  | CacheExternal      | no       | memory      | Session cache adapter      | Defaults to in-memory cache.                                   |
| params.cacheKeyboard                 | Map                | no       | `new Map()` | Keyboard cache             | Caches keyboard layouts.                                       |
| params.templateManager               | TemplateManager    | no       | auto        | Template manager instance  | Defaults to `src/pages` loader.                                |
| params.optionsPage.shortCallbackData | boolean            | no       | `false`     | Use short callback data    | If true, uses index numbers instead of page names.             |

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

## Deploy Modes

### Polling

Long-polling mode for development.

```typescript
new Gramstax({
  token: "TOKEN",
  deploy: "polling",
});
```

### Webhook

Webhook mode for production with Bun.

```typescript
new Gramstax({
  token: "TOKEN",
  deploy: "webhook:https://example.com/webhook",
});
```

### Serverless

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

## Properties

### `.bot`

The underlying grammY Bot instance.

- **type: Bot**

### `.pages`

Loaded page registry with routing maps.

- **type: object**

### `.templateManager`

Template manager instance.

- **type: TemplateManager**

### `.cacheSession`

Session cache adapter.

- **type: CacheExternal**

### `.cacheKeyboard`

Keyboard cache.

- **type: Map**

### `.log`

Logger instance.

- **type: LoggingPretty | undefined**

### `.handlerBotUpdate`

Update handler for serverless deployments.

- **type: function**

&nbsp;

## Lifecycle Hooks

Override these methods in subclass to customize behavior.

### `.hookBeforeStart()`

Called before bot starts.

```typescript
class MyBot extends Gramstax {
  hookBeforeStart() {
    console.log("Bot is about to start");
  }
}
```

### `.hookAfterStart()`

Called after bot starts successfully.

```typescript
class MyBot extends Gramstax {
  hookAfterStart() {
    console.log("Bot started successfully");
  }
}
```

### `.hookBeforeRoute(ctx, listenerName)`

Called before routing each update. Return `false` to skip routing.

| parameter    | type   | description      | ai_notes                            |
| ------------ | ------ | ---------------- | ----------------------------------- |
| ctx          | Ctx    | Context instance | Current update context.             |
| listenerName | string | Event type       | Example values: "text", "callback". |

- **returns: Promise\<boolean\>**
- **ai_notes:** Return `false` to skip routing.

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

### `.hookErrorPage(ctx, listenerName, error, isEdit)`

Called when page throws an error.

| parameter    | type    | description           | ai_notes                            |
| ------------ | ------- | --------------------- | ----------------------------------- |
| ctx          | Ctx     | Context instance      | Current update context.             |
| listenerName | string  | Event type            | Example values: "text", "callback". |
| error        | any     | The error             | Error thrown by page.               |
| isEdit       | boolean | Was it an edit action | True when edit handler path.        |

```typescript
import { GeneralStatusPage } from "~/pages/general-status";

class MyBot extends Gramstax {
  async hookErrorPage(ctx, listenerName, error, isEdit) {
    console.error(`Error in ${listenerName}:`, error);
    await new GeneralStatusPage(ctx).toError(
      `${listenerName}:hookErrorPage`,
      error,
      isEdit
    );
  }
}
```

### `.hookErrorInputNotFoundPage(ctx)`

Called when no matching route found.

```typescript
import { GeneralStatusPage } from "~/pages/general-status";

class MyBot extends Gramstax {
  async hookErrorInputNotFoundPage(ctx) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound();
  }
}
```

&nbsp;

## Routing Priority

Routes are matched in this order:

1. **staticSession** - Session-based routing (if session exists and entity has no own route)
2. **static** - Exact match (e.g., `/start`, `help`)
3. **staticIntent** - Payload match (e.g., `/start payload`, `callback:data`)
4. **dynamicSpecific** - Type-specific free routes (e.g., `textFree`, `photoFree`)
5. **dynamic** - Generic `free()` method

&nbsp;

## Usage

```typescript
import { Gramstax, Ctx, CacheExternal } from "gramstax";

class MyBot extends Gramstax {
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
    await new GeneralStatusPage(ctx).toError(
      `${listenerName}:hookErrorPage`,
      error,
      isEdit
    );
  }
}

new MyBot({
  token: process.env.BOT_TOKEN!,
  deploy: "polling",
  log: true,
  cacheSession: new CacheExternal("redis://localhost:6379", "session"),
});
```
