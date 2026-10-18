

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderDice](./gramstax.ctx.renderdice.md)

## Ctx.renderDice() method

Sends a template-driven dice animation using the page `<g-dice>` block.

Template block: `<g-dice>` (read via `getGDice`).

**Signature:**

```typescript
renderDice(params?: IRenderDiceParams): Promise<Message.DiceMessage>;
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

[IRenderDiceParams](./gramstax.irenderdiceparams.md)


</td><td>

_(Optional)_ Optional params object (defaults to `{}`): `keyboard` optional keyboard markup from [Ctx.inlineKeyboard()](./gramstax.ctx.inlinekeyboard.md) or [Ctx.bottomKeyboard()](./gramstax.ctx.bottomkeyboard.md) (or null to omit); `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for block dice (or null to use default); `options` optional extra `sendDice` fields (or null to omit).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Message.DiceMessage&gt;

The sent dice message object.

## Remarks

The emoji comes from the COMPILED block (`🎲` default when the attribute is absent) and is checked by `Ctx.assertDiceEmoji` BEFORE any API call — programmer errors always throw, never fall back.

Observe-only send-error coverage (mirrors `renderPoll`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). There is no degraded fallback content for dice, so after notify+log the original error is ALWAYS rethrown untouched.

## Example 1


```typescript
async handleCallbackQueryData() {
  const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
  await this.renderDice({keyboard: kb, data: {dice: `🎯`}})
}
```

## Example 2


```typescript
async handleLuckyRoll() {
  // Template: <g-base><g-dice emoji="{{dice}}"/></g-base>
  await this.renderDice({data: {dice: `🏀`}})
}
```

