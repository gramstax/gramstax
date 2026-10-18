

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_\_linkHook](./gramstax.templateengine.__linkhook.md)

## TemplateEngine.\_\_linkHook property

AOT link hook: when set, `_compileToFunction` returns the pre-registered inline function matching the body instead of calling `new Function`.

**Signature:**

```typescript
static __linkHook?: (body: string, isArray: boolean) => (...args: unknown[]) => unknown;
```

## Remarks

Edge-runtime path (`AotEmitter` output): emitted modules pre-register every collected body, then rebuild wrapper blocks through the normal compilers with this hook resolving hits. A miss throws (template drift — regenerate). Never set together with `__emitHook`.

