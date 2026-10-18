---
title: "BlockGKeyboard._build()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [BlockGKeyboard](./gramstax.blockgkeyboard.md) &gt; [\_build](./gramstax.blockgkeyboard._build.md)

## BlockGKeyboard.\_build() method

Build keyboard blocks by calling a method from the linked `LabelGKeyboard`.

**Signature:**

```typescript
static _build(key: string, lang?: string, type?: string, reverse?: boolean): string;
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

key


</td><td>

string


</td><td>

Method name in LabelGKeyboard. Must exist or throws.


</td></tr>
<tr><td>

lang


</td><td>

string


</td><td>

_(Optional)_ Target language. If set, returns single language block.


</td></tr>
<tr><td>

type


</td><td>

string


</td><td>

_(Optional)_ Keyboard type. Values are `"inline"` or `"bottom"`. Defaults to `"inline"`.


</td></tr>
<tr><td>

reverse


</td><td>

boolean


</td><td>

_(Optional)_ Reverse button order. If true, reverses comma-separated labels.


</td></tr>
</tbody></table>

**Returns:**

string

Keyboard block string.

## Exceptions

Error if [BlockGKeyboard.label](./gramstax.blockgkeyboard.label.md) is not set.

Error if the specified method name does not exist in the label class.

## Example


```typescript
// Assuming BlockGKeyboard.label = MyKeyboards with backNext() method

const kbk = BlockGKeyboard
kbk._build("backNext");
// => '<g-keyboard type="inline" lang="en">Back, Next</g-keyboard> ...'

kbk._build("backNext", "en", "bottom");
// => '<g-keyboard type="bottom" lang="en">Back, Next</g-keyboard>'
```

