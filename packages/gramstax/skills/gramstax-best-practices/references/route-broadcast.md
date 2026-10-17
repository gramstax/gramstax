# route-broadcast

Fan out with `renderBroadcast*` (per-user langs, counts, throttling) — never loop `renderText` by hand.

## Why

A hand-rolled loop over `renderText` re-resolves the template per user, ignores rate limits, aborts on the first blocked chat, and reports nothing. The broadcast methods render once per language, pause every 30 sends (plus optional chunks), skip blocked chats, and return `{successCount, failedCount, totalCount, skippedCount}`.

## Incorrect

```typescript
// one failure aborts everyone; no counts; hammers rate limits
for (const id of userIds) {
  await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), data: {amount: 100}})
}
```

## Correct

```typescript
await this.renderBroadcast({
  ids: userIds, // number[]
  languageCode: langs, // language code per user (falls back to last message)
  keyboard: this.inlineKeyboardT([StartPage], `1`, Base.broadcast),
  data: {amount: 100},
  AGBaseId: Base.broadcast,
  throwError: false, // true rethrows with counts after the run
  chunkSize: 100,
  chunkDelayMs: 500,
  excludeIds // skip list (counted as skipped)
})
```

## Notes

- Media variant: `renderBroadcastMedia` (pipe-delimited `src` becomes a media group; keyboards ignored for grouped media).
- Empty renders count as failed, not thrown; pass `throwError: true` to rethrow `{...counts, err}` instead.
- Telegram-side throttling still applies — pair with `throttle` config for large blasts (see `deploy-runtime.md`).
