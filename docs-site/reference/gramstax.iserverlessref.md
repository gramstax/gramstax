

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IServerlessRef](./gramstax.iserverlessref.md)

## IServerlessRef type

A config slot resolved to an imported module for a serverless bundle.

**Signature:**

```typescript
type IServerlessRef = {
    slot: IServerlessSlot;
    module: string;
    exportName?: string;
    args: unknown[];
};
```
**References:** [IServerlessSlot](./gramstax.iserverlessslot.md)

