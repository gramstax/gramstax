# 01 - Gramstax Class

> Main bot initialization and configuration class.

---

## Table of Contents

- [Constructor](#constructor)
- [Properties](#properties)
- [Hook Methods](#hook-methods)
- [Context Creation](#context-creation)
- [Complete Example](#complete-example)

---

## Constructor

```typescript
import { Gramstax } from "gramstax";

new Gramstax({
  token: string, // Required: Bot token
  deploy: string, // Required: Deployment mode
  log: boolean, // Optional: Enable logging
  cacheSession: CacheExternal,
  cacheKeyboard: Map,
  templateManager: TemplateManager,
});
```

### Deploy Values

| Value                    | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `"polling"`              | Long polling                                                  |
| `"webhook:<URL>"`        | Webhook (Bun server, override `runWebhook` for other runtime) |
| `"serverless:<adapter>"` | Serverless                                                    |
| `"test"`                 | Testing mode                                                  |

---

## Properties

| Property           | Type              | Description        |
| ------------------ | ----------------- | ------------------ |
| `bot`              | `Bot`             | Grammy instance    |
| `pages`            | `object`          | Loaded pages       |
| `templateManager`  | `TemplateManager` | Template manager   |
| `cacheSession`     | `CacheExternal`   | Session cache      |
| `handlerBotUpdate` | `function`        | Serverless handler |

---

## Hook Methods

### hookBeforeRoute

```typescript
async hookBeforeRoute(ctx: ICtx, listenerName: string): Promise<boolean>
```

Execute before routing. Return `false` to stop.

```typescript
public async hookBeforeRoute(ctx: CtxCore, listenerName: string): Promise<boolean> {
  const lang = await ctx.cacheData.get(`${ctx.userId}:lang`)
  if (lang) ctx.userLanguage = lang
  return true
}
```

### hookErrorPage

```typescript
async hookErrorPage(ctx: ICtx, listenerName: string, error: any, isEdit: boolean): Promise<void>
```

Handle errors during routing.

```typescript
public async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
  await new GeneralErrorPage(ctx).transition(listenerName, error, isEdit)
}
```

### hookErrorInputNotFoundPage

```typescript
async hookErrorInputNotFoundPage(ctx: ICtx): Promise<void>
```

Handle unmatched input.

---

## Context Creation

Override to use custom context class.

```typescript
public createCtx(ct: Parameters<Gramstax["createCtx"]>[0]) {
  return new CtxCore({
    ct,
    cacheData: this.cacheData,
    cacheSession: this.cacheSession,
    cacheKeyboard: this.cacheKeyboard,
    templateManager: this.templateManager,
    temp: { session: {}, data: {} }
  })
}
```

---

## Complete Example

> Project structure: [06-project-structure.md](./06-project-structure.md)

```typescript
import { Gramstax } from "gramstax";
import { CtxCore } from "./core/ctx";
import { UserGuard } from "./guards/user";
import { ExternalCache } from "./cache/external";
import { GeneralErrorPage } from "./pages/general-error";

export class BotCore extends Gramstax {
  public cacheData = new ExternalCache("memory");

  public createCtx(ct: Parameters<Gramstax["createCtx"]>[0]) {
    return new CtxCore({
      ct,
      cacheData: this.cacheData,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      temp: { session: {}, data: {} },
    });
  }

  public async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).ensureValid();
    return user !== null;
  }

  public async hookErrorPage(
    ctx: CtxCore,
    listenerName: string,
    error: any,
    isEdit: boolean
  ) {
    await new GeneralErrorPage(ctx).transition(listenerName, error, isEdit);
  }
}

new BotCore({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  deploy: "polling",
  log: true,
});
```

---

## Navigation

| Previous                           | Next                                 |
| ---------------------------------- | ------------------------------------ |
| [00-overview.md](./00-overview.md) | [02-ctx-class.md](./02-ctx-class.md) |
