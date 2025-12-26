# 06 - Project Structure

> Standard project structure and conventions.

---

## Directory Structure

```
my-bot/
├── src/
│   ├── base/
│   │   ├── page.ts              # PageBase extends CtxCore
│   │   └── guard.ts             # GuardBase extends CtxCore
│   ├── cache/
│   │   └── external.ts          # ExternalCache extends CacheExternal
│   ├── core/
│   │   ├── bot.ts               # BotCore extends Gramstax
│   │   └── ctx.ts               # CtxCore extends Ctx
│   ├── guards/
│   │   └── user.ts
│   ├── pages/                   # Auto-discovered
│   │   ├── start.ts
│   │   ├── help.ts
│   │   └── general-error.ts
│   ├── env.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## Core Files

### src/index.ts

```typescript
import { env } from "./env";
import { BotCore } from "./core/bot";

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true,
});
```

### src/env.ts

```typescript
export const env = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
  TELEGRAM_BOT_DEPLOY: process.env.TELEGRAM_BOT_DEPLOY || "polling",
};
```

### src/core/ctx.ts

```typescript
import { Ctx } from "gramstax";
import type { ExternalCache } from "~/cache/external";

export class CtxCore extends Ctx {
  public cacheData: ExternalCache;

  public constructor(
    params: ConstructorParameters<typeof Ctx>[0] & { cacheData: ExternalCache }
  ) {
    super({ ...params });
    this.cacheData = params.cacheData;
  }
}
```

### src/base/page.ts

```typescript
import { CtxCore } from "~/core/ctx";

export abstract class PageBase extends CtxCore {}
```

---

## Page Structure

> Full API: [02-ctx-class.md](./02-ctx-class.md)

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

export class MyPage extends PageBase {
  public static data = this.buildData((payload: string = ``) => payload);

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData(`action`))
        .text(arr[1]!, StartPage.data.callbackData());
    });
  }

  public async textCommand() {
    await this.reply(this.kb());
  }
  public async callback() {
    await this.edit(this.kb());
  }

  public async callbackPayload() {
    const data = this.callbackDataPayload;
    if (data == `action`) {
      /* handled */
    }
  }

  public static template = /*jsx*/ `
    <base>
      <description>Page description</description>
      <keyboard type="inline">Action, Back</keyboard>
      <message>Welcome!</message>
    </base>
  `;
}
```

---

## File Naming

| File               | Page            | Command          |
| ------------------ | --------------- | ---------------- |
| `start.ts`         | `start`         | `/start`         |
| `wallet-create.ts` | `wallet-create` | `/wallet-create` |

---

## Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": { "~/*": ["./src/*"] }
  }
}
```

### .env

```env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_BOT_DEPLOY=polling
```

### package.json

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts"
  },
  "dependencies": { "gramstax": "latest" }
}
```

---

## Navigation

| Previous                                               | Next                               |
| ------------------------------------------------------ | ---------------------------------- |
| [05-session-management.md](./05-session-management.md) | [07-examples.md](./07-examples.md) |
