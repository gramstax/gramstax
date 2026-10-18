

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [postBusinessStory](./gramstax.ctx.postbusinessstory.md)

## Ctx.postBusinessStory() method

Posts a story on behalf of a managed business account.

**Signature:**

```typescript
postBusinessStory(businessConnectionId?: string | null, content?: IStoryContent | null, activePeriod?: number | null, options?: Parameters<Ctx[`api`][`postStory`]>[3] | null): Promise<grammy_types.Story>;
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

content


</td><td>

[IStoryContent](./gramstax.istorycontent.md) \| null


</td><td>

_(Optional)_ Story content `{type: "photo"|"video", src}` (or null — throws).


</td></tr>
<tr><td>

activePeriod


</td><td>

number \| null


</td><td>

_(Optional)_ Archive delay in seconds: 21600, 43200, 86400, or 172800 (or null — throws).


</td></tr>
<tr><td>

options


</td><td>

Parameters&lt;[Ctx](./gramstax.ctx.md)\[\`api\`\]\[\`postStory\`\]&gt;\[3\] \| null


</td><td>

_(Optional)_ Optional extra story fields such as `caption` (or null to omit).


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;grammy\_types.Story&gt;

The posted story object.

## Remarks

Business-connection-only: a normal bot cannot call `postBusinessStory` — pass a `business_connection_id` from a `BusinessConnection` update with the `can_manage_stories` right, otherwise the Bot API rejects the call. Thin passthrough otherwise: `content` resolves through `resolveMedia` then uploads (`InputFile` as-is, URLs via `{url}`, `file_id` strings pass through) and only presence, the `photo`/`video` discriminant, and the fixed `active_period` set are fail-fast validated; areas, durations, and captions are adjudicated by the Bot API — programmer errors always throw, never fall back.

why-not-base: explicit `businessConnectionId` (base `Context.postStory` uses the current update only) plus local-path `InputFile` resolution and fail-fast validation.

Observe-only send-error coverage (mirrors `renderDice`): failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, and logged (`retryable` → `log.error`, `fallback-text` → `log.warn`). There is no degraded fallback content for stories, so after notify+log the original error is ALWAYS rethrown untouched.

## Example


```typescript
async handlePostStory() {
  await this.postBusinessStory(`conn-1`, {type: `photo`, src: `https://example.com/pic.jpg`}, 86400)
}
```

