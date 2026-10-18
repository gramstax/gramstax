

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteChunked](./gramstax.iroutechunked.md)

## IRouteChunked type

Route atom: chunked reply.

**Signature:**

```typescript
type IRouteChunked = INeverFields<`editOptions` | `fallbackOptions` | `fallback`> & {
    mode?: `reply`;
    chunkSize: number;
    keyboard?: IInBoKb | null;
    rich?: IOptReplyRich[0] | null;
    richOptions?: IOptRichSend | null;
    options?: IOptReply | null;
    broadcast?: null | undefined;
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IInBoKb](./gramstax.iinbokb.md), [IOptReplyRich](./gramstax.ioptreplyrich.md), [IOptRichSend](./gramstax.ioptrichsend.md), [IOptReply](./gramstax.ioptreply.md)

## Remarks

A present (not `undefined`/`null`) `chunkSize` selects the chunked path: the fully-rendered block is sent as sequential reply chunks. The block is rendered fully FIRST (placeholders never split), then split deterministically: the last `\n\n` in a `chunkSize`-char window wins, then the last `\n`, then the last space, then a hard cut; each piece is trimmed and empties are skipped. The keyboard is sent ONLY on the last chunk, and every chunk carries `parse_mode: HTML` (rich templates send each chunk through `replyWithRichMessage`). Values are sanitised on read: `Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 4096`. Telegram cannot edit a multi-message split, so the edit-only keys (`editOptions`, `fallbackOptions`) and `fallback` are never read. `richOptions` stays live — every chunk still goes out through the rich send.

