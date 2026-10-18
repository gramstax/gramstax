

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [ready](./gramstax.gramstax.ready.md)

## Gramstax.ready property

Resolves once the startup hooks (`hookBeforeStart`/`hookAfterStart`) complete for constructor-driven modes (`raw`, `test`).

**Signature:**

```typescript
ready: Promise<void>;
```

## Remarks

The constructor cannot `await`, so sync construction is preserved (hooks still fire in order) while async completion is observable here.

