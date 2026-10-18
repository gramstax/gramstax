---
title: "Ctx.fromFullName"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [fromFullName](./gramstax.ctx.fromfullname.md)

## Ctx.fromFullName property

The combined first and last name from the user's Telegram profile.

**Signature:**

```typescript
get fromFullName(): string;
```

## Example


```typescript
async handleCallbackQueryData() {
  // this.from.first_name = "Alya"
  // this.from.last_name = "Putri"
  console.log(this.fromFullName) // "Alya Putri"
}
```

