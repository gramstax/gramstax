

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [BlockGKeyboard](./gramstax.blockgkeyboard.md)

## BlockGKeyboard class

Provides static methods for generating keyboard template blocks from `LabelGKeyboard` definitions.

**Signature:**

```typescript
declare class BlockGKeyboard 
```

## Remarks

This class generates HTML-like `<g-keyboard>` blocks for the template engine. Requires `LabelGKeyboard` to be set via [BlockGKeyboard.label](./gramstax.blockgkeyboard.label.md) before using [BlockGKeyboard.\_build()](./gramstax.blockgkeyboard._build.md).

## Example


```typescript
// blocks/g-keyboard.ts
import { BlockGKeyboard, LabelGKeyboard } from "gramstax";

class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static backNext = {en: "Back, Next", id: "Kembali, Lanjut"}
  }
  static backNext = (lang?: string, type?: string) => this._build(`backNext`, lang, type)
}

// base/page.ts
import {KeyboardGBlock} from "~/blocks/g-keyboard"
export abstract class PageBase extends CtxCore {
  static kbk = KeyboardGBlock
  static kbl = KeyboardGBlock.label
}

// pages/some.ts
import {PageBase} from "~/base/page"
export class SomePage extends PageBase {
  static template = `
    <g-base>
      ${this.kbk.backNext()}
      <g-message>Default message hello world</g-message>
    </g-base>
    <g-base id="others-id-1">
      <g-message>Message from others id 1 with keyboard from base id default</g-message>
    </g-base>
    <g-base id="others-id-2">
      <g-base>${this.kbk.backNext()}</g-base>
      <g-message>Message from others id 3 with keyboard in same base</g-message>
    </g-base>
  `
}

// understanding example
this.kbk.backNext() // will show all language with block template
this.kbk.backNext("id") // will show all language only (lang="id") with block template
this.kbk.backNext("default") // will show all language only (lang="default" or without lang) with block template
```

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[label](./gramstax.blockgkeyboard.label.md)


</td><td>

`static`


</td><td>

typeof [LabelGKeyboard](./gramstax.labelgkeyboard.md)


</td><td>

Reference to the `LabelGKeyboard` class containing keyboard definitions.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[\_build(key, lang, type, reverse)](./gramstax.blockgkeyboard._build.md)


</td><td>

`static`


</td><td>

Build keyboard blocks by calling a method from the linked `LabelGKeyboard`.


</td></tr>
</tbody></table>

