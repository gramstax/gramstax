

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderMediaGroupKindParams](./gramstax.irendermediagroupkindparams.md)

## IRenderMediaGroupKindParams type

`IRenderMediaGroupParams` for one group kind — the per-kind group wrappers (`renderPhotoGroup`, `renderVideoGroup`, …) accept this shape and supply `type`.

**Signature:**

```typescript
type IRenderMediaGroupKindParams = IContent & (IRouteGroupAuto | IRouteGroupReply);
```
**References:** [IContent](./gramstax.icontent.md), [IRouteGroupAuto](./gramstax.iroutegroupauto.md), [IRouteGroupReply](./gramstax.iroutegroupreply.md)

## Remarks

The kind filter rides on the content type, so dropping `type` here drops it from every route at once.

