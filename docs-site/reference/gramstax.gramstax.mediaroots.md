---
title: "Gramstax.mediaRoots"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [mediaRoots](./gramstax.gramstax.mediaroots.md)

## Gramstax.mediaRoots property

Opt-in local-path jail for media uploads.

**Signature:**

```typescript
mediaRoots?: string[] | null;
```

## Remarks

Forwarded into every page `Ctx` via `createCtx` (mirrors `log`). `null`/empty means free; when set, local file uploads outside the roots pass through as `file_id` with a `log.warn`.

