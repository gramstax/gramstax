# route-broadcast

Fan out with the `broadcast` field (per-user langs, counts, throttling) — never loop `renderText` by hand.

## Why

A hand-rolled loop over `renderText` re-resolves the template per user, ignores rate limits, aborts on the first blocked chat, and reports nothing. A broadcast render resolves the template once per language, pauses every 30 sends (plus optional chunks), skips blocked chats, and returns `{successCount, failedCount, totalCount, skippedCount}`.

## Incorrect

```typescript
// one failure aborts everyone; no counts; hammers rate limits
for (const id of userIds) {
  await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), data: {amount: 100}})
}
```

## Correct

```typescript
await this.renderText({
  AGBaseId: Base.broadcast,
  keyboard: this.inlineKeyboardT([StartPage], `1`, Base.broadcast),
  data: {amount: 100},
  broadcast: {
    ids: userIds, // number[]
    languageCode: langs, // language code per user (falls back to last message)
    throwError: false, // true rethrows with counts after the run
    chunkSize: 100,
    chunkDelayMs: 500,
    excludeIds // skip list (counted as skipped)
  }
})
```

## Notes

- Where each broadcast lives: text → `renderText({broadcast})`, media → `renderMedia({broadcast})` (no `type` — the kind comes from the template's `<g-media>`; pipe-delimited `src` becomes a media group, and keyboards are ignored for grouped media), poll → `renderPoll({broadcast})`, revise already-sent messages → `renderMedia({broadcast: {targets}, mode: 'edit', type})`.
- `renderBroadcastDelete({targets})` is separate on purpose — it deletes, it does not render.
- Empty renders count as failed, not thrown; pass `throwError: true` inside `broadcast` to rethrow `{...counts, err}` instead.
- Telegram-side throttling still applies — pair with `throttle` config for large blasts (see `deploy-runtime.md`).
