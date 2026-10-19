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

The static type of `Ctx.data`. The instance field is assigned through a cast to [IPageData](./gramstax.ipagedata.md) in `core/ctx.ts`, so `callbackQueryData` typechecks even on a page that omits `static data`; there the value is `undefined` at runtime. Pages that define `buildData(...)` get a real implementation with the configured args.

