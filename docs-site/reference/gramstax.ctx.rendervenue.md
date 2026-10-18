---
title: "Ctx.renderVenue()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderVenue](./gramstax.ctx.rendervenue.md)

## Ctx.renderVenue() method

Sends a template-driven venue using the page `<g-venue>` block.

Template block: `<g-venue>` (read via `getGVenue`).

**Signature:**

```typescript
renderVenue(params?: IRenderVenueParams): Promise<Message.VenueMessage>;
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

[IRenderVenueParams](./gramstax.irendervenueparams.md)


</td><td>

_(Optional)_ Optional params object (defaults to `{}`): `keyboard` optional keyboard markup from [Ctx.inlineKeyboard()](./gramstax.ctx.inlinekeyboard.md) or [Ctx.bottomKeyboard()](./gramstax.ctx.bottomkeyboard.md) (or null to omit); `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for block venue (or null to use default); `options` optional extra `sendVenue` fields such as `foursquare_id` (or null to omit).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Message.VenueMessage&gt;

The sent venue message object.

## Remarks

Fail-fast validation (`Ctx.assertVenue`: non-empty title/address plus `Ctx.assertLocation` range checks) runs on the COMPILED strings BEFORE any API call — programmer errors always throw, never fall back.

Observe-only send-error coverage (mirrors `renderPoll`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). There is no degraded fallback content for venues, so after notify+log the original error is ALWAYS rethrown untouched.

## Example 1


```typescript
async handleCallbackQueryData() {
  const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
  await this.renderVenue({keyboard: kb, data: {name: `Cafe`, street: `Jl. Merdeka 1`, lat: `-6.2`, long: `106.8`}})
}
```

## Example 2


```typescript
async handleVenueId() {
  // Template: <g-base id="promo"><g-venue lang="id" title="{{name}}" address="{{street}}" latitude="{{lat}}" longitude="{{long}}"/></g-base>
  await this.renderVenue({data: {name: `Kafe`, street: `Jl. Merdeka 1`, lat: `-6.2`, long: `106.8`}, AGBaseId: `promo`})
}
```

