# 00 - Framework Overview

> Core architecture and concepts for Gramstax.

---

## Table of Contents

- [What is Gramstax](#what-is-gramstax)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Deployment Modes](#deployment-modes)

---

## What is Gramstax

TypeScript framework for Telegram bots, built on [grammy](https://grammy.dev/).

| Feature         | Description                          |
| --------------- | ------------------------------------ |
| Page-based      | Each screen is a class extending Ctx |
| Template Engine | HTML-like syntax for UI              |
| Auto Routing    | File-based with method discovery     |
| Session         | Built-in state persistence           |
| Multi-language  | i18n via `lang` attribute            |

---

## Architecture

```
Gramstax
├── Bot (grammy)
├── TemplateManager
├── CacheExternal
└── Page Router
    └── Pages (StartPage, HelpPage, ...)
```

**Request Flow:**

1. User input → Gramstax
2. `hookBeforeRoute()` → validation
3. Router finds page
4. Handler executes
5. Response sent

---

## Core Concepts

### Pages

> Full API: [02-ctx-class.md](./02-ctx-class.md)

```typescript
export class PageName extends Ctx {
  public static data = this.buildData();

  public async textCommand() {}
  public async callback() {}

  public static template = /*jsx*/ `
    <base>...</base>
  `;
}
```

### Templates

> Full syntax: [03-template-engine.md](./03-template-engine.md)

```html
<base>
  <keyboard type="inline">Button1, Button2</keyboard>
  <message>Text with {{variable}}</message>
</base>
```

### Routing

> Full rules: [04-routing-system.md](./04-routing-system.md)

| Method            | Trigger            |
| ----------------- | ------------------ |
| `textCommand`     | `/page-name`       |
| `callback`        | Button exact match |
| `callbackPayload` | Button with `:`    |
| `textFree`        | Any text (session) |

### Sessions

> Full guide: [05-session-management.md](./05-session-management.md)

```typescript
await this.sessionToTextFree(); // Enable free input
// In textFree(): this.msgText
```

---

## Deployment Modes

### Mode 1: Polling

```typescript
new Gramstax({ token: "...", deploy: "polling" });
```

### Mode 2: Webhook

```typescript
new Gramstax({ token: "...", deploy: "webhook:https://domain.com/path" });
```

### Mode 3: Serverless

```typescript
new Gramstax({ token: "...", deploy: "serverless:std/http" });
```

---

## Requirements

| Requirement | Version              |
| ----------- | -------------------- |
| Runtime     | Bun.js (recommended) |
| TypeScript  | 5.0+                 |

```bash
bun add gramstax
```

---

## Navigation

| Previous | Next                                           |
| -------- | ---------------------------------------------- |
| -        | [01-gramstax-class.md](./01-gramstax-class.md) |
