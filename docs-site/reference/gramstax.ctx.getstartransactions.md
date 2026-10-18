

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [getStarTransactions](./gramstax.ctx.getstartransactions.md)

## Ctx.getStarTransactions() method

Lists Stars transactions for the bot (admin reconciliation).

**Signature:**

```typescript
getStarTransactions(options?: Parameters<Ctx[`api`][`getStarTransactions`]>[0] | null): Promise<grammy_types.StarTransactions>;
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

options


</td><td>

Parameters&lt;[Ctx](./gramstax.ctx.md)\[\`api\`\]\[\`getStarTransactions\`\]&gt;\[0\] \| null


</td><td>

_(Optional)_ Pagination/filter options (`offset`, `limit`) or null.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;grammy\_types.StarTransactions&gt;

Star transactions page.

## Remarks

Thin passthrough to `api.getStarTransactions` — no template involved. Use to audit paywalled content sold via [Ctx.renderPaidMedia()](./gramstax.ctx.renderpaidmedia.md) (who paid, what was refunded).

why-not-base: no `Context` equivalent; pure `api` passthrough.

## Example


```typescript
async handleAudit() {
  const page = await this.getStarTransactions({limit: 100})
}
```

