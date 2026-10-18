---
title: "LabelGKeyboard"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LabelGKeyboard](./gramstax.labelgkeyboard.md)

## LabelGKeyboard class

Provides static utilities for keyboard data manipulation, specifically for reversing keyboard button order.

**Signature:**

```typescript
declare class LabelGKeyboard 
```

## Remarks

Used as base class for user-defined keyboard data classes. Provides button order manipulation for multi-language keyboards.

## Example


```typescript
import { LabelGKeyboard } from "gramstax";

export class KeyboardGLabel extends LabelGKeyboard {
  static home = {
    id: "Rumah",
    en: "Home"
  }
  static backNext = {
    id: "Kembali, Lanjut",
    en: "Back, Next"
  }
  static oneTwo = this._reverseObj({
    id: "Satu, Dua",
    en: "One, Two"
  })
  static threeFour = {
    id: this._reverse("Tiga, Empat"),
    en: "Three, Four"
  }
}

const kbl = KeyboardGLabel
kbl.home.id // => "Rumah"
kbl.backNext.id // => "Kembali, Lanjut"
kbl.oneTwo.id // => "Dua, Satu"
kbl.oneTwo.en // => "Two, One"
kbl.threeFour.id // => "Empat, Tiga"
kbl.threeFour.en // => "Three, Four"
```

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[\_reverse(input)](./gramstax.labelgkeyboard._reverse.md)


</td><td>

`static`


</td><td>

Reverse the order of comma-separated button labels.


</td></tr>
<tr><td>

[\_reverseObj(input)](./gramstax.labelgkeyboard._reverseobj.md)


</td><td>

`static`


</td><td>

Reverse button order for all languages in an object.


</td></tr>
</tbody></table>

