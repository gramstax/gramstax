

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [ephemeralParams](./gramstax.ctx.ephemeralparams.md)

## Ctx.ephemeralParams() method

Build `EphemeralMessageParameters` for Bot API 10.3 ephemeral messages.

**Signature:**

```typescript
static ephemeralParams(receiverUserId?: number | Record<string, unknown>, callbackQueryId?: string, replace?: boolean): EphemeralMessageParameters | undefined;
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

receiverUserId


</td><td>

number \| Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Target user id, or a legacy object with snake\_case keys.


</td></tr>
<tr><td>

callbackQueryId


</td><td>

string


</td><td>

_(Optional)_ Callback query id that triggered the message (optional).


</td></tr>
<tr><td>

replace


</td><td>

boolean


</td><td>

_(Optional)_ Pass `true` to show in place of the original message (optional).


</td></tr>
</tbody></table>

**Returns:**

EphemeralMessageParameters \| undefined

The ephemeral parameters object, or `undefined` when no receiver is provided.

## Remarks

Creates the `ephemeral_message_parameters` payload accepted by 13 send\* methods plus `sendRichMessage`. Ephemeral messages are short-lived notifications sent directly to a user — they disappear after the user reads (or ignores) them and are not kept in the chat history.

The deprecated shim also accepts the pre-10.3 snake\_case object `{receiver_user_id, callback_query_id, ...}` and emits a `console.warn`.

## Example 1

Replace callback query message in place

```typescript
async handleCallbackQueryData() {
  await this.api.sendMessage(this.chatId, `Order received!`, {
    ephemeral_message_parameters: this.ephemeralParams(this.from?.id, this.callbackQuery?.id, true)
  })
}
```

## Example 2

Legacy 10.2 snake\_case object (warns once)

```typescript
this.ephemeralParams({receiver_user_id: 123, callback_query_id: `cb_1`})
```

