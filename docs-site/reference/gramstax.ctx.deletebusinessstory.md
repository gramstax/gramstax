

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [deleteBusinessStory](./gramstax.ctx.deletebusinessstory.md)

## Ctx.deleteBusinessStory() method

Deletes a story previously posted on behalf of a managed business account.

**Signature:**

```typescript
deleteBusinessStory(businessConnectionId?: string | null, storyId?: number | null): Promise<true>;
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

businessConnectionId


</td><td>

string \| null


</td><td>

_(Optional)_ Business connection id (or null — throws).


</td></tr>
<tr><td>

storyId


</td><td>

number \| null


</td><td>

_(Optional)_ Id of the posted story (or null — throws).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;true&gt;

`true` on success.

## Remarks

Business-connection-only like [Ctx.postBusinessStory()](./gramstax.ctx.postbusinessstory.md): the same `business_connection_id` (with `can_manage_stories`) that posted the story is required. Only presence and the positive-integer `storyId` are fail-fast validated — programmer errors always throw, never fall back.

why-not-base: base `Context.deleteStory` takes no `business_connection_id` at all; this deletes under any connection.

Observe-only send-error coverage (mirrors `renderDice`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). The original error is ALWAYS rethrown untouched after notify+log.

## Example


```typescript
async handleDeleteStory() {
  await this.deleteBusinessStory(`conn-1`, 21)
}
```

