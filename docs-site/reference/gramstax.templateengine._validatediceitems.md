

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateDiceItems](./gramstax.templateengine._validatediceitems.md)

## TemplateEngine.\_validateDiceItems() method

Validates the static `<g-dice>` emoji against the Bot API set.

**Signature:**

```typescript
static _validateDiceItems(template: string): Array<{
        line: number;
        message: string;
    }>;
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

template


</td><td>

string


</td><td>

The raw template source to inspect.


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; line: number; message: string; &#125;&gt;

Validation errors (empty when valid).

## Remarks

Static `emoji` values (no `{{}}` / `{~ ~}` interpolation) must be one of the six Bot API dice emoji (`🎲🎯🏀⚽🎳🎰` per [TemplateEngine.DICE\_EMOJI](./gramstax.templateengine.dice_emoji.md)); dynamic emoji are checked at runtime on the compiled strings. Called by [TemplateEngine.validateBlockGDiceAttributes()](./gramstax.templateengine.validateblockgdiceattributes.md); errors carry 1-based line numbers.

