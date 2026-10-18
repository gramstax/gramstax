---
title: "resolveGateKey()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [resolveGateKey](./gramstax.resolvegatekey.md)

## resolveGateKey() function

Resolve the concurrency-gate key for an update.

**Signature:**

```typescript
declare function resolveGateKey(update: Update): string | undefined;
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

update


</td><td>

Update


</td><td>


</td></tr>
</tbody></table>

**Returns:**

string \| undefined

## Remarks

Layered, narrowest-resource-first. The gate exists because session writes are last-write-wins with no compare-and-swap, so two updates touching the same logical resource must never run at once.

1. `chat.id` — all traffic for one chat serializes regardless of sender. 2. `from.id` — chat-less user-originated updates (`inline_query`, `chosen_inline_result`, `poll_answer`, `join_request`, `my_chat_member`, `chat_member`, `chat_join_request`, and `callback_query` without a message). For an anonymous poll voter `poll_answer.voter_chat.id` stands in. 3. `update_id` — globally unique, so each such update gets a private slot. This degrades to "no serialization" rather than over-serializing unrelated updates against each other.

Note: `poll` carries no actor — Bot API 7.0 removed `Poll.user`, so a poll change reaches this function's step 3 and gets a private slot.

Returns `undefined` only when the update carries no `update_id`, in which case the caller must not gate it.

