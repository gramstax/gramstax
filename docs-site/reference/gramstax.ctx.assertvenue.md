

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [assertVenue](./gramstax.ctx.assertvenue.md)

## Ctx.assertVenue() method

Venue fields accepted by [Ctx.renderVenue()](./gramstax.ctx.rendervenue.md) from the compiled `<g-venue>` block.

**Signature:**

```typescript
static assertVenue(venue: {
        title: unknown;
        address: unknown;
        latitude: unknown;
        longitude: unknown;
    }): {
        title: string;
        address: string;
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

venue


</td><td>

&#123; title: unknown; address: unknown; latitude: unknown; longitude: unknown; &#125;


</td><td>


</td></tr>
</tbody></table>

**Returns:**

&#123; title: string; address: string; latitude: number; longitude: number; &#125;

