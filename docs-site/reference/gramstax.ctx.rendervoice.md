

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [renderVoice](./gramstax.ctx.rendervoice.md)

## Ctx.renderVoice() method

Sends a voice message using the page template.

Template block: `<g-media>` (read via `renderMedia`).

**Signature:**

```typescript
renderVoice(params?: IRenderMediaKindParams<`voice`>): Promise<true | Message | IBroadcastEditResult | IBroadcastSendResult | Message[] | undefined>;
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

[IRenderMediaKindParams](./gramstax.irendermediakindparams.md)&lt;\`voice\`&gt;


</td><td>

_(Optional)_ Optional per-kind params (defaults to `{}`). See [IRenderMediaKindParams](./gramstax.irendermediakindparams.md) for field details: `keyboard` optional keyboard markup (or null to omit); `data` optional template interpolation data (or null to omit); `AGBaseId` optional template g-base ID position for block media type voice (or null to use default); `mode` send-versus-edit resolution (default `auto`); `options` optional voice-specific reply options (or null to omit); `resendOptions` optional delete-then-resend reply options (or null to omit); `mediaOptions` optional extra `editMessageMedia` call options (or null to omit); `fallback` fallback when the edit fails (default `delete-reply`); `broadcast` optional broadcast-REVISE fan-out — `{targets, reviseOptions}` only, since the fixed kind IS honoured there (or null for a single-chat send/edit). The broadcast-SEND loop (`{ids, languageCode, …}`) is not accepted here — it reads the kind from the `<g-media>` block and would ignore this method's fixed kind; use `renderMedia` for it.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;true \| Message \| [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md) \| [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md) \| Message\[\] \| undefined&gt;

The sent or edited message object.

## Example


```typescript
async handleCallbackQueryData() {
  await this.renderVoice()
}
```

