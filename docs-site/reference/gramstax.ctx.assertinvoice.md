---
title: "Ctx.assertInvoice()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertInvoice](./gramstax.ctx.assertinvoice.md)

## Ctx.assertInvoice() method

Fail-fast checks for a compiled `<g-invoice>` block against Bot API limits.

**Signature:**

```typescript
static assertInvoice(invoice: IInvoiceBlock): void;
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

invoice


</td><td>

[IInvoiceBlock](./gramstax.iinvoiceblock.md)


</td><td>

Compiled invoice block from `getGInvoice`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Measures the COMPILED strings (post-interpolation): title 1–32 chars, description 1–255 chars, payload 1–128 bytes, currency a 3-letter code, 1 or more prices each with a non-empty label and a positive integer amount in smallest units. Programmer error — always throws, never falls back or notifies.

