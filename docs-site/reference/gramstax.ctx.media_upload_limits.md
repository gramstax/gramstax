

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [MEDIA\_UPLOAD\_LIMITS](./gramstax.ctx.media_upload_limits.md)

## Ctx.MEDIA\_UPLOAD\_LIMITS property

Bot API upload size limits in bytes, per media type.

**Signature:**

```typescript
static readonly MEDIA_UPLOAD_LIMITS: Record<string, number>;
```

## Remarks

Values follow the documented Bot API defaults: photo 10MB, animation 10MB, sticker 512KB, document/video/audio/voice 50MB. `video_note` uses 50MB as a best-effort byte check — its real constraint is the 640x640 dimension enforced server-side. Types without an entry (`location`, `contact`) carry no bytes and are never size-checked.

