# route-broadcast

Fan out with `renderBroadcast*` (per-user langs, counts, throttling) — never loop `render` by hand.

## Why

A hand-rolled loop over `render` re-resolves the template per user, ignores rate limits, aborts on the first blocked chat, and reports nothing. The broadcast methods render once per language, pause every 30 sends (plus optional chunks), skip blocked chats, and return `{successCount, failedCount, totalCount, skippedCount}`.

## Incorrect

```typescript
// one failure aborts everyone; no counts; hammers rate limits
for (const id of userIds) {
  await this.render(kb, da)
}
```

## Correct

```typescript
await this.renderBroadcast(
  userIds, // number[]
  langs, // language code per user (falls back to last message)
  kb, da, bi,
  null, // options
  false, // throwError: true rethrows with counts after the run
  100, // chunkSize
  500, // chunkDelayMs
  excludeIds // skip list (counted as skipped)
)
```

## Notes

- Media variant: `renderBroadcastMedia` (pipe-delimited `src` becomes a media group; keyboards ignored for grouped media).
- Empty renders count as failed, not thrown; pass `throwError: true` to rethrow `{...counts, err}` instead.
- Telegram-side throttling still applies — pair with `throttle` config for large blasts (see `deploy-runtime.md`).
