

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [gmedia](./gramstax.e2ehelper.gmedia.md)

## E2eHelper.gmedia() method

Get media configuration from a page template.

**Signature:**

```typescript
gmedia(page: string, aGBaseId: string, data?: Record<string, any>, aLang?: string): Record<string, any>;
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

Record&lt;string, any&gt;

Media configuration object.

