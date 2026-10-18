

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IServerlessSlot](./gramstax.iserverlessslot.md)

## IServerlessSlot type

Config slot that may hold a module reference in a serverless build.

**Signature:**

```typescript
type IServerlessSlot = `cacheSession` | `cacheKeyboard` | `log`;
```

## Remarks

Declared here so `cli/build.ts` can type-check its `REF_SLOTS` list against a single definition instead of the union being spelled out twice.

