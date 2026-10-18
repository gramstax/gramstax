

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertMediaSrcSize](./gramstax.ctx.assertmediasrcsize.md)

## Ctx.assertMediaSrcSize() method

Size-check a media `src` when its bytes are knowable, else skip.

**Signature:**

```typescript
static assertMediaSrcSize(type: string, src: unknown): void;
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

type


</td><td>

string


</td><td>

Media type (e.g. `photo`).


</td></tr>
<tr><td>

src


</td><td>

unknown


</td><td>

Template media `src`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Uses `statSync().size` for local file paths and `.length` for `Buffer`/`Uint8Array` payloads. `InputFile` instances, `file_id` values, and URLs are skipped (size unknowable). Missing paths and stat failures pass through (the send call reports them).

