

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxPathRef](./gramstax.igramstaxpathref.md)

## IGramstaxPathRef type

Either a bare module path (default export, zero-arg) or a wrapped override ref.

**Signature:**

```typescript
type IGramstaxPathRef = string | {
    override: IGramstaxModuleRef;
};
```
**References:** [IGramstaxModuleRef](./gramstax.igramstaxmoduleref.md)

## Remarks

The string form must be a non-empty string resolving relative to the project root. The object form is `{override: {@link IGramstaxModuleRef}}` with `override.module`, optional `override.export`, and optional `override.args`; unknown fields are rejected by the loader.

## Example


```typescript
const bare: IGramstaxPathRef = `./src/cache.ts`
const full: IGramstaxPathRef = {override: {module: `./src/cache.ts`, export: `RedisCache`}}
```

