

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [GRAMSTAX\_SERVERLESS\_FIELDS](./gramstax.gramstax_serverless_fields.md)

## GRAMSTAX\_SERVERLESS\_FIELDS variable

Per-adapter allowed config fields.

**Signature:**

```typescript
GRAMSTAX_SERVERLESS_FIELDS: Record<IGramstaxServerlessAdapter, readonly string[]>
```

## Remarks

A field absent from an adapter's list does not exist for that adapter — it is rejected rather than ignored. This is what makes the adapter-keyed shape precise instead of a bag of optional fields.

