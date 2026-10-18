

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IPageManifestEntry](./gramstax.ipagemanifestentry.md)

## IPageManifestEntry type

One page entry of a static app manifest.

**Signature:**

```typescript
type IPageManifestEntry = {
    path: string;
    routeName: string;
    page: typeof Ctx;
};
```
**References:** [Ctx](./gramstax.ctx.md)

## Remarks

Emitted by `buildManifest` as `{path, routeName, page}` per discovered page file. Consumed by `_pageLoadsFromManifest` — `path` feeds `_pageRegisterEntry` (and the empty-`routeName` error), `routeName` is the template key for the class-inline template compile, `page` is the imported page class whose `static template` rides along.

