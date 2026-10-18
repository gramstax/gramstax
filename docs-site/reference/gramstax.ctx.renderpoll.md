---
title: "Ctx.renderPoll()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderPoll](./gramstax.ctx.renderpoll.md)

## Ctx.renderPoll() method

Sends a template-driven poll using the page `<g-poll>` block.

Template block: `<g-poll>` (read via `getGPoll`).

**Signature:**

```typescript
renderPoll(params?: IRenderPollParams): Promise<Awaited<ReturnType<Ctx[`replyWithPoll`]>> | IBroadcastSendResult>;
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

[IRenderPollParams](./gramstax.irenderpollparams.md)


</td><td>

_(Optional)_ Optional params object (defaults to `{}`): `keyboard` optional keyboard markup from [Ctx.inlineKeyboard()](./gramstax.ctx.inlinekeyboard.md) or [Ctx.bottomKeyboard()](./gramstax.ctx.bottomkeyboard.md) (or null to omit); `data` optional template interpolation data (or null to omit); `AGBaseId` optional template base ID position for block poll (or null to use default); `options` optional extra `sendPoll` fields (or null to omit); `broadcast` optional broadcast fan-out [IBroadcastSendParams](./gramstax.ibroadcastsendparams.md) (or null for a single-chat send).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;Awaited&lt;ReturnType&lt;[Ctx](./gramstax.ctx.md)\[\`replyWithPoll\`\]&gt;&gt; \| [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md)&gt;

The sent poll message object, or the [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md) counts when `broadcast` is present.

## Remarks

Fail-fast validation (`Ctx.assertPoll`) runs BEFORE any API call on the COMPILED strings — programmer errors always throw, never fall back. The question is sent with `parse_mode: HTML` so rich HTML tags work; quiz explanations use `explanation_parse_mode: HTML`.

Polls are send-only: the Bot API offers no poll edit (only `stopPoll`), so there is no `mode` field here.

Observe-only send-error coverage (mirrors `renderDice`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). There is no degraded fallback content for polls, so after notify+log the original error is ALWAYS rethrown untouched.

## Example 1


```typescript
async handleCallbackQueryData() {
  const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
  await this.renderPoll({keyboard: kb, data: {topic: "math"}})
}
```

## Example 2


```typescript
async handleQuiz() {
  // Template: <g-poll type="quiz" correct="0" explanation="Because {{reason}}">
  await this.renderPoll({data: {topic: "2+2", reason: "arithmetic"}})
}
```

## Example 3


```typescript
async handleAnnounceVote() {
  // Fan out the compiled poll to many users
  await this.renderPoll({data: {topic: `lunch`}, broadcast: {ids: [123456, 789012], languageCode: [`en`, `id`]}})
}
```

