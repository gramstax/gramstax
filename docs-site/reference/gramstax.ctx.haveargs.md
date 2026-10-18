

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [haveArgs](./gramstax.ctx.haveargs.md)

## Ctx.haveArgs() method

Checks if a string contains arg separators.

**Signature:**

```typescript
haveArgs(str: string | undefined, mtd: Parameters<typeof this.getSeperatorTag>[0]): boolean;
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

str


</td><td>

string \| undefined


</td><td>

The string to check.


</td></tr>
<tr><td>

mtd


</td><td>

Parameters&lt;typeof this.getSeperatorTag&gt;\[0\]


</td><td>

The separator method.


</td></tr>
</tbody></table>

**Returns:**

boolean

True if the string contains the separator.

