

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertLocation](./gramstax.ctx.assertlocation.md)

## Ctx.assertLocation() method

Parse and range-check `latitude`/`longitude` (replaces bare `parseInt`).

**Signature:**

```typescript
static assertLocation(latitude: unknown, longitude: unknown): {
        latitude: number;
        longitude: number;
    };
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

latitude


</td><td>

unknown


</td><td>

Raw template `latitude` (string or number).


</td></tr>
<tr><td>

longitude


</td><td>

unknown


</td><td>

Raw template `longitude` (string or number).


</td></tr>
</tbody></table>

**Returns:**

\{ latitude: number; longitude: number; }

Validated `{latitude, longitude}` numbers.

## Remarks

Missing, non-numeric, `NaN`, or out-of-range values throw. Programmer error — always throws, never falls back.

