---
title: "IPageDataBase"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IPageDataBase](./gramstax.ipagedatabase.md)

## IPageDataBase type

Base page routing data — core properties only, no callbackQueryData.

**Signature:**

```typescript
type IPageDataBase = {
    name: string;
    intentText: string;
    intentCommandText: string;
    _positionArgText: number;
    intentCallbackQueryData: string;
    intentTextMap?: Record<string, string>;
    intentCommandTextMap?: Record<string, string>;
};
```

## Remarks

Used as the static type for `Ctx.data`. Pages that do NOT define `static data = this.buildData(...)` will NOT have `callbackQueryData` available, preventing accidental usage without proper setup. Pages that define `buildData(...)` via [IPageData](./gramstax.ipagedata.md) get fully typed `callbackQueryData` with the configured args (no extra overloads).

