

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteGroupReply](./gramstax.iroutegroupreply.md)

## IRouteGroupReply type

Media-group route atom: forced group send.

**Signature:**

```typescript
type IRouteGroupReply = INeverFields<`rich` | `richOptions` | `editOptions` | `fallback` | `fallbackOptions`> & {
    mode: `reply`;
    keyboard?: never;
    options?: IOptReply | null;
    broadcast?: null | undefined;
    chunkSize?: null | undefined;
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IOptReply](./gramstax.ioptreply.md)

