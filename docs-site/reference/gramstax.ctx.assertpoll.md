

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertPoll](./gramstax.ctx.assertpoll.md)

## Ctx.assertPoll() method

Fail-fast checks for a compiled `<g-poll>` block against Bot API limits.

**Signature:**

```typescript
static assertPoll(poll: IPollBlock): void;
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

poll


</td><td>

[IPollBlock](./gramstax.ipollblock.md)


</td><td>

Compiled poll block from `getGPoll`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Measures the COMPILED strings (post-interpolation): question 1–300 chars, 2–10 options of 1–100 chars each, quiz `correct` present and within range, explanation at most 200 chars. Programmer error — always throws, never falls back or notifies.

