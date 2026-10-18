---
title: "Ctx.resolveMedia()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [resolveMedia](./gramstax.ctx.resolvemedia.md)

## Ctx.resolveMedia() method

Resolve a media `src` through the instance path jail.

**Signature:**

```typescript
resolveMedia(src: string | InputFile | Buffer | Uint8Array | undefined, filename?: string): string | InputFile;
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

src


</td><td>

string \| InputFile \| Buffer \| Uint8Array \| undefined


</td><td>

Template media `src` (file path, `file_id`, URL, or binary payload).


</td></tr>
<tr><td>

filename


</td><td>

string


</td><td>

_(Optional)_ Optional upload filename forwarded to `resolveMediaInput`.


</td></tr>
</tbody></table>

**Returns:**

string \| InputFile

`InputFile` for allowed local files and binary payloads, otherwise `src` unchanged.

## Remarks

Forwards `this.mediaRoots` into `Ctx.resolveMediaInput`. Jail denial is detected by comparing the jailed form against the free form: when the free form would upload (`InputFile`) but the jailed form passes through (`string`), the path was denied and a `log.warn` names the rejected path (never file contents). Null-safe: an absent `log` stays silent.

