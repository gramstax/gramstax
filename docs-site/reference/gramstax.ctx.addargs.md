

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [addArgs](./gramstax.ctx.addargs.md)

## Ctx.addArgs() method

Appends arg values to a string using the specified separator.

**Signature:**

```typescript
addArgs(str: string | undefined, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: Array<string | undefined>): string;
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

The base string.


</td></tr>
<tr><td>

mtd


</td><td>

Parameters&lt;typeof this.getSeperatorTag&gt;\[0\]


</td><td>

The separator method.


</td></tr>
<tr><td>

pld


</td><td>

Array&lt;string \| undefined&gt;


</td><td>

Array of arg values to append.


</td></tr>
</tbody></table>

**Returns:**

string

The string with appended args.

