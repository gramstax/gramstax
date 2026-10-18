---
title: "IPageData"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IPageData](./gramstax.ipagedata.md)

## IPageData type

Page routing data configuration.

**Signature:**

```typescript
type IPageData<T extends Array<string | undefined> = string[]> = IPageDataBase & {
    callbackQueryData<P extends Ctx = Ctx>(...args: T): IKbCallbackData<ICtorOf<P>, T>;
};
```
**References:** [IPageDataBase](./gramstax.ipagedatabase.md), [Ctx](./gramstax.ctx.md), [IKbCallbackData](./gramstax.ikbcallbackdata.md)

## Remarks

Full page data with typed `callbackQueryData` according to the args configured via `buildData`. Every page SHOULD define `static data` via `buildData(...)` to enable callback query routing.

- `buildData()` (no args) → `callbackQueryData(): {result, page, args: []}` — 0 args only - `buildData((a: string, b: string) => ...)` → `callbackQueryData(a, b): {result, page, args: [a, b]}` - `buildData((a?: string) => ...)` → `callbackQueryData(a?): {result, page, args}` (optional still supported)

The page class is NOT carried by `static data` (TS cannot infer it without a circular annotation) — pass it explicitly when you want route validation: `Page.data.callbackQueryData<Page>("42")` is compile-error checked against `handleArgsCallbackQueryData`; without the type argument the object is accepted as-is and the route is only resolved at runtime.

