---
title: "TemplateEngine.__emitHook"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_\_emitHook](./gramstax.templateengine.__emithook.md)

## TemplateEngine.\_\_emitHook property

AOT collect hook: when set, `_compileToFunction` records the body and returns a tagged stub instead of calling `new Function`.

**Signature:**

```typescript
static __emitHook?: (body: string, meta: {
        isArray: boolean;
    }) => (...args: unknown[]) => unknown;
```

## Remarks

Build tooling only (`AotEmitter` installs it around compilation and always uninstalls in `finally`). `undefined` (default) runs the exact JIT path — no behavior change.

