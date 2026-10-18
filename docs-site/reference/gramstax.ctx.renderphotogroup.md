---
title: "Ctx.renderPhotoGroup()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderPhotoGroup](./gramstax.ctx.renderphotogroup.md)

## Ctx.renderPhotoGroup() method

Sends a photo media group using pipe-delimited `src` values from the page template.

Template block: `<g-media-group>` (read via `renderMediaGroup`).

**Signature:**

```typescript
renderPhotoGroup(params?: IRenderMediaGroupKindParams): Promise<Message | Message[] | undefined>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

params


</td><td>

[IRenderMediaGroupKindParams](./gramstax.irendermediagroupkindparams.md)


</td><td>

_(Optional)_ Optional per-kind params (defaults to `{}`). See [IRenderMediaGroupKindParams](./gramstax.irendermediagroupkindparams.md) for field details: `data` optional template interpolation data (or null to omit); `AGBaseId` optional template g-base ID position for block media type photo (or null to use default); `mode` send-versus-edit resolution (default `auto`); `options` optional photo-specific options (or null to omit); `fallback` fallback when the edit fails (default `delete-reply`).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Message \| Message\[\] \| undefined&gt;

The sent media group messages.

## Example


```typescript
async handleArgsCallback() {
  await this.renderPhotoGroup()
}
```

