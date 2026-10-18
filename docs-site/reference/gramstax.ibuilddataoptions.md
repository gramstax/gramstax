---
title: "IBuildDataOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IBuildDataOptions](./gramstax.ibuilddataoptions.md)

## IBuildDataOptions type

Options for building page routing data configuration.

**Signature:**

```typescript
type IBuildDataOptions<C extends (...args: string[]) => Array<string | undefined> = (...args: string[]) => Array<string | undefined>> = {
    name?: string | null;
    callbackQueryData?: C | null;
    intentText?: string | Record<string, string> | null;
    intentCommandText?: string | Record<string, string> | null;
};
```
