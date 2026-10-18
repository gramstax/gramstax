---
title: "LabelGKeyboard._reverseObj()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LabelGKeyboard](./gramstax.labelgkeyboard.md) &gt; [\_reverseObj](./gramstax.labelgkeyboard._reverseobj.md)

## LabelGKeyboard.\_reverseObj() method

Reverse button order for all languages in an object.

**Signature:**

```typescript
static _reverseObj<T extends Record<string, string>>(input: T): T;
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

input


</td><td>

T


</td><td>

Object with language keys and button values. Applies [LabelGKeyboard.\_reverse()](./gramstax.labelgkeyboard._reverse.md) to each value.


</td></tr>
</tbody></table>

**Returns:**

T

Object with reversed labels.

## Example


```typescript
const reversed = LabelGKeyboard._reverseObj({
  en: "Back, Next",
  id: "Kembali, Lanjut",
});
// => { en: "Next, Back", id: "Lanjut, Kembali" }
```

