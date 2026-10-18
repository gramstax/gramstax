

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [gkb](./gramstax.e2ehelper.gkb.md)

## E2eHelper.gkb() method

Build keyboard button labels from a page template.

**Signature:**

```typescript
gkb(page: string, aGBaseId: string, aType?: `inline` | `bottom`, data?: Record<string, any>, aLang?: string): string[];
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

page


</td><td>

string


</td><td>

Page name.


</td></tr>
<tr><td>

aGBaseId


</td><td>

string


</td><td>

Base block ID.


</td></tr>
<tr><td>

aType


</td><td>

\`inline\` \| \`bottom\`


</td><td>

_(Optional)_ Keyboard type (`"inline"` or `"bottom"`).


</td></tr>
<tr><td>

data


</td><td>

Record&lt;string, any&gt;


</td><td>

_(Optional)_ Template data variables.


</td></tr>
<tr><td>

aLang


</td><td>

string


</td><td>

_(Optional)_ Language code (default `"default"`).


</td></tr>
</tbody></table>

**Returns:**

string\[\]

Array of button text labels (nested keyboard flattened).

