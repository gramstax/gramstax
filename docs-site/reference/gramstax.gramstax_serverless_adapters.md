

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GRAMSTAX\_SERVERLESS\_ADAPTERS](./gramstax.gramstax_serverless_adapters.md)

## GRAMSTAX\_SERVERLESS\_ADAPTERS variable

Canonical serverless adapter names.

**Signature:**

```typescript
GRAMSTAX_SERVERLESS_ADAPTERS: readonly ["cloudflare-mod", "aws-lambda-async"]
```

## Remarks

Single runtime source for the adapter vocabulary. Lives here rather than in `cli/config` so `core/bot` can validate without importing a CLI module. `IGramstaxServerlessAdapter` is derived from it, and [GRAMSTAX\_SERVERLESS\_FIELDS](./gramstax.gramstax_serverless_fields.md) is keyed by it, so adding an adapter without declaring its fields is a compile error.

